import type { PatternDefinition, ScanRun } from "@/lib/types";
import { getPriceBars } from "@/lib/storage/prices";
import { runUniverseScanCore } from "./scanner-core";

export interface ScanOptions {
  universe: string[];
  pattern: PatternDefinition;
  minWinRate?: number;
  minTrades?: number;
  signalTodayOnly?: boolean;
  onProgress?: (done: number, total: number) => void;
}

/** Synchronous scan on main thread — prefer runUniverseScanInWorker for large universes. */
export async function runUniverseScan(options: ScanOptions): Promise<ScanRun> {
  const {
    universe,
    pattern,
    minWinRate = 0,
    minTrades = 1,
    signalTodayOnly = false,
    onProgress,
  } = options;

  const priceData: Record<string, import("@/lib/types").OhlcvBar[]> = {};

  for (let i = 0; i < universe.length; i++) {
    const symbol = universe[i]!;
    onProgress?.(i + 1, universe.length);
    const bars = await getPriceBars(symbol);
    if (bars.length > 0) priceData[symbol] = bars;
  }

  return runUniverseScanCore({
    universe,
    priceData,
    pattern,
    minWinRate,
    minTrades,
    signalTodayOnly,
  });
}
