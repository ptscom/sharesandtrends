import Dexie, { type Table } from "dexie";
import type {
  OhlcvBar,
  PatternDefinition,
  ScanRun,
  SymbolMeta,
} from "@/lib/types";

export interface PriceRecord {
  symbol: string;
  bars: OhlcvBar[];
  updatedAt: string;
}

export interface AppMeta {
  key: string;
  value: string;
}

import type { HistoricalJob, HistoricalPriceRow } from "@/lib/upstox/types";

export type UpstoxHistoricalRowRecord = HistoricalPriceRow & { id: string };

export interface UpstoxInstrumentCacheRecord {
  cacheDate: string;
  payload: string;
}

export class SharesAndTrendsDB extends Dexie {
  prices!: Table<PriceRecord, string>;
  symbols!: Table<SymbolMeta, string>;
  patterns!: Table<PatternDefinition, string>;
  scans!: Table<ScanRun, string>;
  meta!: Table<AppMeta, string>;
  upstoxHistorical!: Table<UpstoxHistoricalRowRecord, string>;
  upstoxJobs!: Table<HistoricalJob, string>;
  upstoxInstrumentCache!: Table<UpstoxInstrumentCacheRecord, string>;

  constructor() {
    super("sharesandtrends");
    this.version(1).stores({
      prices: "symbol",
      symbols: "symbol",
      patterns: "id",
      scans: "id, runAt",
      meta: "key",
    });
    this.version(2).stores({
      prices: "symbol",
      symbols: "symbol",
      patterns: "id",
      scans: "id, runAt",
      meta: "key",
      upstoxHistorical: "id, symbol, date",
      upstoxJobs: "id, complete, updatedAt",
      upstoxInstrumentCache: "cacheDate",
    });
  }
}

export const db = new SharesAndTrendsDB();

export function getDb(): SharesAndTrendsDB {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  return db;
}
