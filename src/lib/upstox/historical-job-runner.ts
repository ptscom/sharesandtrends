import { loadSessionTokens } from "@/lib/upstox/client-tokens";
import type { HistoricalJob, UpstoxDataError, UpstoxDataResponse } from "@/lib/upstox/types";
import {
  mergeHistoricalRows,
  saveHistoricalJob,
} from "@/lib/storage/upstox-historical";
import { v4 as uuidv4 } from "uuid";

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
  symbol: string,
  fromDate: string,
  toDate: string,
): Promise<UpstoxDataResponse<import("@/lib/upstox/types").HistoricalPriceRow>> {
  const accessTokens = loadSessionTokens();
  const res = await fetch("/api/upstox/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "historical",
      symbols: [symbol],
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

export async function runHistoricalJob(
  job: HistoricalJob,
  options: {
    symbols?: string[];
    onProgress?: (progress: JobProgress, job: HistoricalJob) => void;
    shouldStop?: () => boolean;
  },
): Promise<HistoricalJob> {
  const queue =
    options.symbols ??
    pendingSymbols(job).concat(retryableFailedSymbols(job));
  const uniqueQueue = [...new Set(queue)];

  let activeLanes = 1;
  const updateJob = async (patch: Partial<HistoricalJob>) => {
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    await saveHistoricalJob(job);
    options.onProgress?.(computeProgress(job, activeLanes), job);
  };

  for (const symbol of uniqueQueue) {
    if (options.shouldStop?.()) {
      job.stopped = true;
      await updateJob({});
      break;
    }

    const response = await postHistorical(symbol, job.fromDate, job.toDate);
    activeLanes = response.activeLanes ?? activeLanes;

    const symbolErrors = response.errors.filter((e) => e.symbol === symbol || e.symbol === "*");
    if (symbolErrors.length > 0 && response.rows.length === 0) {
      const err = symbolErrors[0];
      job.failedSymbols = job.failedSymbols.filter((f) => f.symbol !== symbol);
      job.failedSymbols.push({
        symbol,
        message: err.message,
        retryable: err.retryable,
        stage: err.stage,
      });
    } else {
      await mergeHistoricalRows(response.rows);
      if (!job.completedSymbols.includes(symbol)) {
        job.completedSymbols.push(symbol);
      }
      job.failedSymbols = job.failedSymbols.filter((f) => f.symbol !== symbol);
      for (const err of symbolErrors) {
        if (err.symbol === symbol) {
          job.failedSymbols.push({
            symbol,
            message: err.message,
            retryable: err.retryable,
            stage: err.stage,
          });
        }
      }
    }

    await updateJob({});
  }

  const stillPending = pendingSymbols(job);
  const retryable = retryableFailedSymbols(job);
  job.complete = stillPending.length === 0 && retryable.length === 0 && !job.stopped;
  await updateJob({});
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
