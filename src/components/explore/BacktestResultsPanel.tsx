"use client";

import { useMemo } from "react";
import { EquityCurveChart } from "@/components/chart/EquityCurveChart";
import { MonthlyReturnsHeatmap } from "@/components/chart/MonthlyReturnsHeatmap";
import { ReturnDistributionChart } from "@/components/chart/ReturnDistributionChart";
import {
  computeEquityCurves,
  computeExtendedStats,
  computeMonthlyReturns,
  computeReturnDistribution,
  exportBacktestCsv,
  meanReturn,
} from "@/lib/analytics/backtest-analytics";
import type { BacktestResult, OhlcvBar } from "@/lib/types";

interface BacktestResultsPanelProps {
  preview: BacktestResult | null;
  fullBars: OhlcvBar[];
  symbol: string;
  patternName: string;
  dataRange: { from: string; to: string } | null;
  symbolInput: string;
  onSymbolChange: (symbol: string) => void;
}

export function BacktestResultsPanel({
  preview,
  fullBars,
  symbol,
  patternName,
  dataRange,
  symbolInput,
  onSymbolChange,
}: BacktestResultsPanelProps) {
  const extendedStats = useMemo(
    () => (preview ? computeExtendedStats(preview) : null),
    [preview],
  );
  const equityCurves = useMemo(
    () =>
      preview && fullBars.length > 0
        ? computeEquityCurves(fullBars, preview.trades)
        : null,
    [preview, fullBars],
  );
  const monthlyReturns = useMemo(
    () => (preview ? computeMonthlyReturns(preview.trades) : []),
    [preview],
  );
  const distribution = useMemo(
    () => (preview ? computeReturnDistribution(preview.trades) : []),
    [preview],
  );
  const avgReturn = useMemo(
    () => (preview ? meanReturn(preview.trades) : 0),
    [preview],
  );

  return (
    <section className="ui-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="ui-page-title">Backtest results</h2>
          <p className="ui-helper mt-1">
            {symbol} · {patternName}
            {dataRange && (
              <>
                {" "}
                · {formatDate(dataRange.from)} – {formatDate(dataRange.to)}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={symbolInput}
            onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
            className="ui-input w-auto font-mono"
          />
          {preview && (
            <button
              type="button"
              onClick={() =>
                exportBacktestCsv(preview, symbol, patternName, dataRange)
              }
              className="ui-btn-secondary"
            >
              Export
            </button>
          )}
        </div>
      </div>

      {preview && extendedStats ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Stat
              label="Total return"
              value={`${extendedStats.totalReturnPct >= 0 ? "+" : ""}${extendedStats.totalReturnPct.toFixed(2)}%`}
              tone={extendedStats.totalReturnPct >= 0 ? "success" : "danger"}
            />
            <Stat
              label="Sharpe"
              value={
                preview.stats.sharpe != null
                  ? preview.stats.sharpe.toFixed(2)
                  : "—"
              }
              sub={
                preview.stats.sharpe != null && preview.stats.sharpe >= 1
                  ? "Good"
                  : undefined
              }
              tone="success"
            />
            <Stat
              label="Max drawdown"
              value={`${extendedStats.maxDrawdownPct.toFixed(2)}%`}
              tone="danger"
            />
            <Stat
              label="Win rate"
              value={`${preview.stats.winRate.toFixed(1)}%`}
              tone="info"
            />
            <Stat label="Total trades" value={String(preview.stats.trades)} />
            <Stat
              label="Profit factor"
              value={
                extendedStats.profitFactor === Infinity
                  ? "∞"
                  : extendedStats.profitFactor.toFixed(2)
              }
            />
            <Stat
              label="Avg return / trade"
              value={`${preview.stats.avgReturnPct.toFixed(2)}%`}
              tone={preview.stats.avgReturnPct >= 0 ? "success" : "danger"}
            />
          </div>

          {preview.trades.length > 0 && equityCurves && (
            <div className="mt-6 grid gap-4 lg:grid-cols-12">
              <div className="rounded-lg border border-border bg-bg p-4 lg:col-span-5">
                <h3 className="ui-section-title">Equity curve</h3>
                <p className="ui-helper mt-0.5">Cumulative return</p>
                <div className="mt-3">
                  <EquityCurveChart
                    strategy={equityCurves.strategy}
                    buyHold={equityCurves.buyHold}
                    symbol={symbol}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-bg p-4 lg:col-span-4">
                <h3 className="ui-section-title">Monthly returns (%)</h3>
                <div className="mt-3">
                  <MonthlyReturnsHeatmap data={monthlyReturns} />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-bg p-4 lg:col-span-3">
                <h3 className="ui-section-title">Distribution of returns</h3>
                <div className="mt-3">
                  <ReturnDistributionChart bins={distribution} mean={avgReturn} />
                </div>
              </div>
            </div>
          )}

          {preview.trades.length > 0 && (
            <div className="mt-6">
              <h3 className="ui-section-title">Trade log (recent 5)</h3>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg text-xs uppercase tracking-[0.15em] text-muted">
                      <th className="px-4 py-3">Entry</th>
                      <th className="px-4 py-3">Exit</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Entry price</th>
                      <th className="px-4 py-3">Exit price</th>
                      <th className="px-4 py-3">Days held</th>
                      <th className="px-4 py-3">Return</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...preview.trades].reverse().slice(0, 5).map((t) => (
                      <tr
                        key={`${t.entryDate}-${t.exitDate}`}
                        className="border-b border-border/40 hover:bg-bg/40"
                      >
                        <td className="px-4 py-2.5">{t.entryDate}</td>
                        <td className="px-4 py-2.5">{t.exitDate}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                              t.side === "long"
                                ? "bg-info/15 text-info"
                                : "bg-danger/15 text-danger"
                            }`}
                          >
                            {t.side}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          ${t.entryPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          ${t.exitPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5">{t.holdDays}</td>
                        <td
                          className={`px-4 py-2.5 font-semibold ${t.returnPct >= 0 ? "text-success" : "text-danger"}`}
                        >
                          {t.returnPct >= 0 ? "+" : ""}
                          {t.returnPct.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                            Closed
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ui-helper mt-3">
                Past performance is not indicative of future results. Backtests
                do not include transaction costs or slippage.
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="mt-5 text-sm text-muted">
          Select a strategy to see backtest metrics for {symbol}.
        </p>
      )}
    </section>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "danger" | "info";
}) {
  const valueColor =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "info"
          ? "text-info"
          : "text-ink";

  return (
    <div className="ui-stat">
      <div className="ui-field-label">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${valueColor}`}>{value}</div>
      {sub && <div className="text-[10px] text-success">{sub}</div>}
    </div>
  );
}
