import type { HistoricalJob, HistoricalPriceRow } from "@/lib/upstox/types";
import type { UpstoxHistoricalRowRecord } from "@/lib/storage/db";
import { getDb } from "@/lib/storage/db";

function rowId(symbol: string, date: string): string {
  return `${symbol}|${date}`;
}

/** Merge rows in memory without deleting other symbols (for tests and previews). */
export function mergeHistoricalRowsInMemory(
  existing: HistoricalPriceRow[],
  incoming: HistoricalPriceRow[],
): HistoricalPriceRow[] {
  const map = new Map<string, HistoricalPriceRow>();
  for (const row of existing) {
    map.set(rowId(row.symbol, row.date), row);
  }
  for (const row of incoming) {
    map.set(rowId(row.symbol, row.date), row);
  }
  return [...map.values()].sort((a, b) =>
    a.symbol === b.symbol
      ? a.date.localeCompare(b.date)
      : a.symbol.localeCompare(b.symbol),
  );
}

export async function mergeHistoricalRows(rows: HistoricalPriceRow[]): Promise<number> {
  const db = getDb();
  const records: UpstoxHistoricalRowRecord[] = rows
    .filter((r) => r.symbol && r.date)
    .map((r) => ({ ...r, id: rowId(r.symbol, r.date) }));
  if (records.length === 0) return 0;
  await db.upstoxHistorical.bulkPut(records);
  return records.length;
}

export async function listHistoricalRowsForSymbol(
  symbol: string,
): Promise<HistoricalPriceRow[]> {
  const db = getDb();
  const rows = await db.upstoxHistorical.where("symbol").equals(symbol).toArray();
  return rows
    .map(({ symbol: s, date, open, high, low, close, volume }) => ({
      symbol: s,
      date,
      open,
      high,
      low,
      close,
      volume,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function listAllHistoricalRows(): Promise<HistoricalPriceRow[]> {
  const db = getDb();
  const rows = await db.upstoxHistorical.toArray();
  return rows
    .map(({ symbol, date, open, high, low, close, volume }) => ({
      symbol,
      date,
      open,
      high,
      low,
      close,
      volume,
    }))
    .sort((a, b) =>
      a.symbol === b.symbol
        ? a.date.localeCompare(b.date)
        : a.symbol.localeCompare(b.symbol),
    );
}

export async function countHistoricalStats(): Promise<{
  rowCount: number;
  symbolCount: number;
}> {
  const db = getDb();
  const rowCount = await db.upstoxHistorical.count();
  const symbols = await db.upstoxHistorical.orderBy("symbol").uniqueKeys();
  return { rowCount, symbolCount: symbols.length };
}

export async function deleteHistoricalDatabase(): Promise<void> {
  const db = getDb();
  await db.upstoxHistorical.clear();
  await db.upstoxJobs.clear();
}

export async function deleteHistoricalSymbol(symbol: string): Promise<void> {
  const db = getDb();
  await db.upstoxHistorical.where("symbol").equals(symbol).delete();
}

export async function saveHistoricalJob(job: HistoricalJob): Promise<void> {
  const db = getDb();
  await db.upstoxJobs.put(job);
}

export async function getHistoricalJob(id: string): Promise<HistoricalJob | undefined> {
  const db = getDb();
  return db.upstoxJobs.get(id);
}

export async function listIncompleteHistoricalJobs(): Promise<HistoricalJob[]> {
  const db = getDb();
  return db.upstoxJobs.filter((job) => !job.complete).toArray();
}

export async function setInstrumentCacheDate(cacheDate: string, payload: string): Promise<void> {
  const db = getDb();
  await db.upstoxInstrumentCache.put({ cacheDate, payload });
}

export async function getInstrumentCache(
  cacheDate: string,
): Promise<string | undefined> {
  const db = getDb();
  const row = await db.upstoxInstrumentCache.get(cacheDate);
  return row?.payload;
}
