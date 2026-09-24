import type {
  CurrentPriceRow,
  HistoricalPriceRow,
  IntradayPriceRow,
} from "@/lib/upstox/types";

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

/** Normalize Upstox candle timestamp to a stable ISO string for storage keys. */
export function normalizeCandleTimestamp(ts: string | number): string {
  if (typeof ts === "string") {
    if (ts.includes("T")) return ts;
    if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return `${ts}T00:00:00+05:30`;
  }
  let ms = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(ms)) throw new Error("Invalid candle timestamp");
  if (ms < 1e12) ms *= 1000;
  return new Date(ms).toISOString();
}

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

/** Upstox quote payloads may use `|` or `:` in map keys and instrument_token. */
export function normalizeUpstoxInstrumentKey(key: string): string {
  return key.trim().replace(/:/g, "|");
}

export type OhlcQuoteEntry = {
  live_ohlc?: Record<string, unknown>;
  /** Legacy v2 OHLC field (still seen on some responses). */
  ohlc?: Record<string, unknown>;
  prev_ohlc?: Record<string, unknown>;
  last_price?: unknown;
  instrument_token?: string;
};

export function findOhlcQuoteEntry(
  data: Record<string, OhlcQuoteEntry> | undefined,
  instrumentKey: string,
): OhlcQuoteEntry | undefined {
  if (!data) return undefined;
  const direct = data[instrumentKey];
  if (direct) return direct;

  const colonKey = instrumentKey.replace(/\|/g, ":");
  if (colonKey !== instrumentKey && data[colonKey]) return data[colonKey];

  const target = normalizeUpstoxInstrumentKey(instrumentKey);
  for (const [key, entry] of Object.entries(data)) {
    if (normalizeUpstoxInstrumentKey(key) === target) return entry;
    const token = entry?.instrument_token;
    if (token && normalizeUpstoxInstrumentKey(token) === target) return entry;
  }
  return undefined;
}

export function pickLiveOhlcFromQuoteEntry(
  entry: OhlcQuoteEntry | undefined,
): Record<string, unknown> | undefined {
  if (!entry) return undefined;
  const live = entry.live_ohlc;
  if (live && typeof live === "object") return live;
  const legacy = entry.ohlc;
  if (legacy && typeof legacy === "object") return legacy;
  const last = toNullableNumber(entry.last_price);
  if (last === null) return undefined;
  const prevVol = entry.prev_ohlc?.volume;
  return {
    open: last,
    high: last,
    low: last,
    close: last,
    volume: prevVol ?? 0,
  };
}

export function parseIntradayCandle(
  symbol: string,
  intervalMinutes: number,
  candle: unknown,
): IntradayPriceRow | null {
  if (!Array.isArray(candle) || candle.length < 6) return null;
  const [ts, o, h, l, c, v] = candle as UpstoxCandleTuple;
  try {
    const timestamp = normalizeCandleTimestamp(ts);
    return {
      symbol,
      intervalMinutes,
      timestamp,
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
