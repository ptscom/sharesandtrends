import type { OhlcvBar } from "@/lib/types";
import { getPriceBarsBatch } from "@/lib/storage/prices";
import type { ExploreIndicatorItem, IndicatorScanRun } from "@/lib/explore/indicator-models";
import type { ScanProgressPhase } from "@/lib/engine/scan-worker-client";

export interface IndicatorWorkerScanOptions {
  universe: string[];
  items: ExploreIndicatorItem[];
  onProgress?: (done: number, total: number, phase: ScanProgressPhase) => void;
}

let worker: Worker | null = null;

function getWorker(): Worker {
  if (typeof window === "undefined") {
    throw new Error("Workers are only available in the browser");
  }
  if (!worker) {
    worker = new Worker(
      new URL("../../workers/indicator-scan.worker.ts", import.meta.url),
    );
  }
  return worker;
}

export async function runIndicatorScanInWorker(
  options: IndicatorWorkerScanOptions,
): Promise<IndicatorScanRun> {
  const { universe, items, onProgress } = options;

  const priceData = await getPriceBarsBatch(universe, (done, total) => {
    if (done < total) {
      onProgress?.(done, total, "loading");
    }
  });

  const requestId = crypto.randomUUID();
  const w = getWorker();

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
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

    w.postMessage({
      type: "indicator-scan",
      requestId,
      universe,
      priceData,
      items,
    });
  });
}
