import { computeIndicators } from "@/lib/engine/indicators";
import { evaluateOptional, evaluateSeries } from "@/lib/engine/evaluate";
import { prepareScanBarsAndPattern } from "@/lib/engine/scan-timeframe";
import type { HorizonStats } from "@/lib/explore/exploration-models";
import type { HorizonKey } from "@/lib/explore/exploration-snapshot";
import type { OhlcvBar, PatternDefinition } from "@/lib/types";
import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";

const HORIZON_DAYS: Record<HorizonKey, number> = {
  d3: 3,
  d5: 5,
  d10: 10,
};

export interface ExplorationHorizonReturn {
  returnPct: number | null;
  exitDate: string | null;
}

export interface ExplorationEvent {
  signalDate: string;
  entryPrice: number;
  horizons: Record<HorizonKey, ExplorationHorizonReturn>;
}

export interface ExplorationSymbolHistory {
  events: ExplorationEvent[];
  horizons: {
    d3: HorizonStats;
    d5: HorizonStats;
    d10: HorizonStats;
  };
}

function forwardReturn(
  bars: OhlcvBar[],
  entryIndex: number,
  holdDays: number,
): ExplorationHorizonReturn {
  const exitIndex = entryIndex + holdDays;
  if (exitIndex >= bars.length) {
    return { returnPct: null, exitDate: null };
  }

  const entryPrice = bars[entryIndex]!.close;
  const exitPrice = bars[exitIndex]!.close;
  return {
    returnPct: ((exitPrice - entryPrice) / entryPrice) * 100,
    exitDate: bars[exitIndex]!.date,
  };
}

function isRisingSignal(
  entryMask: boolean[],
  filterMask: boolean[],
  index: number,
): boolean {
  if (!entryMask[index] || !filterMask[index]) return false;
  if (index === 0) return true;
  return !(entryMask[index - 1] && filterMask[index - 1]);
}

export function listExplorationEvents(
  bars: OhlcvBar[],
  pattern: PatternDefinition,
): ExplorationEvent[] {
  if (bars.length < 2) return [];

  const ctx = computeIndicators(bars, pattern.indicators);
  const filterMask = evaluateOptional(ctx, pattern.filters);
  const entryMask = evaluateSeries(ctx, pattern.entry);
  const events: ExplorationEvent[] = [];

  for (let i = 0; i < ctx.dates.length; i++) {
    if (!isRisingSignal(entryMask, filterMask, i)) continue;

    const entryPrice = bars[i]!.close;
    const horizons = Object.fromEntries(
      (Object.keys(HORIZON_DAYS) as HorizonKey[]).map((key) => [
        key,
        forwardReturn(bars, i, HORIZON_DAYS[key]),
      ]),
    ) as Record<HorizonKey, ExplorationHorizonReturn>;

    events.push({
      signalDate: ctx.dates[i]!,
      entryPrice,
      horizons,
    });
  }

  return events;
}

function horizonStatsFromEvents(
  events: ExplorationEvent[],
  key: HorizonKey,
): HorizonStats {
  const returns = events
    .map((event) => event.horizons[key].returnPct)
    .filter((value): value is number => value !== null);

  if (returns.length === 0) {
    return { avgReturnPct: 0, winRate: 0, trades: 0 };
  }

  const wins = returns.filter((value) => value > 0).length;
  const avg =
    returns.reduce((sum, value) => sum + value, 0) / returns.length;

  return {
    avgReturnPct: avg,
    winRate: (wins / returns.length) * 100,
    trades: returns.length,
  };
}

export function summarizeEventHorizons(
  events: ExplorationEvent[],
): ExplorationSymbolHistory["horizons"] {
  return {
    d3: horizonStatsFromEvents(events, "d3"),
    d5: horizonStatsFromEvents(events, "d5"),
    d10: horizonStatsFromEvents(events, "d10"),
  };
}

export function computeExplorationHorizons(
  bars: OhlcvBar[],
  pattern: PatternDefinition,
): ExplorationSymbolHistory["horizons"] {
  return summarizeEventHorizons(listExplorationEvents(bars, pattern));
}

export function buildExplorationSymbolHistory(
  dailyBars: OhlcvBar[],
  pattern: PatternDefinition,
  timeframeMode: ExploreTimeframeMode,
): ExplorationSymbolHistory {
  const { bars, pattern: scanPattern } = prepareScanBarsAndPattern(
    dailyBars,
    pattern,
    timeframeMode,
  );

  const events = listExplorationEvents(bars, scanPattern);

  return {
    events,
    horizons: summarizeEventHorizons(events),
  };
}
