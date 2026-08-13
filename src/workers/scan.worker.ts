import { runUniverseScanCore } from "@/lib/engine/scanner-core";
import type { OhlcvBar, PatternDefinition } from "@/lib/types";
import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";

export interface ScanWorkerRequest {
  type: "scan";
  requestId: string;
  universe: string[];
  priceData: Record<string, OhlcvBar[]>;
  pattern: PatternDefinition;
  timeframeMode: ExploreTimeframeMode;
  minWinRate: number;
  minTrades: number;
  signalTodayOnly: boolean;
}

export type ScanWorkerResponse =
  | { type: "progress"; requestId: string; done: number; total: number }
  | { type: "done"; requestId: string; scan: ReturnType<typeof runUniverseScanCore> }
  | { type: "error"; requestId: string; message: string };

self.onmessage = (event: MessageEvent<ScanWorkerRequest>) => {
  const msg = event.data;
  if (msg.type !== "scan") return;

  try {
    const { requestId, universe, priceData, pattern, timeframeMode, minWinRate, minTrades, signalTodayOnly } =
      msg;

    // Report loading progress in chunks so UI stays responsive.
    const chunk = Math.max(1, Math.floor(universe.length / 20));
    for (let i = 0; i < universe.length; i += chunk) {
      const done = Math.min(i + chunk, universe.length);
      const response: ScanWorkerResponse = {
        type: "progress",
        requestId,
        done,
        total: universe.length,
      };
      self.postMessage(response);
    }

    const scan = runUniverseScanCore({
      universe,
      priceData,
      pattern,
      timeframeMode,
      minWinRate,
      minTrades,
      signalTodayOnly,
    });

    const done: ScanWorkerResponse = { type: "done", requestId, scan };
    self.postMessage(done);
  } catch (error) {
    const response: ScanWorkerResponse = {
      type: "error",
      requestId: msg.requestId,
      message: error instanceof Error ? error.message : "Scan failed",
    };
    self.postMessage(response);
  }
};
