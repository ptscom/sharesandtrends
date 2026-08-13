import { v4 as uuidv4 } from "uuid";
import type {
  OhlcvBar,
  PatternDefinition,
  ScanResultRow,
  ScanRun,
} from "@/lib/types";
import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";
import {
  minBarsForScanMode,
  prepareScanBarsAndPattern,
} from "@/lib/engine/scan-timeframe";
import { hasSignalToday, runBacktest } from "./backtest";

export interface ScanCoreOptions {
  universe: string[];
  priceData: Record<string, OhlcvBar[]>;
  pattern: PatternDefinition;
  timeframeMode?: ExploreTimeframeMode;
  minWinRate?: number;
  minTrades?: number;
  signalTodayOnly?: boolean;
}

export function runUniverseScanCore(options: ScanCoreOptions): ScanRun {
  const {
    universe,
    priceData,
    pattern,
    timeframeMode = "1D",
    minWinRate = 0,
    minTrades = 1,
    signalTodayOnly = false,
  } = options;

  const minBars = minBarsForScanMode(timeframeMode);
  const results: ScanResultRow[] = [];

  for (const symbol of universe) {
    const dailyBars = priceData[symbol];
    if (!dailyBars || dailyBars.length < minBars) continue;

    const { bars, pattern: scanPattern } = prepareScanBarsAndPattern(
      dailyBars,
      pattern,
      timeframeMode,
    );
    if (bars.length < minBars) continue;

    const backtest = runBacktest(symbol, bars, scanPattern);
    if (backtest.stats.trades < minTrades) continue;
    if (backtest.stats.winRate < minWinRate) continue;

    const { signalToday, signalDate } = hasSignalToday(bars, scanPattern);
    if (signalTodayOnly && !signalToday) continue;

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
    filters: { minWinRate, minTrades, signalTodayOnly },
  };
}
