import { loadSessionTokens } from "@/lib/upstox/client-tokens";
import type { HistoricalJob, UpstoxDataError, UpstoxDataResponse } from "@/lib/upstox/types";
import type { HistoricalPriceRow } from "@/lib/upstox/types";
import {
  mergeHistoricalRows,
  saveHistoricalJob,
} from "@/lib/storage/upstox-historical";
import { v4 as uuidv4 } from "uuid";

/**
 * Parallel browser → server jobs. Upstox rate limits are enforced on the
 * server via shared per-token limiters (10/s, 500/min, 2000/30min caps).
 */
export const HISTORICAL_CLIENT_CONCURRENCY = 12;

/** Symbols per HTTP request — server parallelizes across token lanes. */
export const HISTORICAL_SYMBOLS_PER_REQUEST = 5;

export type JobProgress = {
  total: number;
  completed: number;
  remaining: number;
  successful: number;
  failed: number;
  activeLanes: number;
  percent: number;
  stopped: boolean;
};

async function postHistorical(
  symbols: string[],
  fromDate: string,
  toDate: string,
): Promise<UpstoxDataResponse<HistoricalPriceRow>> {
  const accessTokens = loadSessionTokens();
  const res = await fetch("/api/upstox/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "historical",
      symbols,
      fromDate,
      toDate,
      accessTokens: accessTokens.length > 0 ? accessTokens : undefined,
    }),
  });
  return res.json();
}

export function pendingSymbols(job: HistoricalJob): string[] {
  const done = new Set(job.completedSymbols);
  const failed = new Set(job.failedSymbols.map((f) => f.symbol));
  return job.symbols.filter((s) => !done.has(s) && !failed.has(s));
}

export function retryableFailedSymbols(job: HistoricalJob): string[] {
  return job.failedSymbols.filter((f) => f.retryable).map((f) => f.symbol);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function runHistoricalJob(
  job: HistoricalJob,
  options: {
    symbols?: string[];
    onProgress?: (progress: JobProgress, job: HistoricalJob) => void;
    shouldStop?: () => boolean;
    concurrency?: number;
    symbolsPerRequest?: number;
  },
): Promise<HistoricalJob> {
  const symbolList =
    options.symbols ??
    pendingSymbols(job).concat(retryableFailedSymbols(job));
  const uniqueQueue = [...new Set(symbolList)];
  const batches = chunk(uniqueQueue, options.symbolsPerRequest ?? HISTORICAL_SYMBOLS_PER_REQUEST);
  const concurrency = options.concurrency ?? HISTORICAL_CLIENT_CONCURRENCY;

  let activeLanes = 1;
  let batchIndex = 0;

  const updateJob = async () => {
    job.updatedAt = new Date().toISOString();
    await saveHistoricalJob(job);
    options.onProgress?.(computeProgress(job, activeLanes), job);
  };

  const processBatch = async (symbols: string[]) => {
    if (options.shouldStop?.()) return;
    const response = await postHistorical(symbols, job.fromDate, job.toDate);
    activeLanes = response.activeLanes ?? activeLanes;

    if (response.errors.some((e) => e.symbol === "*") && response.rows.length === 0) {
      for (const symbol of symbols) {
        const err = response.errors.find((e) => e.symbol === symbol || e.symbol === "*");
        if (!err) continue;
        job.failedSymbols = job.failedSymbols.filter((f) => f.symbol !== symbol);
        job.failedSymbols.push({
          symbol,
          message: err.message,
          retryable: err.retryable,
          stage: err.stage,
        });
      }
      await updateJob();
      return;
    }

    if (response.rows.length > 0) {
      await mergeHistoricalRows(response.rows);
    }

    for (const symbol of symbols) {
      const symbolErrors = response.errors.filter((e) => e.symbol === symbol);
      const hasRows = response.rows.some((r) => r.symbol === symbol);
      if (!hasRows && symbolErrors.length > 0) {
        job.failedSymbols = job.failedSymbols.filter((f) => f.symbol !== symbol);
        job.failedSymbols.push({
          symbol: symbolErrors[0].symbol === "*" ? symbol : symbolErrors[0].symbol,
          message: symbolErrors[0].message,
          retryable: symbolErrors[0].retryable,
          stage: symbolErrors[0].stage,
        });
      } else if (hasRows) {
        if (!job.completedSymbols.includes(symbol)) {
          job.completedSymbols.push(symbol);
        }
        job.failedSymbols = job.failedSymbols.filter((f) => f.symbol !== symbol);
        for (const err of symbolErrors) {
          job.failedSymbols.push({
            symbol,
            message: err.message,
            retryable: err.retryable,
            stage: err.stage,
          });
        }
      }
    }
    await updateJob();
  };

  const workers = Array.from({ length: concurrency }, async () => {
    while (batchIndex < batches.length) {
      if (options.shouldStop?.()) {
        job.stopped = true;
        break;
      }
      const current = batchIndex;
      batchIndex += 1;
      if (current >= batches.length) break;
      await processBatch(batches[current]);
    }
  });

  await Promise.all(workers);

  if (options.shouldStop?.()) {
    job.stopped = true;
  }

  const stillPending = pendingSymbols(job);
  const retryable = retryableFailedSymbols(job);
  job.complete = stillPending.length === 0 && retryable.length === 0 && !job.stopped;
  await updateJob();
  return job;
}

export function computeProgress(job: HistoricalJob, activeLanes: number): JobProgress {
  const failed = job.failedSymbols.length;
  const completed = job.completedSymbols.length;
  const total = job.symbols.length;
  const remaining = Math.max(0, total - completed);
  return {
    total,
    completed,
    remaining,
    successful: completed,
    failed,
    activeLanes,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    stopped: Boolean(job.stopped),
  };
}

export function createHistoricalJob(
  symbols: string[],
  fromDate: string,
  toDate: string,
): HistoricalJob {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    mode: "historical",
    symbols,
    completedSymbols: [],
    failedSymbols: [],
    fromDate,
    toDate,
    createdAt: now,
    updatedAt: now,
    complete: false,
  };
}

export function collectJobErrors(job: HistoricalJob): UpstoxDataError[] {
  return job.failedSymbols.map((f) => ({
    symbol: f.symbol,
    stage: f.stage ?? "historical",
    message: f.message,
    retryable: f.retryable,
  }));
}
