import { ATR } from "technicalindicators";
import type { OhlcvBar } from "@/lib/types";

export interface SwingPoint {
  index: number;
  price: number;
  kind: "high" | "low";
}

export interface DoublePatternScale {
  id: string;
  reversalAtrMult: number;
  minSeparation: number;
  maxSeparation: number;
}

export interface DoublePatternParams {
  atrPeriod: number;
  peakToleranceAtr: number;
  minPullbackAtr: number;
  priorTrendBars: number;
  priorTrendMinPct: number;
  necklineBreakAtr: number;
  maxBarsAfterSecondExtreme: number;
  scales: DoublePatternScale[];
}

export const DEFAULT_DOUBLE_PATTERN_PARAMS: DoublePatternParams = {
  atrPeriod: 14,
  peakToleranceAtr: 0.75,
  minPullbackAtr: 1.5,
  priorTrendBars: 20,
  priorTrendMinPct: 5,
  necklineBreakAtr: 0.25,
  maxBarsAfterSecondExtreme: 20,
  scales: [
    { id: "small", reversalAtrMult: 1.5, minSeparation: 6, maxSeparation: 25 },
    { id: "medium", reversalAtrMult: 2, minSeparation: 10, maxSeparation: 50 },
    { id: "large", reversalAtrMult: 3, minSeparation: 20, maxSeparation: 80 },
  ],
};

export function computeAtrSeries(
  bars: OhlcvBar[],
  period = 14,
): (number | null)[] {
  if (bars.length < period + 1) {
    return bars.map(() => null);
  }

  const atr = ATR.calculate({
    high: bars.map((b) => b.high),
    low: bars.map((b) => b.low),
    close: bars.map((b) => b.close),
    period,
  });
  const pad = bars.length - atr.length;
  return [...Array(pad).fill(null), ...atr];
}

function atrAt(
  atr: (number | null)[],
  index: number,
  fallback: number,
): number {
  for (let i = index; i >= 0; i--) {
    const value = atr[i];
    if (value != null && value > 0) return value;
  }
  return fallback;
}

function medianAtr(atr: (number | null)[]): number {
  const values = atr.filter((v): v is number => v != null && v > 0).sort((a, b) => a - b);
  if (values.length === 0) return 1;
  return values[Math.floor(values.length / 2)]!;
}

/**
 * ATR-based ZigZag swings using only bars up to `endIndex` (no look-ahead).
 */
export function buildAtrZigZag(
  bars: OhlcvBar[],
  atr: (number | null)[],
  endIndex: number,
  reversalAtrMult: number,
): SwingPoint[] {
  if (endIndex < 1 || bars.length < 2) return [];

  const fallbackAtr = medianAtr(atr);
  const swings: SwingPoint[] = [];

  let direction = 0;
  let extremeIdx = 0;
  let extremePrice = bars[0]!.close;

  for (let i = 1; i <= endIndex; i++) {
    const bar = bars[i]!;
    const threshold = reversalAtrMult * atrAt(atr, i, fallbackAtr);

    if (direction >= 0) {
      if (bar.high >= extremePrice) {
        extremePrice = bar.high;
        extremeIdx = i;
      }
      if (extremePrice - bar.low >= threshold) {
        swings.push({ index: extremeIdx, price: extremePrice, kind: "high" });
        direction = -1;
        extremePrice = bar.low;
        extremeIdx = i;
      }
      continue;
    }

    if (bar.low <= extremePrice) {
      extremePrice = bar.low;
      extremeIdx = i;
    }
    if (bar.high - extremePrice >= threshold) {
      swings.push({ index: extremeIdx, price: extremePrice, kind: "low" });
      direction = 1;
      extremePrice = bar.high;
      extremeIdx = i;
    }
  }

  return swings;
}

export interface DoublePatternCandidate {
  scaleId: string;
  firstIndex: number;
  secondIndex: number;
  necklineIndex: number;
  necklinePrice: number;
  score: number;
}

function scoreDoublePattern(input: {
  peakSimilarityAtr: number;
  pullbackAtr: number;
  priorTrendPct: number;
  separation: number;
  minSeparation: number;
  maxSeparation: number;
  breakoutStrengthAtr: number;
}): number {
  const peakScore = Math.max(0, 25 - input.peakSimilarityAtr * 20);
  const pullbackScore = Math.min(20, (input.pullbackAtr / 3) * 20);
  const trendScore = Math.min(15, (input.priorTrendPct / 10) * 15);
  const midSep = (input.minSeparation + input.maxSeparation) / 2;
  const sepDistance = Math.abs(input.separation - midSep) / Math.max(midSep, 1);
  const separationScore = Math.max(0, 10 - sepDistance * 10);
  const breakoutScore = Math.min(20, Math.max(0, input.breakoutStrengthAtr) * 10);

  return peakScore + pullbackScore + trendScore + separationScore + breakoutScore;
}

function validatePeakPair(
  bars: OhlcvBar[],
  atr: (number | null)[],
  p1: SwingPoint,
  valley: SwingPoint,
  p2: SwingPoint,
  scale: DoublePatternScale,
  params: DoublePatternParams,
  endIndex: number,
  direction: "top" | "bottom",
): DoublePatternCandidate | null {
  const separation = p2.index - p1.index;
  if (separation < scale.minSeparation || separation > scale.maxSeparation) {
    return null;
  }

  if (
    valley.index <= p1.index ||
    valley.index >= p2.index ||
    p1.index >= p2.index
  ) {
    return null;
  }

  const barsSinceSecond = endIndex - p2.index;
  if (barsSinceSecond < 1 || barsSinceSecond > params.maxBarsAfterSecondExtreme) {
    return null;
  }

  const atrAtSecond = atrAt(atr, p2.index, medianAtr(atr));
  const atrAtEnd = atrAt(atr, endIndex, atrAtSecond);

  const outerSimilarity =
    direction === "top"
      ? Math.abs(p1.price - p2.price)
      : Math.abs(p1.price - p2.price);
  if (outerSimilarity > params.peakToleranceAtr * atrAtSecond) {
    return null;
  }

  const necklinePrice = valley.price;
  const necklineIndex = valley.index;

  const pullbackSize =
    direction === "top"
      ? Math.min(p1.price, p2.price) - necklinePrice
      : necklinePrice - Math.max(p1.price, p2.price);
  if (pullbackSize < params.minPullbackAtr * atrAt(atr, necklineIndex, atrAtSecond)) {
    return null;
  }

  const priorStart = Math.max(0, p1.index - params.priorTrendBars);
  const priorRef =
    direction === "top"
      ? Math.min(...bars.slice(priorStart, p1.index).map((b) => b.low))
      : Math.max(...bars.slice(priorStart, p1.index).map((b) => b.high));

  if (priorRef <= 0) return null;

  const priorTrendPct =
    direction === "top"
      ? ((p1.price - priorRef) / priorRef) * 100
      : ((priorRef - p1.price) / priorRef) * 100;
  if (priorTrendPct < params.priorTrendMinPct) return null;

  const afterSecond = bars.slice(p2.index + 1, endIndex);
  if (afterSecond.length > 0) {
    const wrongSide =
      direction === "top"
        ? afterSecond.filter((b) => b.close < necklinePrice).length
        : afterSecond.filter((b) => b.close > necklinePrice).length;
    if (wrongSide > afterSecond.length * 0.35) return null;
  }

  const current = bars[endIndex]!;
  const prev = bars[endIndex - 1];
  if (!prev) return null;

  const breakLevel =
    direction === "top"
      ? necklinePrice - params.necklineBreakAtr * atrAtEnd
      : necklinePrice + params.necklineBreakAtr * atrAtEnd;

  const confirmed =
    direction === "top"
      ? current.close < breakLevel && prev.close >= breakLevel
      : current.close > breakLevel && prev.close <= breakLevel;
  if (!confirmed) return null;

  const breakoutStrengthAtr =
    direction === "top"
      ? (breakLevel - current.close) / atrAtEnd
      : (current.close - breakLevel) / atrAtEnd;

  const score = scoreDoublePattern({
    peakSimilarityAtr: outerSimilarity / atrAtSecond,
    pullbackAtr: pullbackSize / atrAtSecond,
    priorTrendPct,
    separation,
    minSeparation: scale.minSeparation,
    maxSeparation: scale.maxSeparation,
    breakoutStrengthAtr,
  });

  if (score < 50) return null;

  return {
    scaleId: scale.id,
    firstIndex: p1.index,
    secondIndex: p2.index,
    necklineIndex,
    necklinePrice,
    score,
  };
}

function findDoublePatternCandidate(
  bars: OhlcvBar[],
  endIndex: number,
  direction: "top" | "bottom",
  params: DoublePatternParams = DEFAULT_DOUBLE_PATTERN_PARAMS,
): DoublePatternCandidate | null {
  if (endIndex < 20 || bars.length < endIndex + 1) return null;

  const atr = computeAtrSeries(bars, params.atrPeriod);
  let best: DoublePatternCandidate | null = null;

  for (const scale of params.scales) {
    const maxSep = Math.min(scale.maxSeparation, endIndex);
    const scaleConfig = { ...scale, maxSeparation: maxSep };
    const swings = buildAtrZigZag(bars, atr, endIndex, scale.reversalAtrMult);

    for (let i = 0; i < swings.length - 2; i++) {
      const a = swings[i]!;
      const b = swings[i + 1]!;
      const c = swings[i + 2]!;

      const pattern =
        direction === "top"
          ? a.kind === "high" && b.kind === "low" && c.kind === "high"
          : a.kind === "low" && b.kind === "high" && c.kind === "low";
      if (!pattern) continue;

      const candidate = validatePeakPair(
        bars,
        atr,
        a,
        b,
        c,
        scaleConfig,
        params,
        endIndex,
        direction,
      );
      if (!candidate) continue;
      if (!best || candidate.score > best.score) {
        best = candidate;
      }
    }
  }

  return best;
}

export function detectDoubleTopAt(
  bars: OhlcvBar[],
  endIndex: number,
  params?: Partial<DoublePatternParams>,
): boolean {
  const merged = { ...DEFAULT_DOUBLE_PATTERN_PARAMS, ...params };
  return findDoublePatternCandidate(bars, endIndex, "top", merged) != null;
}

export function detectDoubleBottomAt(
  bars: OhlcvBar[],
  endIndex: number,
  params?: Partial<DoublePatternParams>,
): boolean {
  const merged = { ...DEFAULT_DOUBLE_PATTERN_PARAMS, ...params };
  return findDoublePatternCandidate(bars, endIndex, "bottom", merged) != null;
}
