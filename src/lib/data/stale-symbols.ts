import type { SymbolInventoryRow } from "@/lib/storage/prices";

export interface StaleSymbolJob {
  symbol: string;
  currentToDate: string | null;
  fetchFrom: string;
  fetchTo: string;
  fullDownload: boolean;
}

export interface StaleSymbolAnalysis {
  referenceLatest: string | null;
  stale: StaleSymbolJob[];
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Symbols whose last bar is before the newest date in the inventory. */
export function findStaleSymbols(
  rows: SymbolInventoryRow[],
): StaleSymbolAnalysis {
  const toDates = rows
    .map((row) => row.toDate)
    .filter((date): date is string => Boolean(date));

  const referenceLatest =
    toDates.length > 0 ? toDates.reduce((a, b) => (a > b ? a : b)) : null;

  if (!referenceLatest) {
    return { referenceLatest: null, stale: [] };
  }

  const stale: StaleSymbolJob[] = [];

  for (const row of rows) {
    if (!row.toDate) {
      stale.push({
        symbol: row.symbol,
        currentToDate: null,
        fetchFrom: "",
        fetchTo: referenceLatest,
        fullDownload: true,
      });
      continue;
    }

    if (row.toDate >= referenceLatest) continue;

    const fetchFrom = addDays(row.toDate, 1);
    if (fetchFrom > referenceLatest) continue;

    stale.push({
      symbol: row.symbol,
      currentToDate: row.toDate,
      fetchFrom,
      fetchTo: referenceLatest,
      fullDownload: false,
    });
  }

  return {
    referenceLatest,
    stale: stale.sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}
