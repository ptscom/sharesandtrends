import type { OhlcvBar, SymbolMeta } from "@/lib/types";
import { getDb } from "./db";

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
  await database.symbols.put({
    symbol: upper,
    lastUpdated: new Date().toISOString(),
  });
}

export async function getPriceBars(symbol: string): Promise<OhlcvBar[]> {
  const record = await getDb().prices.get(symbol.toUpperCase());
  return record?.bars ?? [];
}

const PRICE_LOAD_BATCH = 24;

/** Load OHLCV for many symbols in parallel batches (faster than sequential). */
export async function getPriceBarsBatch(
  symbols: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, OhlcvBar[]>> {
  const out: Record<string, OhlcvBar[]> = {};
  const total = symbols.length;

  for (let i = 0; i < symbols.length; i += PRICE_LOAD_BATCH) {
    const batch = symbols.slice(i, i + PRICE_LOAD_BATCH);
    const rows = await Promise.all(
      batch.map(async (symbol) => ({
        symbol,
        bars: await getPriceBars(symbol),
      })),
    );
    for (const { symbol, bars } of rows) {
      if (bars.length > 0) out[symbol] = bars;
    }
    onProgress?.(Math.min(i + batch.length, total), total);
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
}

export async function deleteSymbols(symbols: string[]): Promise<void> {
  const database = getDb();
  const upper = symbols.map((symbol) => symbol.toUpperCase());
  await database.prices.bulkDelete(upper);
  await database.symbols.bulkDelete(upper);
}

export async function deleteAllPriceData(): Promise<void> {
  const database = getDb();
  await database.prices.clear();
  await database.symbols.clear();
}

export interface SymbolInventoryRow {
  symbol: string;
  barCount: number;
  fromDate: string | null;
  toDate: string | null;
  lastUpdated: string | null;
}

export async function listSymbolInventory(): Promise<SymbolInventoryRow[]> {
  const metas = await listSymbols();
  const rows = await Promise.all(
    metas.map(async (meta) => {
      const bars = await getPriceBars(meta.symbol);
      return {
        symbol: meta.symbol,
        barCount: bars.length,
        fromDate: bars[0]?.date ?? null,
        toDate: bars[bars.length - 1]?.date ?? null,
        lastUpdated: meta.lastUpdated ?? null,
      };
    }),
  );
  return rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
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
  const existing = await getPriceBars(symbol);
  const byDate = new Map<string, OhlcvBar>();
  for (const bar of existing) byDate.set(bar.date, bar);
  for (const bar of newBars) byDate.set(bar.date, bar);
  const merged = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  await savePriceBars(symbol, merged);
  return merged;
}
