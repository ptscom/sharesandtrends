import type { BacktestResult, OhlcvBar, Trade } from "@/lib/types";

export interface EquityPoint {
  date: string;
  value: number;
}

export interface MonthlyReturn {
  year: number;
  month: number;
  returnPct: number;
}

export interface DistributionBin {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface ExtendedBacktestStats {
  totalReturnPct: number;
  profitFactor: number;
  maxDrawdownPct: number;
}

export function computeExtendedStats(preview: BacktestResult): ExtendedBacktestStats {
  const { trades } = preview;
  if (trades.length === 0) {
    return { totalReturnPct: 0, profitFactor: 0, maxDrawdownPct: 0 };
  }

  const totalReturnPct =
    (trades.reduce((acc, t) => acc * (1 + t.returnPct / 100), 1) - 1) * 100;

  const grossProfit = trades
    .filter((t) => t.returnPct > 0)
    .reduce((sum, t) => sum + t.returnPct, 0);
  const grossLoss = Math.abs(
    trades
      .filter((t) => t.returnPct < 0)
      .reduce((sum, t) => sum + t.returnPct, 0),
  );
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  let peak = 1;
  let equity = 1;
  let maxDrawdownPct = 0;
  for (const trade of trades) {
    equity *= 1 + trade.returnPct / 100;
    if (equity > peak) peak = equity;
    const drawdown = ((equity - peak) / peak) * 100;
    if (drawdown < maxDrawdownPct) maxDrawdownPct = drawdown;
  }

  return { totalReturnPct, profitFactor, maxDrawdownPct };
}

export function computeEquityCurves(
  bars: OhlcvBar[],
  trades: Trade[],
): { strategy: EquityPoint[]; buyHold: EquityPoint[] } {
  if (bars.length === 0) return { strategy: [], buyHold: [] };

  const exitEquity = new Map<string, number>();
  let equity = 100;
  for (const trade of trades) {
    equity *= 1 + trade.returnPct / 100;
    exitEquity.set(trade.exitDate, equity);
  }

  const firstClose = bars[0]!.close;
  let strategyEquity = 100;
  const strategy: EquityPoint[] = [];
  const buyHold: EquityPoint[] = [];

  for (const bar of bars) {
    if (exitEquity.has(bar.date)) {
      strategyEquity = exitEquity.get(bar.date)!;
    }
    strategy.push({ date: bar.date, value: strategyEquity });
    buyHold.push({ date: bar.date, value: (bar.close / firstClose) * 100 });
  }

  return { strategy, buyHold };
}

export function computeMonthlyReturns(trades: Trade[]): MonthlyReturn[] {
  const byMonth = new Map<string, number[]>();

  for (const trade of trades) {
    const key = trade.exitDate.slice(0, 7);
    const bucket = byMonth.get(key) ?? [];
    bucket.push(trade.returnPct);
    byMonth.set(key, bucket);
  }

  const results: MonthlyReturn[] = [];
  for (const [key, returns] of byMonth) {
    const compounded =
      (returns.reduce((acc, r) => acc * (1 + r / 100), 1) - 1) * 100;
    const [year, month] = key.split("-").map(Number);
    if (year && month) {
      results.push({ year, month, returnPct: compounded });
    }
  }

  return results.sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  );
}

export function computeReturnDistribution(
  trades: Trade[],
  binCount = 12,
): DistributionBin[] {
  if (trades.length === 0) return [];

  const returns = trades.map((t) => t.returnPct);
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const span = max - min || 1;
  const step = span / binCount;

  const bins: DistributionBin[] = Array.from({ length: binCount }, (_, i) => {
    const lo = min + i * step;
    const hi = lo + step;
    return {
      label: `${lo.toFixed(1)}`,
      min: lo,
      max: hi,
      count: 0,
    };
  });

  for (const r of returns) {
    const idx = Math.min(
      binCount - 1,
      Math.max(0, Math.floor((r - min) / step)),
    );
    bins[idx]!.count += 1;
  }

  return bins;
}

export function meanReturn(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  return trades.reduce((sum, t) => sum + t.returnPct, 0) / trades.length;
}

export function exportBacktestCsv(
  preview: BacktestResult,
  symbol: string,
  patternName: string,
  dataRange: { from: string; to: string } | null,
): void {
  const lines: string[] = [
    "Shares & Trends Backtest Export",
    `Symbol,${symbol}`,
    `Strategy,${patternName}`,
    dataRange ? `From,${dataRange.from}` : "",
    dataRange ? `To,${dataRange.to}` : "",
    "",
    "Metric,Value",
    `Total Trades,${preview.stats.trades}`,
    `Win Rate,${preview.stats.winRate.toFixed(2)}%`,
    `Avg Return,${preview.stats.avgReturnPct.toFixed(2)}%`,
    `Sharpe,${preview.stats.sharpe?.toFixed(2) ?? ""}`,
    "",
    "Entry Date,Exit Date,Side,Entry Price,Exit Price,Hold Days,Return %",
    ...preview.trades.map(
      (t) =>
        `${t.entryDate},${t.exitDate},${t.side},${t.entryPrice.toFixed(2)},${t.exitPrice.toFixed(2)},${t.holdDays},${t.returnPct.toFixed(2)}`,
    ),
  ].filter(Boolean);

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${symbol}-${patternName.replace(/\s+/g, "-").toLowerCase()}-backtest.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
