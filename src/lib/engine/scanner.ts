import { v4 as uuidv4 } from "uuid";
import type {
  PatternDefinition,
  ScanResultRow,
  ScanRun,
} from "@/lib/types";
import { getPriceBars } from "@/lib/storage/prices";
import { hasSignalToday, runBacktest } from "./backtest";

export interface ScanOptions {
  universe: string[];
  pattern: PatternDefinition;
  minWinRate?: number;
  minTrades?: number;
  onProgress?: (done: number, total: number) => void;
}

export async function runUniverseScan(
  options: ScanOptions,
): Promise<ScanRun> {
  const { universe, pattern, minWinRate = 0, minTrades = 1, onProgress } =
    options;
  const results: ScanResultRow[] = [];

  for (let i = 0; i < universe.length; i++) {
    const symbol = universe[i];
    onProgress?.(i + 1, universe.length);

    const bars = await getPriceBars(symbol);
    if (bars.length < 60) continue;

    const backtest = runBacktest(symbol, bars, pattern);
    if (backtest.stats.trades < minTrades) continue;
    if (backtest.stats.winRate < minWinRate) continue;

    const { signalToday, signalDate } = hasSignalToday(bars, pattern);
    const lastClose = bars[bars.length - 1]?.close ?? 0;

    results.push({
      symbol,
      signalDate,
      signalToday,
      stats: backtest.stats,
      lastClose,
    });
  }

  results.sort((a, b) => {
    if (a.signalToday !== b.signalToday) return a.signalToday ? -1 : 1;
    return b.stats.winRate - a.stats.winRate;
  });

  return {
    id: uuidv4(),
    patternId: pattern.id ?? "adhoc",
    patternName: pattern.name,
    runAt: new Date().toISOString(),
    universe,
    results,
    filters: { minWinRate, minTrades },
  };
}
