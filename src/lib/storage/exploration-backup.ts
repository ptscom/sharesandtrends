import type { SavedExploration } from "@/lib/explore/exploration-models";
import { getDb } from "@/lib/storage/db";
import { listExplorations } from "@/lib/storage/explorations";

export const EXPLORATION_BACKUP_VERSION = 1;
export const EXPLORATION_BACKUP_EXTENSION = ".json.gz";

export interface ExplorationBackupSnapshot {
  v: number;
  exportedAt: string;
  explorations: SavedExploration[];
}

export interface ExplorationBackupSummary {
  exportedAt: string;
  explorationCount: number;
  fileName: string;
}

export async function exportExplorationSnapshot(): Promise<ExplorationBackupSnapshot> {
  const explorations = await listExplorations();
  return {
    v: EXPLORATION_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    explorations,
  };
}

function validateExplorationBackup(raw: unknown): ExplorationBackupSnapshot {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid backup: not a JSON object.");
  }
  const snapshot = raw as ExplorationBackupSnapshot;
  if (snapshot.v !== EXPLORATION_BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version (${String(snapshot.v)}). Expected ${EXPLORATION_BACKUP_VERSION}.`,
    );
  }
  if (!Array.isArray(snapshot.explorations)) {
    throw new Error("Invalid backup: missing explorations array.");
  }
  for (const item of snapshot.explorations) {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid backup: bad exploration entry.");
    }
    if (typeof item.id !== "string" || typeof item.name !== "string") {
      throw new Error("Invalid backup: exploration missing id or name.");
    }
    if (!item.builder || typeof item.builder !== "object") {
      throw new Error(`Invalid backup: exploration "${item.name}" missing builder.`);
    }
  }
  return snapshot;
}

export async function parseExplorationBackupFile(
  file: File,
): Promise<ExplorationBackupSnapshot> {
  const isGzip =
    file.name.toLowerCase().endsWith(".gz") ||
    file.type === "application/gzip" ||
    file.type === "application/x-gzip";

  let text: string;
  if (isGzip) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error(
        "This browser cannot read .gz backups. Use an uncompressed .json file or a newer browser.",
      );
    }
    const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = await file.text();
  }

  return validateExplorationBackup(JSON.parse(text) as unknown);
}

async function snapshotToBlob(snapshot: ExplorationBackupSnapshot): Promise<Blob> {
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

export function defaultExplorationBackupFileName(exportedAt: string): string {
  const stamp = exportedAt.slice(0, 10);
  const gzip = typeof CompressionStream !== "undefined";
  return `sharesandtrends-explorations-${stamp}${gzip ? EXPLORATION_BACKUP_EXTENSION : ".json"}`;
}

export function summarizeExplorationBackup(
  snapshot: ExplorationBackupSnapshot,
  fileName: string,
): ExplorationBackupSummary {
  return {
    exportedAt: snapshot.exportedAt,
    explorationCount: snapshot.explorations.length,
    fileName,
  };
}

export async function downloadExplorationBackup(): Promise<ExplorationBackupSummary> {
  const snapshot = await exportExplorationSnapshot();
  const fileName = defaultExplorationBackupFileName(snapshot.exportedAt);
  const blob = await snapshotToBlob(snapshot);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return summarizeExplorationBackup(snapshot, fileName);
}

/** Merge by id (same id overwrites). */
export async function mergeExplorationsFromSnapshot(
  snapshot: ExplorationBackupSnapshot,
): Promise<number> {
  if (snapshot.explorations.length === 0) return 0;
  const db = getDb();
  await db.explorations.bulkPut(snapshot.explorations);
  return snapshot.explorations.length;
}

/** Replace entire custom exploration library with backup contents. */
export async function replaceExplorationsFromSnapshot(
  snapshot: ExplorationBackupSnapshot,
): Promise<number> {
  const db = getDb();
  await db.transaction("rw", db.explorations, async () => {
    await db.explorations.clear();
    if (snapshot.explorations.length > 0) {
      await db.explorations.bulkPut(snapshot.explorations);
    }
  });
  return snapshot.explorations.length;
}

export async function restoreExplorationsFromFile(
  file: File,
  mode: "merge" | "replace",
): Promise<ExplorationBackupSummary> {
  const snapshot = await parseExplorationBackupFile(file);
  if (mode === "replace") {
    await replaceExplorationsFromSnapshot(snapshot);
  } else {
    await mergeExplorationsFromSnapshot(snapshot);
  }
  return summarizeExplorationBackup(snapshot, file.name);
}
