import type { OhlcvBar, SymbolMeta } from "@/lib/types";
import { getDb } from "./db";

const priceCache = new Map<string, OhlcvBar[]>();
let cacheLastUpdatedAt: string | null = null;

export interface PriceCacheStatus {
  lastCachedAt: string | null;
  cachedSymbolCount: number;
}

export function getPriceCacheStatus(): PriceCacheStatus {
  return {
    lastCachedAt: cacheLastUpdatedAt,
    cachedSymbolCount: priceCache.size,
  };
}

function touchCacheMeta(): void {
  cacheLastUpdatedAt = new Date().toISOString();
}

function cacheKey(symbol: string): string {
  return symbol.toUpperCase();
}

function readCached(symbol: string): OhlcvBar[] | undefined {
  return priceCache.get(cacheKey(symbol));
}

function writeCache(symbol: string, bars: OhlcvBar[]): void {
  priceCache.set(cacheKey(symbol), bars);
  touchCacheMeta();
}

function dropCache(symbol: string): void {
  priceCache.delete(cacheKey(symbol));
  cacheLastUpdatedAt =
    priceCache.size > 0 ? new Date().toISOString() : null;
}

export function clearPriceCache(): void {
  priceCache.clear();
  cacheLastUpdatedAt = null;
}

function barsSummary(bars: OhlcvBar[]): {
  barCount: number;
  fromDate: string | null;
  toDate: string | null;
} {
  if (bars.length === 0) {
    return { barCount: 0, fromDate: null, toDate: null };
  }
  return {
    barCount: bars.length,
    fromDate: bars[0]!.date,
    toDate: bars[bars.length - 1]!.date,
  };
}

async function writeSymbolMeta(
  symbol: string,
  bars: OhlcvBar[],
): Promise<void> {
  const upper = symbol.toUpperCase();
  const existing = await getDb().symbols.get(upper);
  await getDb().symbols.put({
    symbol: upper,
    name: existing?.name,
    sector: existing?.sector,
    lastUpdated: new Date().toISOString(),
    ...barsSummary(bars),
  });
}

export async function savePriceBars(
  symbol: string,
  bars: OhlcvBar[],
): Promise<void> {
  const database = getDb();
  const upper = symbol.toUpperCase();
  await database.prices.put({
    symbol: upper,
    bars,
    updatedAt: new Date().toISOString(),
  });
  await writeSymbolMeta(upper, bars);
  writeCache(upper, bars);
}

export async function getPriceBars(symbol: string): Promise<OhlcvBar[]> {
  const upper = cacheKey(symbol);
  const cached = readCached(symbol);
  if (cached !== undefined) return cached;

  const record = await getDb().prices.get(upper);
  const bars = record?.bars ?? [];
  writeCache(upper, bars);
  return bars;
}

const PRICE_LOAD_BATCH = 24;

/** Load OHLCV for many symbols in parallel batches (faster than sequential). */
export async function getPriceBarsBatch(
  symbols: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, OhlcvBar[]>> {
  const out: Record<string, OhlcvBar[]> = {};
  const total = symbols.length;
  const uncached: string[] = [];

  for (const symbol of symbols) {
    const cached = readCached(symbol);
    if (cached !== undefined) {
      if (cached.length > 0) out[symbol] = cached;
    } else {
      uncached.push(symbol);
    }
  }

  let done = total - uncached.length;
  if (done > 0) onProgress?.(done, total);

  if (uncached.length === 0) {
    onProgress?.(total, total);
    return out;
  }

  for (let i = 0; i < uncached.length; i += PRICE_LOAD_BATCH) {
    const batch = uncached.slice(i, i + PRICE_LOAD_BATCH);
    const rows = await Promise.all(
      batch.map(async (symbol) => ({
        symbol,
        bars: await getPriceBars(symbol),
      })),
    );
    for (const { symbol, bars } of rows) {
      if (bars.length > 0) out[symbol] = bars;
    }
    done += batch.length;
    onProgress?.(Math.min(done, total), total);
  }

  return out;
}

export async function listSymbols(): Promise<SymbolMeta[]> {
  return getDb().symbols.orderBy("symbol").toArray();
}

export async function getStoredSymbolCount(): Promise<number> {
  return getDb().symbols.count();
}

export async function deleteSymbol(symbol: string): Promise<void> {
  const upper = symbol.toUpperCase();
  await getDb().prices.delete(upper);
  await getDb().symbols.delete(upper);
  dropCache(upper);
}

export async function deleteSymbols(symbols: string[]): Promise<void> {
  const database = getDb();
  const upper = symbols.map((symbol) => symbol.toUpperCase());
  await database.prices.bulkDelete(upper);
  await database.symbols.bulkDelete(upper);
  for (const symbol of upper) dropCache(symbol);
}

export async function deleteAllPriceData(): Promise<void> {
  const database = getDb();
  await database.prices.clear();
  await database.symbols.clear();
  clearPriceCache();
}

export interface SymbolInventoryRow {
  symbol: string;
  barCount: number;
  fromDate: string | null;
  toDate: string | null;
  lastUpdated: string | null;
  needsBackfill?: boolean;
}

export async function listSymbolInventory(): Promise<SymbolInventoryRow[]> {
  const metas = await listSymbols();
  return metas
    .map((meta) => ({
      symbol: meta.symbol,
      barCount: meta.barCount ?? 0,
      fromDate: meta.fromDate ?? null,
      toDate: meta.toDate ?? null,
      lastUpdated: meta.lastUpdated ?? null,
      needsBackfill: meta.barCount === undefined,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

const BACKFILL_BATCH = 20;

/** One-time index build for symbols saved before metadata was denormalized. */
export async function backfillSymbolSummaries(
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const metas = await listSymbols();
  const pending = metas.filter((m) => m.barCount === undefined);
  const total = pending.length;
  if (total === 0) {
    onProgress?.(0, 0);
    return;
  }

  for (let i = 0; i < pending.length; i += BACKFILL_BATCH) {
    const batch = pending.slice(i, i + BACKFILL_BATCH);
    await Promise.all(
      batch.map(async (meta) => {
        const record = await getDb().prices.get(meta.symbol);
        const bars = record?.bars ?? [];
        writeCache(meta.symbol, bars);
        await writeSymbolMeta(meta.symbol, bars);
      }),
    );
    onProgress?.(Math.min(i + batch.length, total), total);
  }
}

/** Remove bars with dates in [fromDate, toDate] inclusive. Returns bars removed. */
export async function deletePriceBarsInRange(
  symbol: string,
  fromDate: string,
  toDate: string,
): Promise<number> {
  if (fromDate > toDate) {
    throw new Error("Start date must be on or before end date.");
  }

  const bars = await getPriceBars(symbol);
  const kept = bars.filter((b) => b.date < fromDate || b.date > toDate);
  const removed = bars.length - kept.length;

  if (removed === 0) return 0;

  if (kept.length === 0) {
    await deleteSymbol(symbol);
  } else {
    await savePriceBars(symbol, kept);
  }

  return removed;
}

export async function countBarsInRange(
  symbol: string,
  fromDate: string,
  toDate: string,
): Promise<number> {
  if (fromDate > toDate) return 0;
  const bars = await getPriceBars(symbol);
  return bars.filter((b) => b.date >= fromDate && b.date <= toDate).length;
}

export async function mergePriceBars(
  symbol: string,
  newBars: OhlcvBar[],
): Promise<OhlcvBar[]> {
  if (newBars.length === 0) {
    return getPriceBars(symbol);
  }

  const sortedNew = [...newBars].sort((a, b) => a.date.localeCompare(b.date));
  const existing = await getPriceBars(symbol);

  if (existing.length === 0) {
    await savePriceBars(symbol, sortedNew);
    return sortedNew;
  }

  const lastExisting = existing[existing.length - 1]!.date;
  const firstNew = sortedNew[0]!.date;

  if (firstNew > lastExisting) {
    const merged = [...existing, ...sortedNew];
    await savePriceBars(symbol, merged);
    return merged;
  }

  if (sortedNew.every((bar) => bar.date >= lastExisting)) {
    const merged = existing.slice(0, -1);
    for (const bar of sortedNew) {
      if (bar.date > (merged[merged.length - 1]?.date ?? "")) {
        merged.push(bar);
      } else {
        merged[merged.length - 1] = bar;
      }
    }
    await savePriceBars(symbol, merged);
    return merged;
  }

  const byDate = new Map<string, OhlcvBar>();
  for (const bar of existing) byDate.set(bar.date, bar);
  for (const bar of sortedNew) byDate.set(bar.date, bar);
  const merged = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  await savePriceBars(symbol, merged);
  return merged;
}
