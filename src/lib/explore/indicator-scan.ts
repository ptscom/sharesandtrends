import { v4 as uuidv4 } from "uuid";
import type { OhlcvBar } from "@/lib/types";
import { hasSignalToday } from "@/lib/engine/backtest";
import { prepareScanBarsAndPattern } from "@/lib/engine/scan-timeframe";
import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";
import {
  indicatorItemToPattern,
  type ExploreIndicatorItem,
  type IndicatorScanGroup,
  type IndicatorScanResultRow,
  type IndicatorScanRun,
} from "@/lib/explore/indicator-models";

export interface IndicatorScanCoreOptions {
  universe: string[];
  priceData: Record<string, OhlcvBar[]>;
  items: ExploreIndicatorItem[];
}

function scanItemForUniverse(
  universe: string[],
  priceData: Record<string, OhlcvBar[]>,
  item: ExploreIndicatorItem,
): IndicatorScanResultRow[] {
  const pattern = indicatorItemToPattern(item);
  const tfMode: ExploreTimeframeMode =
    item.timeframeMode === "mtf" ? "1D" : item.timeframeMode;

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
    });
  }

  results.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return results;
}

export function runIndicatorScanCore(
  options: IndicatorScanCoreOptions,
): IndicatorScanRun {
  const { universe, priceData, items } = options;
  const enabled = items.filter((item) => item.enabled);

  const groups: IndicatorScanGroup[] = enabled.map((item) => ({
    itemId: item.id,
    itemName: item.name,
    timeframeMode: item.timeframeMode,
    results: scanItemForUniverse(universe, priceData, item),
  }));

  return {
    id: uuidv4(),
    runAt: new Date().toISOString(),
    universe,
    groups,
  };
}
