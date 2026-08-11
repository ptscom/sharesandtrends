import type { OhlcvBar } from "@/lib/types";
import { getImplementedPatternIds } from "@/lib/patterns/candle-catalog";

export const CANDLE_PATTERN_IDS = getImplementedPatternIds();

export type CandlePatternId = string;

export interface CandlePatternOptions {
  bodyRatioMax: number;
  shadowRatioMin: number;
}

function body(bar: OhlcvBar): number {
  return Math.abs(bar.close - bar.open);
}

function range(bar: OhlcvBar): number {
  return Math.max(bar.high - bar.low, 1e-12);
}

function upperWick(bar: OhlcvBar): number {
  return bar.high - Math.max(bar.open, bar.close);
}

function lowerWick(bar: OhlcvBar): number {
  return Math.min(bar.open, bar.close) - bar.low;
}

function isBullish(bar: OhlcvBar): boolean {
  return bar.close > bar.open;
}

function isBearish(bar: OhlcvBar): boolean {
  return bar.close < bar.open;
}

function bodyMid(bar: OhlcvBar): number {
  return (bar.open + bar.close) / 2;
}

function isDoji(bar: OhlcvBar, bodyRatioMax: number): boolean {
  return body(bar) / range(bar) <= bodyRatioMax;
}

function isHammerShape(
  bar: OhlcvBar,
  bodyRatioMax: number,
  shadowRatioMin: number,
): boolean {
  const b = body(bar);
  if (b / range(bar) <= bodyRatioMax) return false;
  return (
    lowerWick(bar) >= shadowRatioMin * b && upperWick(bar) <= b
  );
}

function isInvertedHammerShape(
  bar: OhlcvBar,
  bodyRatioMax: number,
  shadowRatioMin: number,
): boolean {
  const b = body(bar);
  if (b / range(bar) <= bodyRatioMax) return false;
  return (
    upperWick(bar) >= shadowRatioMin * b && lowerWick(bar) <= b
  );
}

function insideBody(inner: OhlcvBar, outer: OhlcvBar): boolean {
  return (
    inner.high <= Math.max(outer.open, outer.close) &&
    inner.low >= Math.min(outer.open, outer.close)
  );
}

export function detectCandlePatternAt(
  bars: OhlcvBar[],
  index: number,
  pattern: string,
  options: CandlePatternOptions,
): boolean {
  const bar = bars[index];
  if (!bar) return false;

  const prev = bars[index - 1];
  const prev2 = bars[index - 2];
  const prev3 = bars[index - 3];
  const prev4 = bars[index - 4];
  const { bodyRatioMax, shadowRatioMin } = options;
  const r = range(bar);

  switch (pattern) {
    case "doji":
      return isDoji(bar, bodyRatioMax);

    case "dragonfly_doji":
      return (
        isDoji(bar, bodyRatioMax) &&
        lowerWick(bar) / r >= 0.6 &&
        upperWick(bar) / r <= bodyRatioMax
      );

    case "gravestone_doji":
      return (
        isDoji(bar, bodyRatioMax) &&
        upperWick(bar) / r >= 0.6 &&
        lowerWick(bar) / r <= bodyRatioMax
      );

    case "long_legged_doji":
      return (
        isDoji(bar, bodyRatioMax) &&
        upperWick(bar) / r >= 0.3 &&
        lowerWick(bar) / r >= 0.3
      );

    case "spinning_top":
      return (
        body(bar) / r > bodyRatioMax &&
        body(bar) / r <= bodyRatioMax * 3 &&
        upperWick(bar) >= body(bar) &&
        lowerWick(bar) >= body(bar)
      );

    case "hammer":
      return isHammerShape(bar, bodyRatioMax, shadowRatioMin) && isBullish(bar);

    case "hanging_man":
      return isHammerShape(bar, bodyRatioMax, shadowRatioMin) && isBearish(bar);

    case "inverted_hammer":
      return (
        isInvertedHammerShape(bar, bodyRatioMax, shadowRatioMin) && isBullish(bar)
      );

    case "shooting_star":
      return (
        isInvertedHammerShape(bar, bodyRatioMax, shadowRatioMin) && isBearish(bar)
      );

    case "bullish_belt_hold":
      return (
        isBullish(bar) &&
        lowerWick(bar) / r <= bodyRatioMax &&
        body(bar) / r >= bodyRatioMax * 2
      );

    case "bearish_belt_hold":
      return (
        isBearish(bar) &&
        upperWick(bar) / r <= bodyRatioMax &&
        body(bar) / r >= bodyRatioMax * 2
      );

    case "bullish_marubozu":
      return (
        isBullish(bar) &&
        body(bar) / r >= 1 - bodyRatioMax &&
        upperWick(bar) / r <= bodyRatioMax &&
        lowerWick(bar) / r <= bodyRatioMax
      );

    case "bearish_marubozu":
      return (
        isBearish(bar) &&
        body(bar) / r >= 1 - bodyRatioMax &&
        upperWick(bar) / r <= bodyRatioMax &&
        lowerWick(bar) / r <= bodyRatioMax
      );

    case "bullish_engulfing":
      if (!prev || !isBearish(prev) || !isBullish(bar)) return false;
      return bar.open <= prev.close && bar.close >= prev.open;

    case "bearish_engulfing":
      if (!prev || !isBullish(prev) || !isBearish(bar)) return false;
      return bar.open >= prev.close && bar.close <= prev.open;

    case "bullish_harami":
      if (!prev || !isBearish(prev) || !isBullish(bar)) return false;
      return insideBody(bar, prev) && body(bar) < body(prev);

    case "bearish_harami":
      if (!prev || !isBullish(prev) || !isBearish(bar)) return false;
      return insideBody(bar, prev) && body(bar) < body(prev);

    case "bullish_harami_cross":
      if (!prev || !isBearish(prev)) return false;
      return isDoji(bar, bodyRatioMax) && insideBody(bar, prev);

    case "bearish_harami_cross":
      if (!prev || !isBullish(prev)) return false;
      return isDoji(bar, bodyRatioMax) && insideBody(bar, prev);

    case "bullish_kicker":
      if (!prev || !isBearish(prev) || !isBullish(bar)) return false;
      return bar.open > prev.open && bar.close > prev.close;

    case "bearish_kicker":
      if (!prev || !isBullish(prev) || !isBearish(bar)) return false;
      return bar.open < prev.open && bar.close < prev.close;

    case "bullish_separating_lines":
      if (!prev || !isBearish(prev) || !isBullish(bar)) return false;
      return Math.abs(bar.open - prev.open) / r <= bodyRatioMax;

    case "bearish_separating_lines":
      if (!prev || !isBullish(prev) || !isBearish(bar)) return false;
      return Math.abs(bar.open - prev.open) / r <= bodyRatioMax;

    case "matching_low":
      if (!prev) return false;
      return (
        Math.abs(prev.low - bar.low) / r <= bodyRatioMax &&
        isBearish(prev) &&
        isBullish(bar)
      );

    case "matching_high":
      if (!prev) return false;
      return (
        Math.abs(prev.high - bar.high) / r <= bodyRatioMax &&
        isBullish(prev) &&
        isBearish(bar)
      );

    case "piercing_line":
      if (!prev || !isBearish(prev) || !isBullish(bar)) return false;
      return (
        bar.open < prev.low &&
        bar.close > bodyMid(prev) &&
        bar.close < prev.open
      );

    case "dark_cloud_cover":
      if (!prev || !isBullish(prev) || !isBearish(bar)) return false;
      return (
        bar.open > prev.high &&
        bar.close < bodyMid(prev) &&
        bar.close > prev.open
      );

    case "tweezer_top":
      if (!prev) return false;
      return (
        Math.abs(prev.high - bar.high) / r <= bodyRatioMax &&
        isBullish(prev) &&
        isBearish(bar)
      );

    case "tweezer_bottom":
      if (!prev) return false;
      return (
        Math.abs(prev.low - bar.low) / r <= bodyRatioMax &&
        isBearish(prev) &&
        isBullish(bar)
      );

    case "gap_up":
      if (!prev) return false;
      return bar.open > prev.high;

    case "gap_down":
      if (!prev) return false;
      return bar.open < prev.low;

    case "morning_star":
      if (!prev || !prev2) return false;
      return (
        isBearish(prev2) &&
        body(prev2) / range(prev2) > bodyRatioMax &&
        body(prev) / range(prev) <= bodyRatioMax * 2 &&
        isBullish(bar) &&
        bar.close > bodyMid(prev2)
      );

    case "evening_star":
      if (!prev || !prev2) return false;
      return (
        isBullish(prev2) &&
        body(prev2) / range(prev2) > bodyRatioMax &&
        body(prev) / range(prev) <= bodyRatioMax * 2 &&
        isBearish(bar) &&
        bar.close < bodyMid(prev2)
      );

    case "three_inside_up":
      if (!prev || !prev2) return false;
      return (
        isBearish(prev2) &&
        isBullish(prev) &&
        insideBody(prev, prev2) &&
        isBullish(bar) &&
        bar.close > prev2.open
      );

    case "three_inside_down":
      if (!prev || !prev2) return false;
      return (
        isBullish(prev2) &&
        isBearish(prev) &&
        insideBody(prev, prev2) &&
        isBearish(bar) &&
        bar.close < prev2.open
      );

    case "three_outside_up":
      if (!prev || !prev2) return false;
      return (
        isBearish(prev2) &&
        isBullish(prev) &&
        prev.open <= prev2.close &&
        prev.close >= prev2.open &&
        isBullish(bar) &&
        bar.close > prev.close
      );

    case "three_outside_down":
      if (!prev || !prev2) return false;
      return (
        isBullish(prev2) &&
        isBearish(prev) &&
        prev.open >= prev2.close &&
        prev.close <= prev2.open &&
        isBearish(bar) &&
        bar.close < prev.close
      );

    case "abandoned_baby_bull":
      if (!prev || !prev2) return false;
      return (
        isBearish(prev2) &&
        isDoji(prev, bodyRatioMax) &&
        prev.high < prev2.low &&
        isBullish(bar) &&
        bar.low > prev.high
      );

    case "abandoned_baby_bear":
      if (!prev || !prev2) return false;
      return (
        isBullish(prev2) &&
        isDoji(prev, bodyRatioMax) &&
        prev.low > prev2.high &&
        isBearish(bar) &&
        bar.high < prev.low
      );

    case "three_white_soldiers":
      if (!prev || !prev2) return false;
      return (
        isBullish(bar) &&
        isBullish(prev) &&
        isBullish(prev2) &&
        bar.close > prev.close &&
        prev.close > prev2.close
      );

    case "three_black_crows":
      if (!prev || !prev2) return false;
      return (
        isBearish(bar) &&
        isBearish(prev) &&
        isBearish(prev2) &&
        bar.close < prev.close &&
        prev.close < prev2.close
      );

    case "upside_gap_two_crows":
      if (!prev || !prev2) return false;
      return (
        isBullish(prev2) &&
        prev2.open < prev.open &&
        isBearish(prev) &&
        isBearish(bar) &&
        bar.open < prev.open &&
        bar.close < prev.close
      );

    case "advance_block":
      if (!prev || !prev2) return false;
      return (
        isBullish(prev2) &&
        isBullish(prev) &&
        isBullish(bar) &&
        body(bar) < body(prev) &&
        body(prev) < body(prev2) &&
        upperWick(bar) > upperWick(prev)
      );

    case "rising_three_methods":
      if (!prev || !prev2 || !prev3 || !prev4) return false;
      return (
        isBullish(prev4) &&
        body(prev4) / range(prev4) > bodyRatioMax &&
        isBearish(prev3) &&
        isBearish(prev2) &&
        isBearish(prev) &&
        prev3.high <= prev4.high &&
        prev3.low >= prev4.low &&
        prev2.high <= prev4.high &&
        prev2.low >= prev4.low &&
        prev.high <= prev4.high &&
        prev.low >= prev4.low &&
        isBullish(bar) &&
        bar.close > prev4.high
      );

    case "falling_three_methods":
      if (!prev || !prev2 || !prev3 || !prev4) return false;
      return (
        isBearish(prev4) &&
        body(prev4) / range(prev4) > bodyRatioMax &&
        isBullish(prev3) &&
        isBullish(prev2) &&
        isBullish(prev) &&
        prev3.high <= prev4.high &&
        prev3.low >= prev4.low &&
        prev2.high <= prev4.high &&
        prev2.low >= prev4.low &&
        prev.high <= prev4.high &&
        prev.low >= prev4.low &&
        isBearish(bar) &&
        bar.close < prev4.low
      );

    case "three_line_strike_bull":
      if (!prev || !prev2 || !prev3) return false;
      return (
        isBearish(prev3) &&
        isBearish(prev2) &&
        isBearish(prev) &&
        isBullish(bar) &&
        bar.open < prev.low &&
        bar.close > prev3.open
      );

    case "three_line_strike_bear":
      if (!prev || !prev2 || !prev3) return false;
      return (
        isBullish(prev3) &&
        isBullish(prev2) &&
        isBullish(prev) &&
        isBearish(bar) &&
        bar.open > prev.high &&
        bar.close < prev3.open
      );

    default:
      return false;
  }
}

export function detectCandlePatternSeries(
  bars: OhlcvBar[],
  pattern: string,
  options: CandlePatternOptions,
): number[] {
  return bars.map((_, i) =>
    detectCandlePatternAt(bars, i, pattern, options) ? 1 : 0,
  );
}

export function formatCandlePatternLabel(pattern: string): string {
  return pattern
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function extractCandlePatternMarkers(
  bars: OhlcvBar[],
  series: Record<string, (number | null)[]>,
  indicators: { alias: string; type: string; params: Record<string, number | string> }[],
): { date: string; label: string }[] {
  const markers: { date: string; label: string }[] = [];

  for (const ind of indicators) {
    if (ind.type !== "candle_pattern") continue;
    const values = series[ind.alias];
    if (!values) continue;
    const label = formatCandlePatternLabel(String(ind.params.pattern ?? "pattern"));
    values.forEach((v, i) => {
      if (v === 1 && bars[i]) {
        markers.push({ date: bars[i]!.date, label });
      }
    });
  }

  return markers;
}
