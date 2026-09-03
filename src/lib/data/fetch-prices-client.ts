import { mergePriceBars } from "@/lib/storage/prices";
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

export interface FetchJobResult {
  symbol: string;
  count: number;
  error?: string;
}

export interface FetchJob {
  symbol: string;
  options: FetchBarsOptions;
}

const DEFAULT_CONCURRENCY = 4;
const BATCH_DELAY_MS = 100;

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
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
}

export function defaultUpdateToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function runFetchJobs(
  jobs: FetchJob[],
  options?: {
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<FetchJobResult[]> {
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const results: FetchJobResult[] = new Array(jobs.length);
  let done = 0;

  const runOne = async (job: FetchJob, index: number) => {
    const fetched = await fetchPriceBars(job.symbol, job.options);
    if (fetched.error) {
      results[index] = { symbol: fetched.symbol, count: 0, error: fetched.error };
      return;
    }
    await mergePriceBars(job.symbol, fetched.bars);
    results[index] = { symbol: fetched.symbol, count: fetched.count };
  };

  for (let i = 0; i < jobs.length; i += concurrency) {
    const batch = jobs.slice(i, i + concurrency);
    await Promise.all(
      batch.map((job, batchIndex) => runOne(job, i + batchIndex)),
    );
    done = Math.min(i + batch.length, jobs.length);
    options?.onProgress?.(done, jobs.length);
    if (i + concurrency < jobs.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return results;
}
