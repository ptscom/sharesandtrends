import type { IndicatorScanRun } from "@/lib/explore/exploration-models";

export interface ConsolidatedExplorationRow {
  scanId: string;
  filterKey: string;
  filterName: string;
  filterDescription: string;
  matchCount: number;
}

export interface ConsolidatedExplorationSummary {
  rows: ConsolidatedExplorationRow[];
  totalMatches: number;
  uniqueSymbolCount: number;
  overlapCount: number;
  overlapSymbols: string[];
}

export function buildConsolidatedSummary(
  runs: IndicatorScanRun[],
): ConsolidatedExplorationSummary {
  const symbolToExplorations = new Map<string, number>();

  const rows = runs.map((run) => {
    for (const row of run.results) {
      symbolToExplorations.set(
        row.symbol,
        (symbolToExplorations.get(row.symbol) ?? 0) + 1,
      );
    }
    return {
      scanId: run.id,
      filterKey: run.filterKey,
      filterName: run.filterName,
      filterDescription: run.filterDescription,
      matchCount: run.results.length,
    };
  });

  const overlapSymbols = [...symbolToExplorations.entries()]
    .filter(([, count]) => count > 1)
    .map(([symbol]) => symbol)
    .sort();

  return {
    rows,
    totalMatches: rows.reduce((sum, row) => sum + row.matchCount, 0),
    uniqueSymbolCount: symbolToExplorations.size,
    overlapCount: overlapSymbols.length,
    overlapSymbols,
  };
}
