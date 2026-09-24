import type { IntradayJob, IntradayPriceRow } from "@/lib/upstox/types";
import { getDb, type UpstoxIntradayRowRecord } from "@/lib/storage/db";

function rowId(symbol: string, intervalMinutes: number, timestamp: string): string {
  return `${symbol}|${intervalMinutes}|${timestamp}`;
}

export function mergeIntradayRowsInMemory(
  existing: IntradayPriceRow[],
  incoming: IntradayPriceRow[],
): IntradayPriceRow[] {
  const map = new Map<string, IntradayPriceRow>();
  for (const row of existing) {
    map.set(rowId(row.symbol, row.intervalMinutes, row.timestamp), row);
  }
  for (const row of incoming) {
    map.set(rowId(row.symbol, row.intervalMinutes, row.timestamp), row);
  }
  return [...map.values()].sort((a, b) =>
    a.symbol === b.symbol
      ? a.timestamp.localeCompare(b.timestamp)
      : a.symbol.localeCompare(b.symbol),
  );
}

export async function mergeIntradayRows(rows: IntradayPriceRow[]): Promise<number> {
  const db = getDb();
  const records: UpstoxIntradayRowRecord[] = rows
    .filter((r) => r.symbol && r.timestamp)
    .map((r) => ({
      ...r,
      id: rowId(r.symbol, r.intervalMinutes, r.timestamp),
    }));
  if (records.length === 0) return 0;
  await db.upstoxIntradayHistorical.bulkPut(records);
  return records.length;
}

function mapRow(record: UpstoxIntradayRowRecord): IntradayPriceRow {
  const { symbol, intervalMinutes, timestamp, open, high, low, close, volume } =
    record;
  return { symbol, intervalMinutes, timestamp, open, high, low, close, volume };
}

export async function queryIntradayRows(options: {
  page: number;
  pageSize: number;
  symbolQuery?: string;
  intervalMinutes?: number;
}): Promise<{ rows: IntradayPriceRow[]; total: number }> {
  const db = getDb();
  const page = Math.max(0, options.page);
  const pageSize = Math.max(1, options.pageSize);
  const q = options.symbolQuery?.trim().toUpperCase() ?? "";
  const interval = options.intervalMinutes;

  if (q) {
    let collection = db.upstoxIntradayHistorical.where("symbol").startsWith(q);
    if (interval !== undefined) {
      collection = collection.filter((r) => r.intervalMinutes === interval);
    }
    const total = await collection.count();
    const raw = await collection.offset(page * pageSize).limit(pageSize).toArray();
    const rows = raw.map(mapRow).sort((a, b) =>
      a.symbol === b.symbol
        ? a.timestamp.localeCompare(b.timestamp)
        : a.symbol.localeCompare(b.symbol),
    );
    return { rows, total };
  }

  const base =
    interval === undefined
      ? db.upstoxIntradayHistorical.orderBy("id")
      : db.upstoxIntradayHistorical
          .orderBy("id")
          .filter((r) => r.intervalMinutes === interval);
  const total = await base.count();
  const raw = await base.offset(page * pageSize).limit(pageSize).toArray();
  return { rows: raw.map(mapRow), total };
}

export async function countIntradayStats(): Promise<{
  rowCount: number;
  symbolCount: number;
}> {
  const db = getDb();
  const rowCount = await db.upstoxIntradayHistorical.count();
  const symbols = await db.upstoxIntradayHistorical.orderBy("symbol").uniqueKeys();
  return { rowCount, symbolCount: symbols.length };
}

export async function deleteIntradayDatabase(): Promise<void> {
  const db = getDb();
  await db.upstoxIntradayHistorical.clear();
  await db.upstoxIntradayJobs.clear();
}

export async function deleteIntradaySymbol(symbol: string): Promise<void> {
  const db = getDb();
  await db.upstoxIntradayHistorical.where("symbol").equals(symbol).delete();
}

export async function saveIntradayJob(job: IntradayJob): Promise<void> {
  const db = getDb();
  await db.upstoxIntradayJobs.put(job);
}

export async function listIncompleteIntradayJobs(): Promise<IntradayJob[]> {
  const db = getDb();
  return db.upstoxIntradayJobs.filter((job) => !job.complete).toArray();
}

export async function getLatestIntradayJob(): Promise<IntradayJob | undefined> {
  const db = getDb();
  const jobs = await db.upstoxIntradayJobs.orderBy("updatedAt").reverse().limit(1).toArray();
  return jobs[0];
}
