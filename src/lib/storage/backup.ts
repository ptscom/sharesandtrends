import type { PatternDefinition, ScanRun, SymbolMeta } from "@/lib/types";
import { clearPriceCache } from "@/lib/storage/prices";
import { getDb, type AppMeta, type PriceRecord } from "@/lib/storage/db";

export const APP_DATA_BACKUP_VERSION = 1;
export const BACKUP_FILE_EXTENSION = ".json.gz";

export interface AppDataSnapshot {
  v: number;
  exportedAt: string;
  prices: PriceRecord[];
  symbols: SymbolMeta[];
  patterns: PatternDefinition[];
  scans: ScanRun[];
  meta: AppMeta[];
}

export interface BackupFileSummary {
  exportedAt: string;
  symbolCount: number;
  totalBars: number;
  patternCount: number;
  scanCount: number;
  fileName: string;
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
    v: APP_DATA_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    prices,
    symbols,
    patterns,
    scans,
    meta,
  };
}

export function summarizeSnapshot(
  snapshot: AppDataSnapshot,
  fileName: string,
): BackupFileSummary {
  const totalBars = snapshot.prices.reduce(
    (sum, record) => sum + record.bars.length,
    0,
  );
  return {
    exportedAt: snapshot.exportedAt,
    symbolCount: snapshot.symbols.length,
    totalBars,
    patternCount: snapshot.patterns.length,
    scanCount: snapshot.scans.length,
    fileName,
  };
}

function validateSnapshot(raw: unknown): AppDataSnapshot {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid backup file: not a JSON object.");
  }
  const snapshot = raw as AppDataSnapshot;
  if (snapshot.v !== APP_DATA_BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version (${String(snapshot.v)}). Expected ${APP_DATA_BACKUP_VERSION}.`,
    );
  }
  if (!Array.isArray(snapshot.prices) || !Array.isArray(snapshot.symbols)) {
    throw new Error("Invalid backup file: missing prices or symbols.");
  }
  return snapshot;
}

export async function parseBackupFile(file: File): Promise<AppDataSnapshot> {
  const isGzip =
    file.name.toLowerCase().endsWith(".gz") ||
    file.type === "application/gzip" ||
    file.type === "application/x-gzip";

  let text: string;
  if (isGzip) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error(
        "This browser cannot read .gz backups. Use an uncompressed .json export or a newer browser.",
      );
    }
    const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = await file.text();
  }

  return validateSnapshot(JSON.parse(text) as unknown);
}

async function snapshotToDownloadBlob(snapshot: AppDataSnapshot): Promise<Blob> {
  const json = JSON.stringify(snapshot);

  if (typeof CompressionStream !== "undefined") {
    const stream = new Blob([json], { type: "application/json" })
      .stream()
      .pipeThrough(new CompressionStream("gzip"));
    const compressed = await new Response(stream).arrayBuffer();
    return new Blob([compressed], { type: "application/gzip" });
  }

  return new Blob([json], { type: "application/json" });
}

export function defaultBackupFileName(exportedAt: string): string {
  const stamp = exportedAt.slice(0, 10);
  const hasGzip = typeof CompressionStream !== "undefined";
  return `sharesandtrends-backup-${stamp}${hasGzip ? BACKUP_FILE_EXTENSION : ".json"}`;
}

export async function downloadAppDataBackup(): Promise<BackupFileSummary> {
  const snapshot = await exportAppDataSnapshot();
  const fileName = defaultBackupFileName(snapshot.exportedAt);
  const blob = await snapshotToDownloadBlob(snapshot);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return summarizeSnapshot(snapshot, fileName);
}

/** Wipes the app IndexedDB tables and replaces them with the backup snapshot. */
export async function restoreAppDataFromSnapshot(
  snapshot: AppDataSnapshot,
): Promise<void> {
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

export async function restoreAppDataFromFile(file: File): Promise<BackupFileSummary> {
  const snapshot = await parseBackupFile(file);
  await restoreAppDataFromSnapshot(snapshot);
  return summarizeSnapshot(snapshot, file.name);
}
