const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isValidYmd(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function clampToToday(ymd: string): string {
  const today = todayYmd();
  return ymd > today ? today : ymd;
}

export type HistoricalPreset =
  | "1m"
  | "1y"
  | "5y"
  | "10y"
  | "custom";

export function rangeFromPreset(
  preset: HistoricalPreset,
  customFrom?: string,
  customTo?: string,
): { fromDate: string; toDate: string; error?: string } {
  const toDate = clampToToday(customTo ?? todayYmd());
  if (preset === "custom") {
    if (!customFrom || !customTo) {
      return { fromDate: "", toDate: "", error: "Custom range requires from and to dates." };
    }
    if (!isValidYmd(customFrom) || !isValidYmd(customTo)) {
      return { fromDate: "", toDate: "", error: "Dates must use YYYY-MM-DD." };
    }
    const fromDate = customFrom;
    const to = clampToToday(customTo);
    if (fromDate > to) {
      return { fromDate: "", toDate: "", error: "From date must be on or before to date." };
    }
    return { fromDate, toDate: to };
  }

  const end = new Date(`${toDate}T12:00:00Z`);
  const start = new Date(end);
  if (preset === "1m") {
    start.setUTCMonth(start.getUTCMonth() - 1);
  } else if (preset === "1y") {
    start.setUTCFullYear(start.getUTCFullYear() - 1);
  } else if (preset === "5y") {
    start.setUTCFullYear(start.getUTCFullYear() - 5);
  } else if (preset === "10y") {
    start.setUTCFullYear(start.getUTCFullYear() - 10);
  }
  const fromDate = start.toISOString().slice(0, 10);
  if (fromDate > toDate) {
    return { fromDate: "", toDate: "", error: "Invalid date range." };
  }
  return { fromDate, toDate };
}

/** Split [from, to] into ≤10-year chunks (non-overlapping, ascending). */
export function splitHistoricalChunks(
  fromDate: string,
  toDate: string,
): Array<{ fromDate: string; toDate: string }> {
  const chunks: Array<{ fromDate: string; toDate: string }> = [];
  let cursorFrom = fromDate;
  while (cursorFrom <= toDate) {
    const start = parseYmd(cursorFrom);
    const maxEnd = new Date(start);
    maxEnd.setUTCFullYear(maxEnd.getUTCFullYear() + 10);
    maxEnd.setUTCDate(maxEnd.getUTCDate() - 1);
    let chunkTo = formatYmd(maxEnd);
    if (chunkTo > toDate) chunkTo = toDate;
    chunks.push({ fromDate: cursorFrom, toDate: chunkTo });
    if (chunkTo >= toDate) break;
    const next = parseYmd(chunkTo);
    next.setUTCDate(next.getUTCDate() + 1);
    cursorFrom = formatYmd(next);
  }
  return chunks;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type IntradayPreset = "5d" | "1m" | "custom";

export const INTRADAY_INTERVAL_OPTIONS = [1, 5, 15, 30] as const;

/** Upstox V3 max calendar span per request for minute candles. */
export function maxDaysPerIntradayRequest(intervalMinutes: number): number {
  return intervalMinutes <= 15 ? 31 : 92;
}

export function rangeFromIntradayPreset(
  preset: IntradayPreset,
  customFrom?: string,
  customTo?: string,
): { fromDate: string; toDate: string; error?: string } {
  const toDate = clampToToday(customTo ?? todayYmd());
  if (preset === "custom") {
    if (!customFrom || !customTo) {
      return { fromDate: "", toDate: "", error: "Custom range requires from and to dates." };
    }
    if (!isValidYmd(customFrom) || !isValidYmd(customTo)) {
      return { fromDate: "", toDate: "", error: "Dates must use YYYY-MM-DD." };
    }
    const fromDate = customFrom;
    const to = clampToToday(customTo);
    if (fromDate > to) {
      return { fromDate: "", toDate: "", error: "From date must be on or before to date." };
    }
    return { fromDate, toDate: to };
  }

  const end = parseYmd(toDate);
  const start = new Date(end);
  if (preset === "5d") {
    start.setUTCDate(start.getUTCDate() - 4);
  } else if (preset === "1m") {
    start.setUTCMonth(start.getUTCMonth() - 1);
  }
  const fromDate = formatYmd(start);
  if (fromDate > toDate) {
    return { fromDate: "", toDate: "", error: "Invalid date range." };
  }
  return { fromDate, toDate };
}

/** Split [from, to] into chunks within Upstox intraday minute limits. */
export function splitIntradayMinuteChunks(
  fromDate: string,
  toDate: string,
  intervalMinutes: number,
): Array<{ fromDate: string; toDate: string }> {
  const maxSpanDays = maxDaysPerIntradayRequest(intervalMinutes);
  const chunks: Array<{ fromDate: string; toDate: string }> = [];
  let cursorFrom = fromDate;
  while (cursorFrom <= toDate) {
    const start = parseYmd(cursorFrom);
    const maxEnd = new Date(start);
    maxEnd.setUTCDate(maxEnd.getUTCDate() + maxSpanDays - 1);
    let chunkTo = formatYmd(maxEnd);
    if (chunkTo > toDate) chunkTo = toDate;
    chunks.push({ fromDate: cursorFrom, toDate: chunkTo });
    if (chunkTo >= toDate) break;
    const next = parseYmd(chunkTo);
    next.setUTCDate(next.getUTCDate() + 1);
    cursorFrom = formatYmd(next);
  }
  return chunks;
}
