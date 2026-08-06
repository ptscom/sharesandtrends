import { v4 as uuidv4 } from "uuid";
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
