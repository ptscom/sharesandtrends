import type { OhlcvBar, PatternDefinition, Timeframe } from "@/lib/types";
import { resampleBars } from "@/lib/engine/resample";
import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";

export function minBarsForScanMode(mode: ExploreTimeframeMode): number {
  switch (mode) {
    case "1W":
      return 12;
    case "1M":
      return 6;
    default:
      return 60;
  }
}

export function prepareScanBarsAndPattern(
  dailyBars: OhlcvBar[],
  pattern: PatternDefinition,
  mode: ExploreTimeframeMode,
): { bars: OhlcvBar[]; pattern: PatternDefinition } {
  if (mode === "1W") {
    return {
      bars: resampleBars(dailyBars, "1W"),
      pattern: normalizePatternForResampledBars(pattern),
    };
  }
  if (mode === "1M") {
    return {
      bars: resampleBars(dailyBars, "1M"),
      pattern: normalizePatternForResampledBars(pattern),
    };
  }
  return { bars: dailyBars, pattern };
}

// Weekly/monthly scans run on resampled bars with 1D indicators.
export function normalizePatternForResampledBars(
  pattern: PatternDefinition,
): PatternDefinition {
  return {
    ...pattern,
    indicators: pattern.indicators.map((ind) => ({
      ...ind,
      timeframe: "1D" as Timeframe,
    })),
  };
}
