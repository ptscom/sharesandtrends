import type { FetchJob, FetchJobResult } from "@/lib/data/fetch-prices-client";
import { getPriceBars } from "@/lib/storage/prices";

export interface MissingDataRow {
  symbol: string;
  missing: string;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function addCalendarDays(ymd: string, days: number): string {
  const date = parseYmd(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return formatYmd(date);
}

function nextWeekdayAfter(ymd: string): string {
  let cursor = addCalendarDays(ymd, 1);
  while (!isWeekday(parseYmd(cursor))) {
    cursor = addCalendarDays(cursor, 1);
  }
  return cursor;
}

/** Weekdays inclusive between two YYYY-MM-DD strings. */
export function weekdaysBetween(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    if (isWeekday(parseYmd(cursor))) {
      out.push(cursor);
    }
    cursor = addCalendarDays(cursor, 1);
  }
  return out;
}

export function findMissingWeekdays(
  barDates: Iterable<string>,
  from: string,
  to: string,
): string[] {
  const have = new Set(barDates);
  return weekdaysBetween(from, to).filter((d) => !have.has(d));
}

/** Merge sorted weekday gaps into single dates and ranges for display. */
export function formatMissingDateRanges(dates: string[]): string {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  const parts: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i];
    if (nextWeekdayAfter(rangeEnd) === d) {
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

function spanFromBars(dates: string[]): { from: string; to: string } | null {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return { from: sorted[0], to: sorted[sorted.length - 1] };
}

function checkRangeForJob(
  barDateList: string[],
  from: string,
  to: string,
): string[] {
  return findMissingWeekdays(barDateList, from, to);
}

export async function buildMissingDataReport(
  jobs: FetchJob[],
  results: FetchJobResult[],
): Promise<MissingDataRow[]> {
  const resultBySymbol = new Map(results.map((r) => [r.symbol, r]));
  const rows: MissingDataRow[] = [];

  for (const job of jobs) {
    const result = resultBySymbol.get(job.symbol);
    if (!result || result.error) continue;

    const bars = await getPriceBars(job.symbol);
    const barDates = bars.map((b) => b.date);

    let from: string | undefined;
    let to: string | undefined;

    if (job.options.from && job.options.to) {
      from = job.options.from;
      to = job.options.to;
    } else {
      const span = spanFromBars(barDates);
      if (!span) continue;
      from = span.from;
      to = span.to;
    }

    const missing = checkRangeForJob(barDates, from, to);
    if (missing.length === 0) continue;

    rows.push({
      symbol: job.symbol,
      missing: formatMissingDateRanges(missing),
    });
  }

  rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return rows;
}
