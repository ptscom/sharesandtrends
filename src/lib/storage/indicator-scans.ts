import type { IndicatorScanRun } from "@/lib/explore/exploration-models";
import { getDb } from "./db";

const MAX_RUNS_PER_FILTER = 50;

export async function saveIndicatorScanRun(
  run: IndicatorScanRun,
): Promise<void> {
  await getDb().indicatorScans.put(run);

  const forFilter = await getDb()
    .indicatorScans.where("filterKey")
    .equals(run.filterKey)
    .sortBy("runAt");

  if (forFilter.length > MAX_RUNS_PER_FILTER) {
    const excess = forFilter.slice(0, forFilter.length - MAX_RUNS_PER_FILTER);
    await Promise.all(
      excess.map((item) => getDb().indicatorScans.delete(item.id)),
    );
  }
}

export async function listIndicatorScanRuns(
  filterKey: string,
  limit = 50,
): Promise<IndicatorScanRun[]> {
  const rows = await getDb()
    .indicatorScans.where("filterKey")
    .equals(filterKey)
    .toArray();
  return rows
    .sort((a, b) => b.runAt.localeCompare(a.runAt))
    .slice(0, limit);
}

export async function getIndicatorScanRun(
  id: string,
): Promise<IndicatorScanRun | undefined> {
  return getDb().indicatorScans.get(id);
}
