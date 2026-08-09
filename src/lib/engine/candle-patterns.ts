import type { OhlcvBar } from "@/lib/types";

export const CANDLE_PATTERN_IDS = [
  "doji",
  "hammer",
  "inverted_hammer",
  "shooting_star",
  "hanging_man",
  "bullish_engulfing",
  "bearish_engulfing",
  "bullish_marubozu",
  "bearish_marubozu",
  "piercing_line",
  "dark_cloud_cover",
  "morning_star",
  "evening_star",
  "three_white_soldiers",
  "three_black_crows",
  "tweezer_top",
  "tweezer_bottom",
  "gap_up",
  "gap_down",
] as const;

export type CandlePatternId = (typeof CANDLE_PATTERN_IDS)[number];

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
  const r = range(bar);
  if (b / r <= bodyRatioMax) return false;
  const lower = lowerWick(bar);
  const upper = upperWick(bar);
  return lower >= shadowRatioMin * b && upper <= b;
}

function isInvertedHammerShape(
  bar: OhlcvBar,
  bodyRatioMax: number,
  shadowRatioMin: number,
): boolean {
  const b = body(bar);
  const r = range(bar);
  if (b / r <= bodyRatioMax) return false;
  const upper = upperWick(bar);
  const lower = lowerWick(bar);
  return upper >= shadowRatioMin * b && lower <= b;
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
  const { bodyRatioMax, shadowRatioMin } = options;

  switch (pattern as CandlePatternId) {
    case "doji":
      return isDoji(bar, bodyRatioMax);

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

    case "bullish_engulfing":
      if (!prev || !isBearish(prev) || !isBullish(bar)) return false;
      return bar.open <= prev.close && bar.close >= prev.open;

    case "bearish_engulfing":
      if (!prev || !isBullish(prev) || !isBearish(bar)) return false;
      return bar.open >= prev.close && bar.close <= prev.open;

    case "bullish_marubozu":
      return (
        isBullish(bar) &&
        body(bar) / range(bar) >= 1 - bodyRatioMax &&
        upperWick(bar) / range(bar) <= bodyRatioMax &&
        lowerWick(bar) / range(bar) <= bodyRatioMax
      );

    case "bearish_marubozu":
      return (
        isBearish(bar) &&
        body(bar) / range(bar) >= 1 - bodyRatioMax &&
        upperWick(bar) / range(bar) <= bodyRatioMax &&
        lowerWick(bar) / range(bar) <= bodyRatioMax
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

    case "three_white_soldiers":
      if (!prev || !prev2) return false;
      return (
        isBullish(bar) &&
        isBullish(prev) &&
        isBullish(prev2) &&
        bar.close > prev.close &&
        prev.close > prev2.close &&
        bar.open > prev.open &&
        prev.open > prev2.open
      );

    case "three_black_crows":
      if (!prev || !prev2) return false;
      return (
        isBearish(bar) &&
        isBearish(prev) &&
        isBearish(prev2) &&
        bar.close < prev.close &&
        prev.close < prev2.close &&
        bar.open < prev.open &&
        prev.open < prev2.open
      );

    case "tweezer_top":
      if (!prev) return false;
      return (
        Math.abs(prev.high - bar.high) / range(bar) <= bodyRatioMax &&
        isBullish(prev) &&
        isBearish(bar)
      );

    case "tweezer_bottom":
      if (!prev) return false;
      return (
        Math.abs(prev.low - bar.low) / range(bar) <= bodyRatioMax &&
        isBearish(prev) &&
        isBullish(bar)
      );

    case "gap_up":
      if (!prev) return false;
      return bar.open > prev.high;

    case "gap_down":
      if (!prev) return false;
      return bar.open < prev.low;

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
