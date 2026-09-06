import type { SymbolInventoryRow } from "@/lib/storage/prices";

export interface StaleSymbolFixPlan {
  referenceLatest: string;
  fetchFrom: string;
  fetchTo: string;
  /** Symbols with some history — one shared date range fetch */
  rangeSymbols: string[];
  /** Symbols with no stored bars — full history download */
  fullDownloadSymbols: string[];
}

export interface StaleSymbolAnalysis {
  referenceLatest: string | null;
  plan: StaleSymbolFixPlan | null;
  staleCount: number;
}

/** Symbols behind the newest To date in the inventory. */
export function findStaleSymbols(
  rows: SymbolInventoryRow[],
): StaleSymbolAnalysis {
  const toDates = rows
    .map((row) => row.toDate)
    .filter((date): date is string => Boolean(date));

  const referenceLatest =
    toDates.length > 0 ? toDates.reduce((a, b) => (a > b ? a : b)) : null;

  if (!referenceLatest) {
    return { referenceLatest: null, plan: null, staleCount: 0 };
  }

  const stale = rows.filter(
    (row) => row.toDate === null || row.toDate < referenceLatest,
  );

  if (stale.length === 0) {
    return { referenceLatest, plan: null, staleCount: 0 };
  }

  const fullDownloadSymbols = stale
    .filter((row) => !row.toDate)
    .map((row) => row.symbol)
    .sort();

  const rangeSymbols = stale
    .filter((row) => row.toDate && row.toDate < referenceLatest)
    .map((row) => row.symbol)
    .sort();

  const staleToDates = stale
    .map((row) => row.toDate)
    .filter((date): date is string => Boolean(date));

  const fetchFrom =
    staleToDates.length > 0
      ? staleToDates.reduce((a, b) => (a < b ? a : b))
      : referenceLatest;

  return {
    referenceLatest,
    staleCount: stale.length,
    plan: {
      referenceLatest,
      fetchFrom,
      fetchTo: referenceLatest,
      rangeSymbols,
      fullDownloadSymbols,
    },
  };
}
