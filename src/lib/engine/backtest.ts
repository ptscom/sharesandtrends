import type {
  BacktestConfig,
  BacktestResult,
  BacktestStats,
  OhlcvBar,
  PatternDefinition,
  SignalPoint,
  Trade,
} from "@/lib/types";
import { computeIndicators } from "./indicators";
import { evaluateOptional, evaluateSeries } from "./evaluate";

export function computeStats(trades: Trade[]): BacktestStats {
  if (trades.length === 0) {
    return {
      trades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgReturnPct: 0,
      medianReturnPct: 0,
      bestReturnPct: 0,
      worstReturnPct: 0,
      sharpe: null,
    };
  }

  const returns = trades.map((t) => t.returnPct);
  const wins = trades.filter((t) => t.returnPct > 0).length;
  const losses = trades.length - wins;
  const sorted = [...returns].sort((a, b) => a - b);
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const variance =
    returns.reduce((sum, r) => sum + (r - avg) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (avg / std) * Math.sqrt(252) : null;

  return {
    trades: trades.length,
    wins,
    losses,
    winRate: (wins / trades.length) * 100,
    avgReturnPct: avg,
    medianReturnPct: median,
    bestReturnPct: Math.max(...returns),
    worstReturnPct: Math.min(...returns),
    sharpe,
  };
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function runBacktest(
  symbol: string,
  bars: OhlcvBar[],
  pattern: PatternDefinition,
): BacktestResult {
  const ctx = computeIndicators(bars, pattern.indicators);
  const filterMask = evaluateOptional(ctx, pattern.filters);
  const entryMask = evaluateSeries(ctx, pattern.entry);
  const exitMask = pattern.exit
    ? evaluateSeries(ctx, pattern.exit)
    : ctx.dates.map(() => false);

  const config: BacktestConfig = pattern.backtest;
  const trades: Trade[] = [];
  const signals: SignalPoint[] = [];

  let inTrade = false;
  let side: "long" | "short" = "long";
  let entryIndex = 0;
  let entryPrice = 0;

  for (let i = 1; i < ctx.dates.length; i++) {
    if (!filterMask[i]) continue;

    const bar = ctx.bars[i];

    if (!inTrade && entryMask[i]) {
      const entryIdx =
        config.entryOn === "next_open" && i + 1 < ctx.bars.length
          ? i + 1
          : i;
      const entryBar = ctx.bars[entryIdx];
      inTrade = true;
      entryIndex = entryIdx;
      entryPrice =
        config.entryOn === "next_open" ? entryBar.open : entryBar.close;
      side = "long";
      signals.push({
        date: ctx.dates[entryIdx],
        type: "entry",
        side,
        price: entryPrice,
      });
      continue;
    }

    if (!inTrade) continue;

    let shouldExit = false;
    if (config.exitOn === "opposite_signal" && exitMask[i]) {
      shouldExit = true;
    }
    if (
      config.exitOn === "fixed_hold" &&
      config.holdDays &&
      i - entryIndex >= config.holdDays
    ) {
      shouldExit = true;
    }

    if (!shouldExit) continue;

    const exitPrice = bar.close;
    const returnPct = ((exitPrice - entryPrice) / entryPrice) * 100;
    trades.push({
      entryDate: ctx.dates[entryIndex],
      exitDate: ctx.dates[i],
      side,
      entryPrice,
      exitPrice,
      returnPct,
      holdDays: daysBetween(ctx.dates[entryIndex], ctx.dates[i]),
    });
    signals.push({
      date: ctx.dates[i],
      type: "exit",
      side,
      price: exitPrice,
    });
    inTrade = false;
  }

  if (inTrade) {
    const lastIdx = ctx.bars.length - 1;
    const exitPrice = ctx.bars[lastIdx].close;
    trades.push({
      entryDate: ctx.dates[entryIndex],
      exitDate: ctx.dates[lastIdx],
      side,
      entryPrice,
      exitPrice,
      returnPct: ((exitPrice - entryPrice) / entryPrice) * 100,
      holdDays: daysBetween(ctx.dates[entryIndex], ctx.dates[lastIdx]),
    });
  }

  return {
    symbol,
    stats: computeStats(trades),
    trades,
    signals,
  };
}

export function hasSignalToday(
  bars: OhlcvBar[],
  pattern: PatternDefinition,
): { signalToday: boolean; signalDate: string | null } {
  if (bars.length < 2) return { signalToday: false, signalDate: null };
  const ctx = computeIndicators(bars, pattern.indicators);
  const filterMask = evaluateOptional(ctx, pattern.filters);
  const entryMask = evaluateSeries(ctx, pattern.entry);
  const last = ctx.dates.length - 1;
  if (!filterMask[last] || !entryMask[last]) {
    return { signalToday: false, signalDate: null };
  }
  return { signalToday: true, signalDate: ctx.dates[last] };
}
