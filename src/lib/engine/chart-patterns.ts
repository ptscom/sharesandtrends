import type { OhlcvBar } from "@/lib/types";
import { getImplementedChartPatternIds } from "@/lib/patterns/chart-pattern-catalog";
import {
  detectDoubleBottomAt,
  detectDoubleTopAt,
} from "@/lib/engine/chart-pattern-swings";

export const CHART_PATTERN_IDS = getImplementedChartPatternIds();

export type ChartPatternId = string;

export interface ChartPatternOptions {
  lookback: number;
  minPolePct: number;
  tolerancePct: number;
  maxBaseRangePct: number;
  minReversalDepthPct: number;
}

const DEFAULT_OPTIONS: ChartPatternOptions = {
  lookback: 60,
  minPolePct: 8,
  tolerancePct: 2,
  maxBaseRangePct: 10,
  minReversalDepthPct: 5,
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

function pctChange(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

function windowExtremes(bars: OhlcvBar[]) {
  const high = Math.max(...bars.map((b) => b.high));
  const low = Math.min(...bars.map((b) => b.low));
  return { high, low, range: high - low, mid: (high + low) / 2 };
}

function crossesBelow(bars: OhlcvBar[], level: number): boolean {
  const current = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  return current.close < level && prev.close >= level;
}

function crossesAbove(bars: OhlcvBar[], level: number): boolean {
  const current = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  return current.close > level && prev.close <= level;
}

function maxCompletionLag(bars: OhlcvBar[], fraction = 0.32): number {
  return Math.max(6, Math.floor(bars.length * fraction));
}

function recentSlice(bars: OhlcvBar[], startFraction = 0.25): OhlcvBar[] {
  const start = Math.floor(bars.length * startFraction);
  return bars.slice(start);
}

function isMonotonicRising(values: number[], minStepPct = 0.25): boolean {
  if (values.length < 2) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i]! <= values[i - 1]! * (1 + minStepPct / 100)) return false;
  }
  return true;
}

function isMonotonicFalling(values: number[], minStepPct = 0.25): boolean {
  if (values.length < 2) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i]! >= values[i - 1]! * (1 - minStepPct / 100)) return false;
  }
  return true;
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

interface PoleSegment {
  start: number;
  end: number;
  movePct: number;
}

function findPoles(
  bars: OhlcvBar[],
  direction: "up" | "down",
  options: ChartPatternOptions,
): PoleSegment[] {
  const minFlagBars = 6;
  const maxEnd = bars.length - minFlagBars - 2;
  const poles: PoleSegment[] = [];

  for (let start = 0; start < maxEnd - 5; start++) {
    for (let len = 5; len <= 18; len++) {
      const end = start + len;
      if (end >= maxEnd) continue;

      const from = bars[start]!.close;
      const to = bars[end]!.close;
      const move =
        direction === "up" ? pctChange(from, to) : pctChange(to, from);

      if (move >= options.minPolePct) {
        poles.push({ start, end, movePct: move });
      }
    }
  }

  return poles.sort((a, b) => b.end - a.end);
}

function validateFlagChannel(
  flagBars: OhlcvBar[],
  direction: "up" | "down",
): boolean {
  const firstHalf = flagBars.slice(0, Math.floor(flagBars.length / 2));
  const secondHalf = flagBars.slice(Math.floor(flagBars.length / 2));
  const avgHigh1 =
    firstHalf.reduce((s, b) => s + b.high, 0) / Math.max(firstHalf.length, 1);
  const avgHigh2 =
    secondHalf.reduce((s, b) => s + b.high, 0) / Math.max(secondHalf.length, 1);
  const avgLow1 =
    firstHalf.reduce((s, b) => s + b.low, 0) / Math.max(firstHalf.length, 1);
  const avgLow2 =
    secondHalf.reduce((s, b) => s + b.low, 0) / Math.max(secondHalf.length, 1);

  if (direction === "up") {
    if (avgHigh2 > avgHigh1 * 1.02) return false;
    if (avgLow2 < avgLow1 * 0.985) return false;
    return true;
  }
  if (avgLow2 < avgLow1 * 0.98) return false;
  if (avgHigh2 > avgHigh1 * 1.015) return false;
  return true;
}

function detectBullFlag(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 24) return false;

  for (const pole of findPoles(bars, "up", options)) {
    const flagStart = pole.end + 1;
    const flagEnd = bars.length - 2;
    const flagBars = bars.slice(flagStart, flagEnd + 1);
    if (flagBars.length < 6 || flagBars.length > Math.floor(bars.length * 0.72)) {
      continue;
    }

    const poleLow = Math.min(
      ...bars.slice(pole.start, pole.end + 1).map((b) => b.low),
    );
    const poleHigh = Math.max(
      ...bars.slice(pole.start, pole.end + 1).map((b) => b.high),
    );
    const poleHeight = poleHigh - poleLow;
    if (poleHeight <= 0) continue;

    const flagHigh = Math.max(...flagBars.map((b) => b.high));
    const flagLow = Math.min(...flagBars.map((b) => b.low));
    if (flagHigh - flagLow > poleHeight * 0.5) continue;
    if (poleHigh - flagLow > poleHeight * 0.58) continue;
    if (!validateFlagChannel(flagBars, "up")) continue;

    const { high: windowHigh, range } = windowExtremes(bars);
    if (range <= 0 || poleHigh < windowHigh - range * 0.15) continue;

    if (crossesAbove(bars, flagHigh)) return true;
  }

  return false;
}

function detectBearFlag(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 24) return false;

  for (const pole of findPoles(bars, "down", options)) {
    const flagStart = pole.end + 1;
    const flagEnd = bars.length - 2;
    const flagBars = bars.slice(flagStart, flagEnd + 1);
    if (flagBars.length < 6 || flagBars.length > Math.floor(bars.length * 0.72)) {
      continue;
    }

    const poleLow = Math.min(
      ...bars.slice(pole.start, pole.end + 1).map((b) => b.low),
    );
    const poleHigh = Math.max(
      ...bars.slice(pole.start, pole.end + 1).map((b) => b.high),
    );
    const poleHeight = poleHigh - poleLow;
    if (poleHeight <= 0) continue;

    const flagHigh = Math.max(...flagBars.map((b) => b.high));
    const flagLow = Math.min(...flagBars.map((b) => b.low));
    if (flagHigh - flagLow > poleHeight * 0.5) continue;
    if (flagHigh - poleLow > poleHeight * 0.58) continue;
    if (!validateFlagChannel(flagBars, "down")) continue;

    const { low: windowLow, range } = windowExtremes(bars);
    if (range <= 0 || poleLow > windowLow + range * 0.15) continue;

    if (crossesBelow(bars, flagLow)) return true;
  }

  return false;
}


function detectAscendingTriangle(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  const formation = recentSlice(bars, 0.2);
  if (formation.length < 15) return false;

  const highs = swingHighs(formation, 2);
  if (highs.length < 2) return false;

  const { high: formHigh, low: formLow, range } = windowExtremes(formation);
  if (range <= 0) return false;

  const resistance = Math.max(...highs.map((i) => formation[i]!.high));
  const touchHighs = highs.filter((i) =>
    near(formation[i]!.high, resistance, options.tolerancePct * 1.5),
  );
  if (touchHighs.length < 2) return false;
  if (resistance < formHigh - range * 0.12) return false;

  const third = Math.max(4, Math.floor(formation.length / 3));
  const earlyLows = formation.slice(0, third).map((b) => b.low);
  const lateLows = formation.slice(-third).map((b) => b.low);
  const earlyAvg = earlyLows.reduce((s, v) => s + v, 0) / earlyLows.length;
  const lateAvg = lateLows.reduce((s, v) => s + v, 0) / lateLows.length;
  if (lateAvg <= earlyAvg * 1.025) return false;

  const preBreakout = formation.slice(0, formation.length - 2);
  const testedResistance = preBreakout.some(
    (b) => b.high >= resistance * (1 - options.tolerancePct / 100),
  );
  if (!testedResistance) return false;

  const compressed = range / formHigh < 0.24;
  if (!compressed) return false;

  return crossesAbove(bars, resistance);
}

function detectDescendingTriangle(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  const formation = recentSlice(bars, 0.2);
  if (formation.length < 15) return false;

  const lows = swingLows(formation, 2);
  if (lows.length < 2) return false;

  const { high: formHigh, low: formLow, range } = windowExtremes(formation);
  if (range <= 0) return false;

  const support = Math.min(...lows.map((i) => formation[i]!.low));
  const touchLows = lows.filter((i) =>
    near(formation[i]!.low, support, options.tolerancePct * 1.5),
  );
  if (touchLows.length < 2) return false;
  if (support > formLow + range * 0.12) return false;

  const third = Math.max(4, Math.floor(formation.length / 3));
  const earlyHighs = formation.slice(0, third).map((b) => b.high);
  const lateHighs = formation.slice(-third).map((b) => b.high);
  const earlyAvg = earlyHighs.reduce((s, v) => s + v, 0) / earlyHighs.length;
  const lateAvg = lateHighs.reduce((s, v) => s + v, 0) / lateHighs.length;
  if (lateAvg >= earlyAvg * 0.975) return false;

  const preBreakout = formation.slice(0, formation.length - 2);
  const testedSupport = preBreakout.some(
    (b) => b.low <= support * (1 + options.tolerancePct / 100),
  );
  if (!testedSupport) return false;

  const compressed = range / formHigh < 0.24;
  if (!compressed) return false;

  return crossesBelow(bars, support);
}

function detectDoubleBottom(
  bars: OhlcvBar[],
  _options: ChartPatternOptions,
): boolean {
  if (bars.length < 24) return false;
  return detectDoubleBottomAt(bars, bars.length - 1);
}

function detectDoubleTop(
  bars: OhlcvBar[],
  _options: ChartPatternOptions,
): boolean {
  if (bars.length < 24) return false;
  return detectDoubleTopAt(bars, bars.length - 1);
}

function detectHeadAndShoulders(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 30) return false;
  const highs = swingHighs(bars, 2);
  if (highs.length < 3) return false;

  for (let i = 0; i < highs.length - 2; i++) {
    for (let k = i + 2; k < highs.length; k++) {
      const left = highs[i]!;
      const head = highs[i + 1]!;
      const right = highs[k]!;
      const leftHigh = bars[left]!.high;
      const headHigh = bars[head]!.high;
      const rightHigh = bars[right]!.high;

      if (headHigh <= leftHigh * 1.03 || headHigh <= rightHigh * 1.03) continue;
      if (!near(leftHigh, rightHigh, options.tolerancePct * 1.25)) continue;

      const leftSpan = head - left;
      const rightSpan = right - head;
      if (leftSpan < 4 || rightSpan < 4) continue;
      if (rightSpan > leftSpan * 2.4 || rightSpan < leftSpan * 0.4) continue;

      const priorBars = Math.min(10, left);
      if (priorBars >= 3) {
        const priorLow = Math.min(
          ...bars.slice(left - priorBars, left).map((b) => b.low),
        );
        if (pctChange(priorLow, leftHigh) < options.minReversalDepthPct) continue;
      }

      const valleyLeft = Math.min(
        ...bars.slice(left + 1, head).map((b) => b.low),
      );
      const valleyRight = Math.min(
        ...bars.slice(head + 1, right).map((b) => b.low),
      );
      const neckline = Math.max(valleyLeft, valleyRight);

      const { high: windowHigh, range } = windowExtremes(bars);
      if (headHigh < windowHigh - range * 0.1) continue;

      const minRecentIdx = Math.floor(bars.length * 0.55);
      if (right < minRecentIdx) continue;

      const barsSinceRightShoulder = bars.length - 1 - right;
      if (
        barsSinceRightShoulder < 1 ||
        barsSinceRightShoulder > maxCompletionLag(bars)
      ) {
        continue;
      }

      const afterRight = bars.slice(right + 1, bars.length - 1);
      if (afterRight.length > 0) {
        const belowNeckline = afterRight.filter((b) => b.close < neckline).length;
        if (belowNeckline > afterRight.length * 0.25) continue;
        const retestLow = Math.min(...afterRight.map((b) => b.low));
        if (retestLow > neckline * 1.04) continue;
      }

      if (crossesBelow(bars, neckline)) {
        return true;
      }
    }
  }
  return false;
}

function detectCupAndHandle(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 40) return false;

  const handleLen = Math.max(6, Math.floor(bars.length * 0.14));
  const cupBars = bars.slice(0, bars.length - handleLen);
  const handleBars = bars.slice(-handleLen);
  if (cupBars.length < 28 || handleBars.length < 5) return false;

  const leftRimIdx = Math.min(4, Math.floor(cupBars.length * 0.08));
  const rightRimIdx = cupBars.length - 1 - Math.min(4, Math.floor(cupBars.length * 0.08));
  const leftRim = cupBars[leftRimIdx]!.close;
  const rightRim = cupBars[rightRimIdx]!.close;
  if (!near(leftRim, rightRim, options.tolerancePct * 3)) return false;

  const cupLow = Math.min(...cupBars.map((b) => b.low));
  const rimHigh = Math.max(leftRim, rightRim, cupBars[leftRimIdx]!.high, cupBars[rightRimIdx]!.high);
  const cupDepthPct = pctChange(cupLow, rimHigh);
  if (cupDepthPct < 10 || cupDepthPct > 40) return false;

  const third = Math.floor(cupBars.length / 3);
  const leftThird = cupBars.slice(0, third);
  const midThird = cupBars.slice(third, third * 2);
  const rightThird = cupBars.slice(third * 2, rightRimIdx + 1);
  if (leftThird.length < 4 || midThird.length < 4 || rightThird.length < 4) {
    return false;
  }

  const leftTrend = pctChange(leftThird[0]!.close, leftThird[leftThird.length - 1]!.close);
  const rightTrend = pctChange(rightThird[0]!.close, rightThird[rightThird.length - 1]!.close);
  if (leftTrend > -4 || rightTrend < 2.5) return false;

  const midLow = Math.min(...midThird.map((b) => b.low));
  if (midLow > cupLow * 1.04) return false;

  const handleLow = Math.min(...handleBars.map((b) => b.low));
  const handleHigh = Math.max(...handleBars.map((b) => b.high));
  if (handleLow <= cupLow * 1.01) return false;
  const handleDepthPct = pctChange(handleLow, rimHigh);
  if (handleDepthPct > 18 || handleDepthPct < 2) return false;
  if (handleHigh > rimHigh * 1.015) return false;

  const breakoutLevel = rimHigh;
  return crossesAbove(bars, breakoutLevel);
}

function detectLongBase(
  bars: OhlcvBar[],
  direction: "up" | "down",
  options: ChartPatternOptions,
): boolean {
  if (bars.length < 30) return false;

  const minBaseLen = Math.floor(bars.length * 0.72);
  const baseBars = bars.slice(0, bars.length - 1);
  if (baseBars.length < minBaseLen) return false;

  const baseHigh = Math.max(...baseBars.map((b) => b.high));
  const baseLow = Math.min(...baseBars.map((b) => b.low));
  const mid = (baseHigh + baseLow) / 2;
  if (mid <= 0) return false;

  const rangePct = ((baseHigh - baseLow) / mid) * 100;
  if (rangePct > options.maxBaseRangePct) return false;

  const insideBase = baseBars.filter(
    (b) => b.close >= baseLow && b.close <= baseHigh,
  ).length;
  if (insideBase / baseBars.length < 0.82) return false;

  const closes = baseBars.map((b) => b.close);
  const slope = pctChange(closes[0]!, closes[closes.length - 1]!);
  if (Math.abs(slope) > options.maxBaseRangePct * 0.75) return false;

  const touchHigh = baseBars.filter((b) => b.high >= baseHigh * 0.985).length;
  const touchLow = baseBars.filter((b) => b.low <= baseLow * 1.015).length;
  if (touchHigh < 2 || touchLow < 2) return false;

  if (direction === "up") {
    return crossesAbove(bars, baseHigh);
  }
  return crossesBelow(bars, baseLow);
}

function detectLongBaseBreakout(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  return detectLongBase(bars, "up", options);
}

function detectLongBaseBreakdown(
  bars: OhlcvBar[],
  options: ChartPatternOptions,
): boolean {
  return detectLongBase(bars, "down", options);
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
  return pattern
    .split("_")
    .map((w) => {
      if (w === "and") return "&";
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}
