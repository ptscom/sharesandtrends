import type { OhlcvBar, PatternDefinition, ScanRun } from "@/lib/types";
import { getPriceBarsBatch } from "@/lib/storage/prices";
import type {
  ScanWorkerRequest,
  ScanWorkerResponse,
} from "@/workers/scan.worker";

export type ScanProgressPhase = "loading" | "scanning";

export interface WorkerScanOptions {
  universe: string[];
  pattern: PatternDefinition;
  minWinRate?: number;
  minTrades?: number;
  signalTodayOnly?: boolean;
  onProgress?: (done: number, total: number, phase: ScanProgressPhase) => void;
}

let worker: Worker | null = null;

function getWorker(): Worker {
  if (typeof window === "undefined") {
    throw new Error("Workers are only available in the browser");
  }
  if (!worker) {
    worker = new Worker(new URL("../../workers/scan.worker.ts", import.meta.url));
  }
  return worker;
}

export async function runUniverseScanInWorker(
  options: WorkerScanOptions,
): Promise<ScanRun> {
  const {
    universe,
    pattern,
    minWinRate = 0,
    minTrades = 1,
    signalTodayOnly = false,
    onProgress,
  } = options;

  const priceData = await getPriceBarsBatch(universe, (done, total) => {
    onProgress?.(done, total, "loading");
  });

  const requestId = crypto.randomUUID();
  const w = getWorker();

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent<ScanWorkerResponse>) => {
      const msg = event.data;
      if (msg.requestId !== requestId) return;

      if (msg.type === "progress") {
        onProgress?.(msg.done, msg.total, "scanning");
        return;
      }

      w.removeEventListener("message", handleMessage);
      w.removeEventListener("error", handleError);

      if (msg.type === "error") {
        reject(new Error(msg.message));
        return;
      }
      resolve(msg.scan);
    };

    const handleError = (event: ErrorEvent) => {
      w.removeEventListener("message", handleMessage);
      w.removeEventListener("error", handleError);
      reject(new Error(event.message || "Worker error"));
    };

    w.addEventListener("message", handleMessage);
    w.addEventListener("error", handleError);

    const payload: ScanWorkerRequest = {
      type: "scan",
      requestId,
      universe,
      priceData,
      pattern,
      minWinRate,
      minTrades,
      signalTodayOnly,
    };
    w.postMessage(payload);
  });
}
