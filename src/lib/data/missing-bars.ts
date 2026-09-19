import type { FetchJob, FetchJobResult } from "@/lib/data/fetch-prices-client";
import { getPriceBars } from "@/lib/storage/prices";

export const MISSING_DATA_LOOKBACK_DAYS = 30;

export interface MissingDataRow {
  symbol: string;
  missing: string;
  /** Bars in the lookback window (for optional UI). */
  barCount: number;
  referenceBarCount: number;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function addCalendarDays(ymd: string, days: number): string {
  const date = parseYmd(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** True if `next` follows `end` with only weekends between (trading-calendar style). */
function datesConnectForRange(end: string, next: string): boolean {
  let cursor = end;
  while (cursor < next) {
    cursor = addCalendarDays(cursor, 1);
    if (cursor === next) return true;
    if (isWeekday(parseYmd(cursor))) return false;
  }
  return false;
}

/** Merge sorted dates into single dates and ranges for display. */
export function formatMissingDateRanges(dates: string[]): string {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  const parts: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i];
    if (datesConnectForRange(rangeEnd, d)) {
      rangeEnd = d;
      continue;
    }
    parts.push(rangeStart === rangeEnd ? rangeStart : `${rangeStart} – ${rangeEnd}`);
    rangeStart = d;
    rangeEnd = d;
  }
  parts.push(rangeStart === rangeEnd ? rangeStart : `${rangeStart} – ${rangeEnd}`);
  return parts.join(", ");
}

export function lookbackWindow(
  lookbackDays = MISSING_DATA_LOOKBACK_DAYS,
  asOf = new Date(),
): { from: string; to: string } {
  const to = asOf.toISOString().slice(0, 10);
  const fromDate = new Date(asOf);
  fromDate.setDate(fromDate.getDate() - lookbackDays);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

function datesInWindow(dates: string[], from: string, to: string): string[] {
  return dates.filter((d) => d >= from && d <= to);
}

/**
 * Compare symbols from a fetch batch over the last N days: build a reference
 * calendar from symbols with the most bars, then flag dates others lack.
 */
export async function buildMissingDataReport(
  jobs: FetchJob[],
  results: FetchJobResult[],
  options?: { lookbackDays?: number },
): Promise<MissingDataRow[]> {
  const lookbackDays = options?.lookbackDays ?? MISSING_DATA_LOOKBACK_DAYS;
  const { from, to } = lookbackWindow(lookbackDays);

  const resultBySymbol = new Map(results.map((r) => [r.symbol, r]));
  const symbols = jobs
    .map((j) => j.symbol)
    .filter((symbol) => {
      const result = resultBySymbol.get(symbol);
      return result && !result.error;
    });

  if (symbols.length < 2) {
    return [];
  }

  const windowDatesBySymbol = new Map<string, Set<string>>();

  for (const symbol of symbols) {
    const bars = await getPriceBars(symbol);
    const inWindow = datesInWindow(bars.map((b) => b.date), from, to);
    windowDatesBySymbol.set(symbol, new Set(inWindow));
  }

  const counts = symbols.map((s) => windowDatesBySymbol.get(s)!.size);
  const referenceBarCount = Math.max(...counts);
  if (referenceBarCount === 0) {
    return [];
  }

  const referenceDates = new Set<string>();
  for (const symbol of symbols) {
    if (windowDatesBySymbol.get(symbol)!.size !== referenceBarCount) continue;
    for (const d of windowDatesBySymbol.get(symbol)!) {
      referenceDates.add(d);
    }
  }

  const rows: MissingDataRow[] = [];

  for (const symbol of symbols) {
    const have = windowDatesBySymbol.get(symbol)!;
    const missing = [...referenceDates].filter((d) => !have.has(d)).sort();
    if (missing.length === 0) continue;

    rows.push({
      symbol,
      missing: formatMissingDateRanges(missing),
      barCount: have.size,
      referenceBarCount,
    });
  }

  rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return rows;
}
