import type { CurrentPriceRow, HistoricalPriceRow } from "@/lib/upstox/types";

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function parseSymbolList(raw: string): string[] {
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const sym = normalizeSymbol(part);
    if (!seen.has(sym)) {
      seen.add(sym);
      out.push(sym);
    }
  }
  return out;
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Upstox daily candle timestamp → YYYY-MM-DD in Asia/Kolkata. */
export function parseUpstoxCandleDate(timestamp: string | number): string {
  let ms: number;
  if (typeof timestamp === "string") {
    const dateOnly = timestamp.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) && !timestamp.includes("T")) {
      return dateOnly;
    }
    if (timestamp.includes("T")) {
      const ist = new Date(timestamp);
      if (!Number.isNaN(ist.getTime())) {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(ist);
      }
    }
    ms = Number(timestamp);
  } else {
    ms = timestamp;
  }
  if (!Number.isFinite(ms)) {
    throw new Error("Invalid candle timestamp");
  }
  if (ms < 1e12) ms *= 1000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export type UpstoxCandleTuple = [
  string | number,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown?,
];

export function parseHistoricalCandle(
  symbol: string,
  candle: unknown,
): HistoricalPriceRow | null {
  if (!Array.isArray(candle) || candle.length < 6) return null;
  const [ts, o, h, l, c, v] = candle as UpstoxCandleTuple;
  try {
    const date = parseUpstoxCandleDate(ts);
    return {
      symbol,
      date,
      open: toNullableNumber(o),
      high: toNullableNumber(h),
      low: toNullableNumber(l),
      close: toNullableNumber(c),
      volume: toNullableNumber(v),
    };
  } catch {
    return null;
  }
}

export function parseLiveOhlc(
  symbol: string,
  live: Record<string, unknown> | undefined,
): CurrentPriceRow {
  const o = live?.open;
  const h = live?.high;
  const l = live?.low;
  const c = live?.close;
  const v = live?.volume;
  return {
    symbol,
    open: toNullableNumber(o),
    high: toNullableNumber(h),
    low: toNullableNumber(l),
    close: toNullableNumber(c),
    volume: toNullableNumber(v),
  };
}
