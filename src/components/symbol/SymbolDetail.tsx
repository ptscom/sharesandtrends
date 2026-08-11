"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PriceChart } from "@/components/chart/PriceChart";
import { runBacktest } from "@/lib/engine/backtest";
import { extractCandlePatternMarkers } from "@/lib/engine/candle-patterns";
import { computeIndicators } from "@/lib/engine/indicators";
import { chartOverlays } from "@/lib/patterns/optimization";
import { resolveSymbolPattern } from "@/lib/patterns/preset-store";
import { getPriceBars } from "@/lib/storage/prices";
import type {
  BacktestResult,
  OhlcvBar,
  PatternDefinition,
  ScanRun,
} from "@/lib/types";

export function SymbolDetail({
  symbol,
  scanId,
  patternId,
}: {
  symbol: string;
  scanId?: string;
  patternId?: string;
}) {
  const [bars, setBars] = useState<OhlcvBar[]>([]);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [pattern, setPattern] = useState<PatternDefinition | null>(null);
  const [scan, setScan] = useState<ScanRun | null>(null);
  const [overlayFast, setOverlayFast] = useState<(number | null)[]>([]);
  const [overlaySlow, setOverlaySlow] = useState<(number | null)[]>([]);
  const [patternMarkers, setPatternMarkers] = useState<
    { date: string; label: string }[]
  >([]);

  useEffect(() => {
    void (async () => {
      const [{ pattern: resolved, scan: resolvedScan }, data] = await Promise.all([
        resolveSymbolPattern({ scanId, patternId }),
        getPriceBars(symbol),
      ]);

      setPattern(resolved);
      setScan(resolvedScan);
      setBars(data);

      if (data.length > 0) {
        const bt = runBacktest(symbol, data, resolved);
        setResult(bt);
        const ctx = computeIndicators(data, resolved.indicators);
        const overlays = chartOverlays(resolved, ctx.series);
        setOverlayFast(overlays.fast ?? []);
        setOverlaySlow(overlays.slow ?? []);
        const windowBars = data.slice(-252);
        const windowDates = new Set(windowBars.map((b) => b.date));
        setPatternMarkers(
          extractCandlePatternMarkers(data, ctx.series, resolved.indicators).filter(
            (m) => windowDates.has(m.date),
          ),
        );
      } else {
        setResult(null);
        setOverlayFast([]);
        setOverlaySlow([]);
        setPatternMarkers([]);
      }
    })();
  }, [symbol, scanId, patternId]);

  if (bars.length === 0) {
    return (
      <div className="ui-panel p-12 text-center">
        <p className="text-muted">No data for {symbol} in your browser.</p>
        <Link href="/data" className="mt-4 inline-block text-brand underline">
          Download prices
        </Link>
      </div>
    );
  }

  const last = bars[bars.length - 1]!;

  return (
    <div className="space-y-6">
      <section className="ui-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="ui-eyebrow">Symbol</p>
            <h1 className="ui-page-title mt-2">{symbol}</h1>
            <p className="ui-helper mt-2">
              Last close ${last.close.toFixed(2)} · {bars.length} daily bars stored
              locally
            </p>
            {pattern && (
              <p className="mt-1 text-sm font-medium text-brand-text">{pattern.name}</p>
            )}
          </div>
          {scan && (
            <Link href={`/scans/${scan.id}`} className="ui-btn-secondary">
              ← Back to Results
            </Link>
          )}
        </div>
      </section>

      <section className="ui-panel p-6">
        <h2 className="ui-section-title">Price chart</h2>
        <div className="mt-4">
          <PriceChart
            bars={bars.slice(-252)}
            signals={result?.signals ?? []}
            emaFast={overlayFast.slice(-252)}
            emaSlow={overlaySlow.slice(-252)}
            patternMarkers={patternMarkers}
          />
        </div>
      </section>

      {result && pattern && (
        <section className="ui-panel p-6">
          <p className="ui-eyebrow">Backtest results</p>
          <h2 className="ui-section-title mt-2">{pattern.name}</h2>
          {pattern.description && (
            <p className="ui-helper mt-1">{pattern.description}</p>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Trades" value={String(result.stats.trades)} tint="orange" />
            <Metric
              label="Win rate"
              value={`${result.stats.winRate.toFixed(1)}%`}
              tint="green"
            />
            <Metric
              label="Avg return"
              value={`${result.stats.avgReturnPct.toFixed(2)}%`}
              tint="purple"
            />
            <Metric
              label="Best / worst"
              value={
                <span>
                  <span className="text-success">
                    {result.stats.bestReturnPct.toFixed(1)}%
                  </span>
                  <span className="text-body"> / </span>
                  <span className="text-danger">
                    {result.stats.worstReturnPct.toFixed(1)}%
                  </span>
                </span>
              }
              tint="red"
            />
          </div>

          {result.trades.length > 0 && (
            <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle">
              <table className="ui-table min-w-[480px]">
                <thead>
                  <tr>
                    <th className="px-4">Entry</th>
                    <th className="px-4">Exit</th>
                    <th className="px-4">Hold</th>
                    <th className="px-4">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.trades].reverse().slice(0, 10).map((t) => (
                    <tr key={`${t.entryDate}-${t.exitDate}`}>
                      <td className="px-4">{t.entryDate}</td>
                      <td className="px-4">{t.exitDate}</td>
                      <td className="px-4">{t.holdDays}d</td>
                      <td
                        className={`px-4 font-semibold ${t.returnPct >= 0 ? "text-success" : "text-danger"}`}
                      >
                        {t.returnPct >= 0 ? "+" : ""}
                        {t.returnPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tint,
}: {
  label: string;
  value: ReactNode;
  tint: "orange" | "green" | "purple" | "red";
}) {
  const tintClass =
    tint === "orange"
      ? "ui-stat-tint-orange"
      : tint === "green"
        ? "ui-stat-tint-green"
        : tint === "purple"
          ? "ui-stat-tint-purple"
          : "ui-stat-tint-red";

  return (
    <div className={tintClass}>
      <div className="ui-field-label">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}
