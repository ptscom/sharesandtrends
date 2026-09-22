import Dexie, { type Table } from "dexie";
import type { SavedExploration } from "@/lib/explore/exploration-models";
import type { IndicatorScanRun } from "@/lib/explore/exploration-models";
import type {
  OhlcvBar,
  PatternDefinition,
  ScanRun,
  SymbolMeta,
} from "@/lib/types";
import type { HistoricalJob, HistoricalPriceRow } from "@/lib/upstox/types";

export interface PriceRecord {
  symbol: string;
  bars: OhlcvBar[];
  updatedAt: string;
}

export interface AppMeta {
  key: string;
  value: string;
}

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
  explorations!: Table<SavedExploration, string>;
  indicatorScans!: Table<IndicatorScanRun, string>;
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
      explorations: "id, updatedAt",
    });
    this.version(3).stores({
      prices: "symbol",
      symbols: "symbol",
      patterns: "id",
      scans: "id, runAt",
      meta: "key",
      explorations: "id, updatedAt",
      indicatorScans: "id, filterKey, runAt",
    });
    this.version(4).stores({
      prices: "symbol",
      symbols: "symbol",
      patterns: "id",
      scans: "id, runAt",
      meta: "key",
      explorations: "id, updatedAt",
      indicatorScans: "id, filterKey, runAt",
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
