import { runIndicatorScanCore } from "@/lib/explore/indicator-scan";
import type { ExploreIndicatorItem } from "@/lib/explore/indicator-models";
import type { OhlcvBar } from "@/lib/types";

export interface IndicatorScanWorkerRequest {
  type: "indicator-scan";
  requestId: string;
  universe: string[];
  priceData: Record<string, OhlcvBar[]>;
  items: ExploreIndicatorItem[];
}

export type IndicatorScanWorkerResponse =
  | { type: "progress"; requestId: string; done: number; total: number }
  | {
      type: "done";
      requestId: string;
      scan: ReturnType<typeof runIndicatorScanCore>;
    }
  | { type: "error"; requestId: string; message: string };

self.onmessage = (event: MessageEvent<IndicatorScanWorkerRequest>) => {
  const msg = event.data;
  if (msg.type !== "indicator-scan") return;

  try {
    const { requestId, universe, priceData, items } = msg;

    const chunk = Math.max(1, Math.floor(universe.length / 20));
    for (let i = 0; i < universe.length; i += chunk) {
      const done = Math.min(i + chunk, universe.length);
      const response: IndicatorScanWorkerResponse = {
        type: "progress",
        requestId,
        done,
        total: universe.length,
      };
      self.postMessage(response);
    }

    const scan = runIndicatorScanCore({ universe, priceData, items });

    const done: IndicatorScanWorkerResponse = { type: "done", requestId, scan };
    self.postMessage(done);
  } catch (error) {
    const response: IndicatorScanWorkerResponse = {
      type: "error",
      requestId: msg.requestId,
      message: error instanceof Error ? error.message : "Indicator scan failed",
    };
    self.postMessage(response);
  }
};
