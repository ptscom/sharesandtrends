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
