import type { OhlcvBar } from "@/lib/types";

export interface FetchBarsOptions {
  range?: string;
  from?: string;
  to?: string;
}

export interface FetchBarsResult {
  symbol: string;
  bars: OhlcvBar[];
  count: number;
  error?: string;
}

export async function fetchPriceBars(
  symbol: string,
  options: FetchBarsOptions = {},
): Promise<FetchBarsResult> {
  const upper = symbol.trim().toUpperCase();
  const params = new URLSearchParams();

  if (options.from && options.to) {
    params.set("from", options.from);
    params.set("to", options.to);
  } else {
    params.set("range", options.range ?? "10y");
  }

  try {
    const res = await fetch(`/api/prices/${upper}?${params}`);
    const data = await res.json();
    if (!res.ok) {
      return {
        symbol: upper,
        bars: [],
        count: 0,
        error: data.error ?? "Failed",
      };
    }
    const bars = data.bars as OhlcvBar[];
    return { symbol: upper, bars, count: bars.length };
  } catch (e) {
    return {
      symbol: upper,
      bars: [],
      count: 0,
      error: e instanceof Error ? e.message : "Failed",
    };
  }
}

export function defaultUpdateFromDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

export function defaultUpdateToDate(): string {
  return new Date().toISOString().slice(0, 10);
}
