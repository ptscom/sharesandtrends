import { v4 as uuidv4 } from "uuid";
import type { OhlcvBar, PatternDefinition } from "@/lib/types";
import { hasSignalToday, runBacktest } from "@/lib/engine/backtest";
import { prepareScanBarsAndPattern } from "@/lib/engine/scan-timeframe";
import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";
import type {
  HorizonStats,
  IndicatorScanResultRow,
  IndicatorScanRun,
} from "@/lib/explore/exploration-models";

function backtestHorizonStats(
  bars: OhlcvBar[],
  pattern: PatternDefinition,
  holdDays: number,
): HorizonStats {
  const result = runBacktest("", bars, {
    ...pattern,
    backtest: {
      entryOn: pattern.backtest.entryOn,
      exitOn: "fixed_hold",
      holdDays,
    },
  });
  return {
    avgReturnPct: result.stats.avgReturnPct,
    winRate: result.stats.winRate,
    trades: result.stats.trades,
  };
}

function backtestHorizons(
  bars: OhlcvBar[],
  pattern: PatternDefinition,
): IndicatorScanResultRow["horizons"] {
  return {
    d3: backtestHorizonStats(bars, pattern, 3),
    d5: backtestHorizonStats(bars, pattern, 5),
    d10: backtestHorizonStats(bars, pattern, 10),
  };
}

export interface IndicatorScanCoreOptions {
  universe: string[];
  priceData: Record<string, OhlcvBar[]>;
  pattern: PatternDefinition;
  filterKey: string;
  filterName: string;
  filterDescription: string;
  timeframeMode: ExploreTimeframeMode;
}

function scanPatternForUniverse(
  universe: string[],
  priceData: Record<string, OhlcvBar[]>,
  pattern: PatternDefinition,
  timeframeMode: ExploreTimeframeMode,
): IndicatorScanResultRow[] {
  const tfMode: ExploreTimeframeMode =
    timeframeMode === "mtf" ? "1D" : timeframeMode;

  const results: IndicatorScanResultRow[] = [];

  for (const symbol of universe) {
    const dailyBars = priceData[symbol];
    if (!dailyBars || dailyBars.length < 30) continue;

    const { bars, pattern: scanPattern } = prepareScanBarsAndPattern(
      dailyBars,
      pattern,
      tfMode,
    );
    if (bars.length < 10) continue;

    const { signalToday, signalDate } = hasSignalToday(bars, scanPattern);
    if (!signalToday) continue;

    results.push({
      symbol,
      signalDate,
      signalToday,
      lastClose: bars[bars.length - 1]?.close ?? 0,
      horizons: backtestHorizons(bars, scanPattern),
    });
  }

  results.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return results;
}

export function runIndicatorScanCore(
  options: IndicatorScanCoreOptions,
): IndicatorScanRun {
  const {
    universe,
    priceData,
    pattern,
    filterKey,
    filterName,
    filterDescription,
    timeframeMode,
  } = options;

  const results = scanPatternForUniverse(
    universe,
    priceData,
    pattern,
    timeframeMode,
  );

  return {
    id: uuidv4(),
    runAt: new Date().toISOString(),
    filterKey: options.filterKey,
    universe,
    filterName,
    filterDescription,
    timeframeMode,
    results,
  };
}
