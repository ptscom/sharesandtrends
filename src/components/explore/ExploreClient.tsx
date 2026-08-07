"use client";

import { formatShareCaption, ShareCaption } from "@/components/share/ShareCaption";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PriceChart } from "@/components/chart/PriceChart";
import { runBacktest } from "@/lib/engine/backtest";
import { computeIndicators } from "@/lib/engine/indicators";
import { runUniverseScanInWorker } from "@/lib/engine/scan-worker-client";
import { EMA_CROSS_PATTERN } from "@/lib/patterns/defaults";
import type { StrategyPreset } from "@/lib/patterns/strategies";
import { STRATEGY_PRESETS } from "@/lib/patterns/strategies";
import { StrategyPicker } from "@/components/explore/StrategyPicker";
import { savePattern, saveScanRun } from "@/lib/storage/patterns";
import { getPriceBars, listSymbols } from "@/lib/storage/prices";
import type { BacktestResult, PatternDefinition, ScanRun } from "@/lib/types";
import { DEFAULT_WATCHLIST } from "@/lib/data/default-universe";

export function ExploreClient() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("ema-cross");
  const [pattern, setPattern] = useState<PatternDefinition>(EMA_CROSS_PATTERN);
  const [minWinRate, setMinWinRate] = useState(70);
  const [minTrades, setMinTrades] = useState(5);
  const [signalTodayOnly, setSignalTodayOnly] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [scan, setScan] = useState<ScanRun | null>(null);
  const [previewSymbol, setPreviewSymbol] = useState("AAPL");
  const [preview, setPreview] = useState<BacktestResult | null>(null);
  const [storedSymbols, setStoredSymbols] = useState<string[]>([]);

  const selectStrategy = useCallback((preset: StrategyPreset) => {
    setSelectedId(preset.id);
    setPattern(preset.pattern);
  }, []);

  const buildPattern = useCallback((): PatternDefinition => pattern, [pattern]);

  useEffect(() => {
    let cancelled = false;
    listSymbols().then((list) => {
      if (!cancelled) setStoredSymbols(list.map((s) => s.symbol));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPreset = STRATEGY_PRESETS.find((s) => s.id === selectedId);

  const runPreview = useCallback(async () => {
    const bars = await getPriceBars(previewSymbol);
    if (bars.length === 0) return;
    setPreview(runBacktest(previewSymbol, bars, buildPattern()));
  }, [previewSymbol, buildPattern]);

  const runScan = useCallback(async () => {
    const universe =
      storedSymbols.length > 0 ? storedSymbols : DEFAULT_WATCHLIST;
    if (universe.length === 0) {
      alert("No symbols in browser. Go to Data page and download prices first.");
      return;
    }

    setScanning(true);
    setScanProgress({ done: 0, total: universe.length });

    try {
      const p = buildPattern();
      const saved = await savePattern(p);
      const result = await runUniverseScanInWorker({
        universe,
        pattern: saved,
        minWinRate,
        minTrades,
        signalTodayOnly,
        onProgress: (done, total) => setScanProgress({ done, total }),
      });
      await saveScanRun(result);
      setScan(result);
      router.push(`/scans/${result.id}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [
    storedSymbols,
    buildPattern,
    minWinRate,
    minTrades,
    signalTodayOnly,
    router,
  ]);

  const [chartBars, setChartBars] = useState<
    import("@/lib/types").OhlcvBar[]
  >([]);
  const [emaFast, setEmaFast] = useState<(number | null)[]>([]);
  const [emaSlow, setEmaSlow] = useState<(number | null)[]>([]);

  useEffect(() => {
    void (async () => {
      const bars = await getPriceBars(previewSymbol);
      setChartBars(bars.slice(-252));
      if (bars.length > 0) {
        const p = buildPattern();
        const ctx = computeIndicators(bars, p.indicators);
        setEmaFast(ctx.series.ema_fast ?? []);
        setEmaSlow(ctx.series.ema_slow ?? []);
      }
    })();
  }, [previewSymbol, buildPattern]);

  const activePattern = buildPattern();

  return (
    <div className="space-y-8">
      <section className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-3xl border border-border bg-surface p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Pattern builder
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">
            {activePattern.name}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {selectedPreset?.entryLogic ?? activePattern.description}
          </p>
          {selectedPreset && (
            <p className="mt-1 text-xs text-muted">
              Params: {selectedPreset.defaultParams} · Exit:{" "}
              {selectedPreset.exitLogic}
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-muted">
                Min win rate %
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={minWinRate}
                onChange={(e) => setMinWinRate(Number(e.target.value))}
                className="mt-2 w-full rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-muted">
                Min trades
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={minTrades}
                onChange={(e) => setMinTrades(Number(e.target.value))}
                className="mt-2 w-full rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-semibold"
              />
            </div>
          </div>

          <label className="mt-4 flex items-center gap-3 text-sm text-muted">
            <input
              type="checkbox"
              checked={signalTodayOnly}
              onChange={(e) => setSignalTodayOnly(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Only show symbols with a signal today
          </label>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runScan()}
              disabled={scanning}
              className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-bg disabled:opacity-50"
            >
              {scanning
                ? `Loading & scanning ${scanProgress.done}/${scanProgress.total}…`
                : "Scan universe"}
            </button>
            <button
              type="button"
              onClick={() => void runPreview()}
              className="rounded-full border border-border px-6 py-3 text-sm text-muted hover:text-ink"
            >
              Backtest preview
            </button>
          </div>

          <p className="mt-4 text-xs text-muted">
            {storedSymbols.length} symbols stored locally
            {storedSymbols.length === 0 && (
              <>
                {" "}
                —{" "}
                <Link href="/data" className="text-brand underline">
                  download data
                </Link>{" "}
                first
              </>
            )}
          </p>

          <StrategyPicker selectedId={selectedId} onSelect={selectStrategy} />
        </div>

        <div className="rounded-3xl border border-border bg-surface p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-ink">Chart preview</h2>
            <input
              value={previewSymbol}
              onChange={(e) => setPreviewSymbol(e.target.value.toUpperCase())}
              className="rounded-full border border-border bg-bg px-4 py-2 font-mono text-sm"
            />
          </div>
          <div className="mt-4">
            {chartBars.length > 0 ? (
              <PriceChart
                bars={chartBars}
                signals={preview?.signals ?? []}
                emaFast={emaFast.slice(-252)}
                emaSlow={emaSlow.slice(-252)}
              />
            ) : (
              <p className="py-20 text-center text-sm text-muted">
                No local data for {previewSymbol}.{" "}
                <Link href="/data" className="text-brand underline">
                  Fetch it
                </Link>
              </p>
            )}
          </div>
          {preview && (
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <Stat label="Trades" value={String(preview.stats.trades)} />
              <Stat
                label="Win rate"
                value={`${preview.stats.winRate.toFixed(1)}%`}
              />
              <Stat
                label="Avg return"
                value={`${preview.stats.avgReturnPct.toFixed(2)}%`}
              />
              <Stat
                label="Sharpe"
                value={
                  preview.stats.sharpe != null
                    ? preview.stats.sharpe.toFixed(2)
                    : "—"
                }
              />
            </div>
          )}
        </div>
      </section>

      {scan && (
        <section className="rounded-3xl border border-border bg-surface p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">
                Latest scan
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                {scan.patternName}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {scan.results.length} matches ·{" "}
                <Link href={`/scans/${scan.id}`} className="text-brand underline">
                  Open full results
                </Link>
              </p>
            </div>
            <ShareCaption scan={scan} />
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-[0.15em] text-muted">
                  <th className="py-3 pr-4">Symbol</th>
                  <th className="py-3 pr-4">Signal</th>
                  <th className="py-3 pr-4">Win rate</th>
                  <th className="py-3 pr-4">Trades</th>
                  <th className="py-3 pr-4">Avg return</th>
                  <th className="py-3">Caption</th>
                </tr>
              </thead>
              <tbody>
                {scan.results.slice(0, 10).map((row) => (
                  <tr
                    key={row.symbol}
                    className="border-b border-border/50 hover:bg-bg/50"
                  >
                    <td className="py-3 pr-4">
                      <Link
                        href={`/symbol/${row.symbol}`}
                        className="font-mono font-semibold text-brand"
                      >
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      {row.signalToday ? (
                        <span className="rounded-full bg-brand/15 px-2 py-1 text-xs font-semibold text-brand">
                          Today
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {row.stats.winRate.toFixed(1)}%
                    </td>
                    <td className="py-3 pr-4">{row.stats.trades}</td>
                    <td className="py-3 pr-4">
                      {row.stats.avgReturnPct.toFixed(2)}%
                    </td>
                    <td className="py-3">
                      <CopyButton
                        text={formatShareCaption(scan.patternName, row)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="text-xs text-brand underline"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
