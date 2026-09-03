import type { SymbolInventoryRow } from "@/lib/storage/prices";
import { todayDateString } from "@/lib/data/fetch-prices-client";

export interface StaleSymbolJob {
  symbol: string;
  currentToDate: string | null;
  fetchFrom: string;
  fetchTo: string;
  /** Full history download when no bars exist */
  fullDownload: boolean;
}

export interface StaleSymbolAnalysis {
  referenceLatest: string | null;
  fetchTo: string;
  stale: StaleSymbolJob[];
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function findStaleSymbols(
  rows: SymbolInventoryRow[],
): StaleSymbolAnalysis {
  const toDates = rows
    .map((row) => row.toDate)
    .filter((date): date is string => Boolean(date));

  const referenceLatest =
    toDates.length > 0 ? toDates.reduce((a, b) => (a > b ? a : b)) : null;
  const fetchTo = referenceLatest
    ? referenceLatest > todayDateString()
      ? referenceLatest
      : todayDateString()
    : todayDateString();

  if (!referenceLatest) {
    return { referenceLatest: null, fetchTo, stale: [] };
  }

  const stale: StaleSymbolJob[] = [];

  for (const row of rows) {
    if (!row.toDate) {
      stale.push({
        symbol: row.symbol,
        currentToDate: null,
        fetchFrom: "",
        fetchTo,
        fullDownload: true,
      });
      continue;
    }

    if (row.toDate >= referenceLatest) continue;

    const fetchFrom = addDays(row.toDate, 1);
    if (fetchFrom > fetchTo) continue;

    stale.push({
      symbol: row.symbol,
      currentToDate: row.toDate,
      fetchFrom,
      fetchTo,
      fullDownload: false,
    });
  }

  return {
    referenceLatest,
    fetchTo,
    stale: stale.sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}
