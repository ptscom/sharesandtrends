import { v4 as uuidv4 } from "uuid";
import Dexie, { type Table } from "dexie";
import type { PatternDefinition, ScanRun, SymbolMeta } from "@/lib/types";
import { clearPriceCache } from "@/lib/storage/prices";
import { getDb, type AppMeta, type PriceRecord } from "@/lib/storage/db";

export const APP_DATA_BACKUP_VERSION = 1;

export interface AppDataSnapshot {
  version: number;
  exportedAt: string;
  prices: PriceRecord[];
  symbols: SymbolMeta[];
  patterns: PatternDefinition[];
  scans: ScanRun[];
  meta: AppMeta[];
}

export interface BackupSummary {
  id: string;
  createdAt: string;
  label: string;
  symbolCount: number;
  totalBars: number;
  patternCount: number;
  scanCount: number;
}

interface BackupRecord extends BackupSummary {
  snapshot: AppDataSnapshot;
}

class BackupDatabase extends Dexie {
  backups!: Table<BackupRecord, string>;

  constructor() {
    super("sharesandtrends-backups");
    this.version(1).stores({
      backups: "id, createdAt",
    });
  }
}

const backupDb = new BackupDatabase();

function getBackupDb(): BackupDatabase {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  return backupDb;
}

export async function exportAppDataSnapshot(): Promise<AppDataSnapshot> {
  const database = getDb();
  const [prices, symbols, patterns, scans, meta] = await Promise.all([
    database.prices.toArray(),
    database.symbols.toArray(),
    database.patterns.toArray(),
    database.scans.toArray(),
    database.meta.toArray(),
  ]);

  return {
    version: APP_DATA_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    prices,
    symbols,
    patterns,
    scans,
    meta,
  };
}

export async function restoreAppDataFromSnapshot(
  snapshot: AppDataSnapshot,
): Promise<void> {
  if (snapshot.version !== APP_DATA_BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version (${snapshot.version}). Expected ${APP_DATA_BACKUP_VERSION}.`,
    );
  }

  const database = getDb();
  await database.transaction(
    "rw",
    database.prices,
    database.symbols,
    database.patterns,
    database.scans,
    database.meta,
    async () => {
      await database.prices.clear();
      await database.symbols.clear();
      await database.patterns.clear();
      await database.scans.clear();
      await database.meta.clear();

      if (snapshot.prices.length > 0) {
        await database.prices.bulkPut(snapshot.prices);
      }
      if (snapshot.symbols.length > 0) {
        await database.symbols.bulkPut(snapshot.symbols);
      }
      if (snapshot.patterns.length > 0) {
        await database.patterns.bulkPut(snapshot.patterns);
      }
      if (snapshot.scans.length > 0) {
        await database.scans.bulkPut(snapshot.scans);
      }
      if (snapshot.meta.length > 0) {
        await database.meta.bulkPut(snapshot.meta);
      }
    },
  );

  clearPriceCache();
}

function summarizeSnapshot(snapshot: AppDataSnapshot): Omit<BackupSummary, "id" | "createdAt" | "label"> {
  const totalBars = snapshot.prices.reduce(
    (sum, record) => sum + record.bars.length,
    0,
  );
  return {
    symbolCount: snapshot.symbols.length,
    totalBars,
    patternCount: snapshot.patterns.length,
    scanCount: snapshot.scans.length,
  };
}

export async function createManualBackup(label?: string): Promise<BackupSummary> {
  const snapshot = await exportAppDataSnapshot();
  const createdAt = new Date().toISOString();
  const id = uuidv4();
  const summary = summarizeSnapshot(snapshot);

  const record: BackupRecord = {
    id,
    createdAt,
    label: label?.trim() || formatDefaultBackupLabel(createdAt),
    ...summary,
    snapshot,
  };

  await getBackupDb().backups.put(record);

  return {
    id: record.id,
    createdAt: record.createdAt,
    label: record.label,
    symbolCount: record.symbolCount,
    totalBars: record.totalBars,
    patternCount: record.patternCount,
    scanCount: record.scanCount,
  };
}

export async function listManualBackups(): Promise<BackupSummary[]> {
  const rows = await getBackupDb().backups.orderBy("createdAt").reverse().toArray();
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    label: row.label,
    symbolCount: row.symbolCount,
    totalBars: row.totalBars,
    patternCount: row.patternCount,
    scanCount: row.scanCount,
  }));
}

export async function deleteManualBackup(id: string): Promise<void> {
  await getBackupDb().backups.delete(id);
}

export async function restoreManualBackup(id: string): Promise<void> {
  const record = await getBackupDb().backups.get(id);
  if (!record) {
    throw new Error("Backup not found.");
  }
  await restoreAppDataFromSnapshot(record.snapshot);
}

function formatDefaultBackupLabel(createdAt: string): string {
  return new Date(createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
