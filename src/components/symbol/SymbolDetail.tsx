"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PriceChart } from "@/components/chart/PriceChart";
import { runBacktest } from "@/lib/engine/backtest";
import { computeIndicators } from "@/lib/engine/indicators";
import { EMA_CROSS_PATTERN } from "@/lib/patterns/defaults";
import { getPriceBars } from "@/lib/storage/prices";
import type { BacktestResult, OhlcvBar } from "@/lib/types";

export function SymbolDetail({ symbol }: { symbol: string }) {
  const [bars, setBars] = useState<OhlcvBar[]>([]);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [emaFast, setEmaFast] = useState<(number | null)[]>([]);
  const [emaSlow, setEmaSlow] = useState<(number | null)[]>([]);

  useEffect(() => {
    void (async () => {
      const data = await getPriceBars(symbol);
      setBars(data);
      if (data.length > 0) {
        const bt = runBacktest(symbol, data, EMA_CROSS_PATTERN);
        setResult(bt);
        const ctx = computeIndicators(data, EMA_CROSS_PATTERN.indicators);
        setEmaFast(ctx.series.ema_fast ?? []);
        setEmaSlow(ctx.series.ema_slow ?? []);
      }
    })();
  }, [symbol]);

  if (bars.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-12 text-center">
        <p className="text-muted">No data for {symbol} in your browser.</p>
        <Link href="/data" className="mt-4 inline-block text-brand underline">
          Download prices
        </Link>
      </div>
    );
  }

  const last = bars[bars.length - 1]!;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Symbol</p>
        <h1 className="mt-2 text-4xl font-semibold text-ink">{symbol}</h1>
        <p className="mt-2 text-muted">
          Last close ${last.close.toFixed(2)} · {bars.length} daily bars stored
          locally
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-8">
        <h2 className="text-xl font-semibold text-ink">Price chart</h2>
        <div className="mt-4">
          <PriceChart
            bars={bars.slice(-252)}
            signals={result?.signals ?? []}
            emaFast={emaFast.slice(-252)}
            emaSlow={emaSlow.slice(-252)}
          />
        </div>
      </section>

      {result && (
        <section className="rounded-3xl border border-border bg-surface p-8">
          <h2 className="text-xl font-semibold text-ink">
            EMA 3/50 backtest (default pattern)
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Trades" value={String(result.stats.trades)} />
            <Metric
              label="Win rate"
              value={`${result.stats.winRate.toFixed(1)}%`}
            />
            <Metric
              label="Avg return"
              value={`${result.stats.avgReturnPct.toFixed(2)}%`}
            />
            <Metric
              label="Best / worst"
              value={`${result.stats.bestReturnPct.toFixed(1)}% / ${result.stats.worstReturnPct.toFixed(1)}%`}
            />
          </div>

          {result.trades.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 pr-4">Entry</th>
                    <th className="py-2 pr-4">Exit</th>
                    <th className="py-2 pr-4">Hold</th>
                    <th className="py-2">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.trades].reverse().slice(0, 10).map((t) => (
                    <tr key={`${t.entryDate}-${t.exitDate}`} className="border-b border-border/40">
                      <td className="py-2 pr-4">{t.entryDate}</td>
                      <td className="py-2 pr-4">{t.exitDate}</td>
                      <td className="py-2 pr-4">{t.holdDays}d</td>
                      <td
                        className={`py-2 ${t.returnPct >= 0 ? "text-brand" : "text-danger"}`}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
