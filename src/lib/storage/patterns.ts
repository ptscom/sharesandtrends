import { v4 as uuidv4 } from "uuid";
import { EMA_CROSS_PATTERN } from "@/lib/patterns/defaults";
import { STRATEGY_PRESETS } from "@/lib/patterns/strategies";
import type { PatternDefinition, ScanRun } from "@/lib/types";
import { getDb } from "./db";

export async function savePattern(
  pattern: PatternDefinition,
): Promise<PatternDefinition> {
  const now = new Date().toISOString();
  const record: PatternDefinition = {
    ...pattern,
    id: pattern.id ?? uuidv4(),
    createdAt: pattern.createdAt ?? now,
    updatedAt: now,
  };
  await getDb().patterns.put(record);
  return record;
}

export async function listPatterns(): Promise<PatternDefinition[]> {
  return getDb().patterns.orderBy("updatedAt").reverse().toArray();
}

export async function getPattern(id: string): Promise<PatternDefinition | undefined> {
  return getDb().patterns.get(id);
}

export async function deletePattern(id: string): Promise<void> {
  await getDb().patterns.delete(id);
}

export async function saveScanRun(scan: ScanRun): Promise<void> {
  await getDb().scans.put(scan);
}

export async function listScanRuns(limit = 20): Promise<ScanRun[]> {
  return getDb().scans.orderBy("runAt").reverse().limit(limit).toArray();
}

export async function getScanRun(id: string): Promise<ScanRun | undefined> {
  return getDb().scans.get(id);
}

function findPresetPattern(
  patternId?: string,
  patternName?: string,
): PatternDefinition | undefined {
  if (patternId) {
    const byId = STRATEGY_PRESETS.find((s) => s.id === patternId);
    if (byId) return byId.pattern;
  }
  if (patternName) {
    const byName = STRATEGY_PRESETS.find((s) => s.pattern.name === patternName);
    if (byName) return byName.pattern;
  }
  return undefined;
}

/** Load the pattern used for a symbol detail view (from scan context or fallback). */
export async function resolveSymbolPattern(options: {
  scanId?: string;
  patternId?: string;
}): Promise<{ pattern: PatternDefinition; scan: ScanRun | null }> {
  const { scanId, patternId } = options;

  if (scanId) {
    const scan = await getScanRun(scanId);
    if (scan) {
      const stored = await getPattern(scan.patternId);
      if (stored) return { pattern: stored, scan };
      const preset = findPresetPattern(scan.patternId, scan.patternName);
      if (preset) return { pattern: preset, scan };
      return { pattern: EMA_CROSS_PATTERN, scan };
    }
  }

  if (patternId) {
    const stored = await getPattern(patternId);
    if (stored) return { pattern: stored, scan: null };
    const preset = findPresetPattern(patternId);
    if (preset) return { pattern: preset, scan: null };
  }

  return { pattern: EMA_CROSS_PATTERN, scan: null };
}
