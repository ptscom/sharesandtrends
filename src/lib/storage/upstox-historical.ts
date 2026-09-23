import type { HistoricalJob, HistoricalPriceRow } from "@/lib/upstox/types";
import { syncHistoricalRowsToPrices } from "@/lib/upstox/sync-to-prices";
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

/** Upsert by (symbol, date) only — never deletes other dates for that symbol. */
export async function mergeHistoricalRows(rows: HistoricalPriceRow[]): Promise<number> {
  const db = getDb();
  const records: UpstoxHistoricalRowRecord[] = rows
    .filter((r) => r.symbol && r.date)
    .map((r) => ({ ...r, id: rowId(r.symbol, r.date) }));
  if (records.length === 0) return 0;
  await db.upstoxHistorical.bulkPut(records);
  await syncHistoricalRowsToPrices(rows);
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

function mapRow(record: UpstoxHistoricalRowRecord): HistoricalPriceRow {
  const { symbol, date, open, high, low, close, volume } = record;
  return { symbol, date, open, high, low, close, volume };
}

/** Paginated read — avoids loading hundreds of thousands of rows into memory. */
export async function queryHistoricalRows(options: {
  page: number;
  pageSize: number;
  symbolQuery?: string;
}): Promise<{ rows: HistoricalPriceRow[]; total: number }> {
  const db = getDb();
  const page = Math.max(0, options.page);
  const pageSize = Math.max(1, options.pageSize);
  const q = options.symbolQuery?.trim().toUpperCase() ?? "";

  if (q) {
    const collection = db.upstoxHistorical.where("symbol").startsWith(q);
    const total = await collection.count();
    const raw = await collection.offset(page * pageSize).limit(pageSize).toArray();
    const rows = raw.map(mapRow).sort((a, b) =>
      a.symbol === b.symbol
        ? a.date.localeCompare(b.date)
        : a.symbol.localeCompare(b.symbol),
    );
    return { rows, total };
  }

  const total = await db.upstoxHistorical.count();
  const raw = await db.upstoxHistorical
    .orderBy("id")
    .offset(page * pageSize)
    .limit(pageSize)
    .toArray();
  const rows = raw.map(mapRow);
  return { rows, total };
}

/** Full export via cursor (for CSV download). */
export async function forEachHistoricalRowBatch(
  batchSize: number,
  fn: (rows: HistoricalPriceRow[]) => void | Promise<void>,
): Promise<void> {
  const db = getDb();
  let offset = 0;
  for (;;) {
    const batch = await db.upstoxHistorical
      .orderBy("id")
      .offset(offset)
      .limit(batchSize)
      .toArray();
    if (batch.length === 0) break;
    await fn(batch.map(mapRow));
    offset += batch.length;
  }
}

export async function listAllHistoricalRows(): Promise<HistoricalPriceRow[]> {
  const db = getDb();
  const count = await db.upstoxHistorical.count();
  if (count > 10_000) {
    throw new Error(
      `Too many rows (${count}) to load at once. Use paginated query or CSV export.`,
    );
  }
  const rows = await db.upstoxHistorical.orderBy("id").toArray();
  return rows
    .map(mapRow)
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

export async function getLatestHistoricalJob(): Promise<HistoricalJob | undefined> {
  const db = getDb();
  const jobs = await db.upstoxJobs.orderBy("updatedAt").reverse().limit(1).toArray();
  return jobs[0];
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

/** Re-sync every Upstox EOD row into the shared backtest `prices` store. */
export async function syncAllUpstoxHistoricalToPrices(): Promise<{
  symbols: number;
  bars: number;
}> {
  const rows = await listAllHistoricalRows();
  const bars = await syncHistoricalRowsToPrices(rows);
  return { symbols: new Set(rows.map((r) => r.symbol)).size, bars };
}
