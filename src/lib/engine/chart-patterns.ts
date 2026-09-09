import type { OhlcvBar } from "@/lib/types";
import { getImplementedChartPatternIds } from "@/lib/patterns/chart-pattern-catalog";

export const CHART_PATTERN_IDS = getImplementedChartPatternIds();

export type ChartPatternId = string;

export interface ChartPatternOptions {
  lookback: number;
  /** Minimum pole move (%) for flag patterns */
  minPolePct: number;
  /** Price tolerance (%) when comparing peaks/troughs */
  tolerancePct: number;
  /** Max range width (%) for long-base patterns */
  maxBaseRangePct: number;
}

const DEFAULT_OPTIONS: ChartPatternOptions = {
  lookback: 60,
  minPolePct: 6,
  tolerancePct: 2.5,
  maxBaseRangePct: 12,
};

function windowSlice(
  bars: OhlcvBar[],
  index: number,
  lookback: number,
): OhlcvBar[] {
  const start = Math.max(0, index - lookback + 1);
  return bars.slice(start, index + 1);
}

function near(a: number, b: number, tolerancePct: number): boolean {
  const mid = (a + b) / 2;
  if (mid === 0) return false;
  return Math.abs(a - b) / mid <= tolerancePct / 100;
}

function swingHighs(bars: OhlcvBar[], radius = 2): number[] {
  const highs: number[] = [];
  for (let i = radius; i < bars.length - radius; i++) {
    const h = bars[i]!.high;
    let isHigh = true;
    for (let j = i - radius; j <= i + radius; j++) {
      if (j !== i && bars[j]!.high >= h) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) highs.push(i);
  }
  return highs;
}

function swingLows(bars: OhlcvBar[], radius = 2): number[] {
  const lows: number[] = [];
  for (let i = radius; i < bars.length - radius; i++) {
    const l = bars[i]!.low;
    let isLow = true;
    for (let j = i - radius; j <= i + radius; j++) {
      if (j !== i && bars[j]!.low <= l) {
        isLow = false;
        break;
      }
    }
    if (isLow) lows.push(i);
  }
  return lows;
}

function detectBullFlag(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 20) return false;
  const poleLen = Math.max(5, Math.floor(bars.length * 0.25));
  const flagStart = poleLen;
  const flagEnd = Math.max(flagStart + 5, bars.length - 2);
  const flagBars = bars.slice(flagStart, flagEnd);
  if (flagBars.length < 5) return false;

  const poleStart = bars[0]!.close;
  const poleEnd = bars[poleLen - 1]!.close;
  if (poleStart <= 0) return false;
  const poleMove = ((poleEnd - poleStart) / poleStart) * 100;
  if (poleMove < options.minPolePct) return false;

  const flagHighs = flagBars.map((b) => b.high);
  const flagLows = flagBars.map((b) => b.low);
  const firstHalf = flagBars.slice(0, Math.floor(flagBars.length / 2));
  const secondHalf = flagBars.slice(Math.floor(flagBars.length / 2));
  const avgHigh1 =
    firstHalf.reduce((s, b) => s + b.high, 0) / Math.max(firstHalf.length, 1);
  const avgHigh2 =
    secondHalf.reduce((s, b) => s + b.high, 0) / Math.max(secondHalf.length, 1);
  if (avgHigh2 > avgHigh1 * 1.02) return false;

  const flagHigh = Math.max(...flagHighs);
  const current = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  return current.close > flagHigh && prev.close <= flagHigh;
}

function detectBearFlag(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 20) return false;
  const poleLen = Math.max(5, Math.floor(bars.length * 0.25));
  const flagStart = poleLen;
  const flagEnd = Math.max(flagStart + 5, bars.length - 2);
  const flagBars = bars.slice(flagStart, flagEnd);
  if (flagBars.length < 5) return false;

  const poleStart = bars[0]!.close;
  const poleEnd = bars[poleLen - 1]!.close;
  if (poleStart <= 0) return false;
  const poleMove = ((poleStart - poleEnd) / poleStart) * 100;
  if (poleMove < options.minPolePct) return false;

  const firstHalf = flagBars.slice(0, Math.floor(flagBars.length / 2));
  const secondHalf = flagBars.slice(Math.floor(flagBars.length / 2));
  const avgLow1 =
    firstHalf.reduce((s, b) => s + b.low, 0) / Math.max(firstHalf.length, 1);
  const avgLow2 =
    secondHalf.reduce((s, b) => s + b.low, 0) / Math.max(secondHalf.length, 1);
  if (avgLow2 < avgLow1 * 0.98) return false;

  const flagLow = Math.min(...flagBars.map((b) => b.low));
  const current = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  return current.close < flagLow && prev.close >= flagLow;
}

function detectAscendingTriangle(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 15) return false;
  const highs = swingHighs(bars);
  const lows = swingLows(bars);
  if (highs.length < 2 || lows.length < 2) return false;

  const resistance = Math.max(...highs.map((i) => bars[i]!.high));
  const touchHighs = highs.filter((i) =>
    near(bars[i]!.high, resistance, options.tolerancePct),
  );
  if (touchHighs.length < 2) return false;

  const lowPrices = lows.map((i) => bars[i]!.low);
  let rising = true;
  for (let i = 1; i < lowPrices.length; i++) {
    if (lowPrices[i]! <= lowPrices[i - 1]! * 1.002) {
      rising = false;
      break;
    }
  }
  if (!rising) return false;

  const current = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  return current.close > resistance && prev.close <= resistance;
}

function detectDescendingTriangle(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 15) return false;
  const highs = swingHighs(bars);
  const lows = swingLows(bars);
  if (highs.length < 2 || lows.length < 2) return false;

  const support = Math.min(...lows.map((i) => bars[i]!.low));
  const touchLows = lows.filter((i) =>
    near(bars[i]!.low, support, options.tolerancePct),
  );
  if (touchLows.length < 2) return false;

  const highPrices = highs.map((i) => bars[i]!.high);
  let falling = true;
  for (let i = 1; i < highPrices.length; i++) {
    if (highPrices[i]! >= highPrices[i - 1]! * 0.998) {
      falling = false;
      break;
    }
  }
  if (!falling) return false;

  const current = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  return current.close < support && prev.close >= support;
}

function detectDoubleBottom(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 20) return false;
  const lows = swingLows(bars, 3);
  if (lows.length < 2) return false;

  let best: { a: number; b: number; peak: number } | null = null;
  for (let i = 0; i < lows.length - 1; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      const idxA = lows[i]!;
      const idxB = lows[j]!;
      if (idxB - idxA < 5) continue;
      const lowA = bars[idxA]!.low;
      const lowB = bars[idxB]!.low;
      if (!near(lowA, lowB, options.tolerancePct)) continue;
      const between = bars.slice(idxA + 1, idxB);
      if (between.length < 3) continue;
      const peak = Math.max(...between.map((b) => b.high));
      if (!best || peak > best.peak) {
        best = { a: idxA, b: idxB, peak };
      }
    }
  }
  if (!best) return false;

  const current = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  return current.close > best.peak && prev.close <= best.peak;
}

function detectDoubleTop(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 20) return false;
  const highs = swingHighs(bars, 3);
  if (highs.length < 2) return false;

  let best: { a: number; b: number; trough: number } | null = null;
  for (let i = 0; i < highs.length - 1; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      const idxA = highs[i]!;
      const idxB = highs[j]!;
      if (idxB - idxA < 5) continue;
      const highA = bars[idxA]!.high;
      const highB = bars[idxB]!.high;
      if (!near(highA, highB, options.tolerancePct)) continue;
      const between = bars.slice(idxA + 1, idxB);
      if (between.length < 3) continue;
      const trough = Math.min(...between.map((b) => b.low));
      if (!best || trough < best.trough) {
        best = { a: idxA, b: idxB, trough };
      }
    }
  }
  if (!best) return false;

  const current = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  return current.close < best.trough && prev.close >= best.trough;
}

function detectHeadAndShoulders(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 25) return false;
  const highs = swingHighs(bars, 3);
  if (highs.length < 3) return false;

  for (let i = 0; i < highs.length - 2; i++) {
    const left = highs[i]!;
    const head = highs[i + 1]!;
    const right = highs[i + 2]!;
    const leftHigh = bars[left]!.high;
    const headHigh = bars[head]!.high;
    const rightHigh = bars[right]!.high;

    if (headHigh <= leftHigh || headHigh <= rightHigh) continue;
    if (!near(leftHigh, rightHigh, options.tolerancePct * 1.5)) continue;

    const necklineSlice = bars.slice(left, right + 1);
    const neckline = Math.min(...necklineSlice.map((b) => b.low));
    const current = bars[bars.length - 1]!;
    const prev = bars[bars.length - 2]!;
    if (current.close < neckline && prev.close >= neckline) {
      return true;
    }
  }
  return false;
}

function detectCupAndHandle(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 30) return false;
  const handleLen = Math.max(5, Math.floor(bars.length * 0.15));
  const cupBars = bars.slice(0, bars.length - handleLen);
  const handleBars = bars.slice(-handleLen);
  if (cupBars.length < 20 || handleBars.length < 4) return false;

  const leftRim = cupBars[0]!.close;
  const rightRim = cupBars[cupBars.length - 1]!.close;
  if (!near(leftRim, rightRim, options.tolerancePct * 2)) return false;

  const cupLow = Math.min(...cupBars.map((b) => b.low));
  const cupDepth = ((leftRim - cupLow) / leftRim) * 100;
  if (cupDepth < 8 || cupDepth > 45) return false;

  const mid = Math.floor(cupBars.length / 2);
  const midBar = cupBars[mid]!;
  if (midBar.low > cupLow * 1.05) return false;

  const handleHigh = Math.max(...handleBars.map((b) => b.high));
  const rimHigh = Math.max(leftRim, rightRim);
  if (handleHigh > rimHigh * 1.02) return false;

  const breakoutLevel = Math.max(rimHigh, handleHigh);
  const current = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  return current.close > breakoutLevel && prev.close <= breakoutLevel;
}

function detectLongBaseBreakout(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 20) return false;
  const baseBars = bars.slice(0, bars.length - 1);
  const baseHigh = Math.max(...baseBars.map((b) => b.high));
  const baseLow = Math.min(...baseBars.map((b) => b.low));
  const mid = (baseHigh + baseLow) / 2;
  if (mid <= 0) return false;
  const rangePct = ((baseHigh - baseLow) / mid) * 100;
  if (rangePct > options.maxBaseRangePct) return false;

  const current = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  return current.close > baseHigh && prev.close <= baseHigh;
}

function detectLongBaseBreakdown(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 20) return false;
  const baseBars = bars.slice(0, bars.length - 1);
  const baseHigh = Math.max(...baseBars.map((b) => b.high));
  const baseLow = Math.min(...baseBars.map((b) => b.low));
  const mid = (baseHigh + baseLow) / 2;
  if (mid <= 0) return false;
  const rangePct = ((baseHigh - baseLow) / mid) * 100;
  if (rangePct > options.maxBaseRangePct) return false;

  const current = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  return current.close < baseLow && prev.close >= baseLow;
}

export function detectChartPatternAt(
  bars: OhlcvBar[],
  index: number,
  pattern: string,
  options: Partial<ChartPatternOptions> = {},
): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const slice = windowSlice(bars, index, opts.lookback);
  if (slice.length < 15) return false;

  switch (pattern) {
    case "bull_flag":
      return detectBullFlag(slice, opts);
    case "bear_flag":
      return detectBearFlag(slice, opts);
    case "ascending_triangle":
      return detectAscendingTriangle(slice, opts);
    case "descending_triangle":
      return detectDescendingTriangle(slice, opts);
    case "double_bottom":
      return detectDoubleBottom(slice, opts);
    case "double_top":
      return detectDoubleTop(slice, opts);
    case "head_and_shoulders":
      return detectHeadAndShoulders(slice, opts);
    case "cup_and_handle":
      return detectCupAndHandle(slice, opts);
    case "long_base_breakout":
      return detectLongBaseBreakout(slice, opts);
    case "long_base_breakdown":
      return detectLongBaseBreakdown(slice, opts);
    default:
      return false;
  }
}

export function detectChartPatternSeries(
  bars: OhlcvBar[],
  pattern: string,
  options: Partial<ChartPatternOptions> = {},
): number[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return bars.map((_, i) =>
    detectChartPatternAt(bars, i, pattern, opts) ? 1 : 0,
  );
}

export function formatChartPatternLabel(pattern: string): string {
  const fromCatalog = pattern
    .split("_")
    .map((w) => {
      if (w === "and") return "&";
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
  return fromCatalog.replace("Cup & Handle", "Cup & Handle");
}
