"use client";

import { formatShareCaption, ShareCaption } from "@/components/share/ShareCaption";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PriceChart } from "@/components/chart/PriceChart";
import { BacktestResultsPanel } from "@/components/explore/BacktestResultsPanel";
import { OptimizationPanel } from "@/components/explore/OptimizationPanel";
import { StrategyPicker } from "@/components/explore/StrategyPicker";
import { runBacktest } from "@/lib/engine/backtest";
import { extractCandlePatternMarkers } from "@/lib/engine/candle-patterns";
import { computeIndicators } from "@/lib/engine/indicators";
import { runUniverseScanInWorker } from "@/lib/engine/scan-worker-client";
import { patternToPreset } from "@/lib/patterns/custom";
import { EMA_CROSS_PATTERN } from "@/lib/patterns/defaults";
import { chartOverlays } from "@/lib/patterns/optimization";
import {
  getEffectivePreset,
  isBuiltInPresetId,
  listModifiedPresetIds,
} from "@/lib/patterns/preset-store";
import type { StrategyPreset } from "@/lib/patterns/strategies";
import { STRATEGY_PRESETS } from "@/lib/patterns/strategies";
import {
  getPattern,
  listPatterns,
  savePattern,
  saveScanRun,
} from "@/lib/storage/patterns";
import { getPriceBars, listSymbols } from "@/lib/storage/prices";
import type { BacktestResult, PatternDefinition, ScanRun } from "@/lib/types";
import { DEFAULT_WATCHLIST } from "@/lib/data/default-universe";

export function ExploreClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState("ema-cross");
  const [pattern, setPattern] = useState<PatternDefinition>(EMA_CROSS_PATTERN);
  const [customStrategies, setCustomStrategies] = useState<StrategyPreset[]>([]);
  const [modifiedPresetIds, setModifiedPresetIds] = useState<string[]>([]);
  const [minWinRate, setMinWinRate] = useState(70);
  const [minTrades, setMinTrades] = useState(5);
  const [signalTodayOnly, setSignalTodayOnly] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [scan, setScan] = useState<ScanRun | null>(null);
  const [previewSymbol, setPreviewSymbol] = useState("AAPL");
  const [preview, setPreview] = useState<BacktestResult | null>(null);
  const [storedSymbols, setStoredSymbols] = useState<string[]>([]);
  const [overlayFast, setOverlayFast] = useState<(number | null)[]>([]);
  const [overlaySlow, setOverlaySlow] = useState<(number | null)[]>([]);
  const [patternMarkers, setPatternMarkers] = useState<
    { date: string; label: string }[]
  >([]);
  const [chartBars, setChartBars] = useState<
    import("@/lib/types").OhlcvBar[]
  >([]);
  const [fullBars, setFullBars] = useState<import("@/lib/types").OhlcvBar[]>(
    [],
  );
  const [dataRange, setDataRange] = useState<{ from: string; to: string } | null>(
    null,
  );

  const selectStrategy = useCallback(async (preset: StrategyPreset) => {
    setSelectedId(preset.id);
    if (isBuiltInPresetId(preset.id)) {
      const { pattern } = await getEffectivePreset(preset.id);
      setPattern(structuredClone(pattern));
    } else {
      setPattern(structuredClone(preset.pattern));
    }
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [list, modified] = await Promise.all([
        listPatterns(),
        listModifiedPresetIds(),
      ]);
      const presetIds = new Set(STRATEGY_PRESETS.map((s) => s.id));
      const custom = list
        .filter((p) => p.id && !presetIds.has(p.id))
        .map(patternToPreset);
      if (!cancelled) {
        setCustomStrategies(custom);
        setModifiedPresetIds(modified);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("patternId")) return;
    void getEffectivePreset("ema-cross").then(({ pattern }) => {
      setPattern(structuredClone(pattern));
    });
  }, [searchParams]);

  useEffect(() => {
    const patternId = searchParams.get("patternId");
    if (!patternId) return;

    void (async () => {
      const preset = STRATEGY_PRESETS.find((s) => s.id === patternId);
      if (preset) {
        const { pattern } = await getEffectivePreset(patternId);
        setSelectedId(patternId);
        setPattern(structuredClone(pattern));
        return;
      }
      const stored = await getPattern(patternId);
      if (stored) {
        setSelectedId(patternId);
        setPattern(structuredClone(stored));
      }
    })();
  }, [searchParams]);

  const selectedPreset =
    STRATEGY_PRESETS.find((s) => s.id === selectedId) ??
    customStrategies.find((s) => s.id === selectedId);

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
      const saved = await savePattern({ ...p, id: p.id ?? selectedId });
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
    selectedId,
  ]);

  useEffect(() => {
    void (async () => {
      const bars = await getPriceBars(previewSymbol);
      const windowBars = bars.slice(-252);
      setFullBars(bars);
      setChartBars(windowBars);
      setDataRange(
        bars.length > 0
          ? { from: bars[0]!.date, to: bars[bars.length - 1]!.date }
          : null,
      );
      if (bars.length > 0) {
        const p = buildPattern();
        const ctx = computeIndicators(bars, p.indicators);
        const overlays = chartOverlays(p, ctx.series);
        setOverlayFast(overlays.fast ?? []);
        setOverlaySlow(overlays.slow ?? []);
        const windowDates = new Set(windowBars.map((b) => b.date));
        setPatternMarkers(
          extractCandlePatternMarkers(bars, ctx.series, p.indicators).filter(
            (m) => windowDates.has(m.date),
          ),
        );
        setPreview(runBacktest(previewSymbol, bars, p));
      } else {
        setFullBars([]);
        setOverlayFast([]);
        setOverlaySlow([]);
        setPatternMarkers([]);
        setPreview(null);
        setDataRange(null);
      }
    })();
  }, [previewSymbol, buildPattern]);

  const activePattern = buildPattern();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <section className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        {/* Column 1: select strategy */}
        <div className="flex min-h-[24rem] flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                1. Select strategy
              </p>
              <h2 className="mt-2 text-lg font-semibold text-ink">
                {activePattern.name}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {selectedPreset?.entryLogic ?? activePattern.description}
              </p>
              {selectedPreset && (
                <p className="mt-1 text-xs text-muted">
                  {selectedPreset.defaultParams} · {selectedPreset.exitLogic}
                </p>
              )}
            </div>
            <Link
              href="/strategies"
              className="shrink-0 rounded-full border border-border bg-bg px-3 py-1.5 text-xs text-brand-dark hover:bg-brand/10"
            >
              Strategy builder
            </Link>
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            <StrategyPicker
              selectedId={selectedId}
              customStrategies={customStrategies}
              modifiedPresetIds={modifiedPresetIds}
              onSelect={(preset) => void selectStrategy(preset)}
            />
          </div>
        </div>

        {/* Column 2: optimization variables */}
        <div className="flex min-h-[24rem] flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">
              2. Optimization variables
            </h3>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
              Optimization: ON
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Adjust indicator periods, thresholds, and backtest settings.
          </p>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            <OptimizationPanel pattern={pattern} onChange={setPattern} />
          </div>
        </div>

        {/* Column 3: scan universe */}
        <div className="flex min-h-[24rem] flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-ink">3. Scan universe</h3>
          <p className="mt-1 text-xs text-muted">
            Filter symbols and run a universe scan with the current strategy.
          </p>

          <div className="mt-5 flex-1">
            <div className="grid grid-cols-2 gap-3">
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
                  className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm font-semibold shadow-sm"
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
                  className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm font-semibold shadow-sm"
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

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void runScan()}
                disabled={scanning}
                className="w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-sm disabled:opacity-50"
              >
                {scanning
                  ? `Scanning ${scanProgress.done}/${scanProgress.total}…`
                  : "Scan universe"}
              </button>
              <button
                type="button"
                onClick={() => void runPreview()}
                className="w-full rounded-full border border-border bg-bg px-5 py-2.5 text-sm text-muted shadow-sm hover:text-ink"
              >
                Refresh preview
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
          </div>
        </div>
      </section>

      <BacktestResultsPanel
        preview={preview}
        fullBars={fullBars}
        symbol={previewSymbol}
        patternName={activePattern.name}
        dataRange={dataRange}
        symbolInput={previewSymbol}
        onSymbolChange={setPreviewSymbol}
      />

      <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-ink">Chart preview</h2>
        <div className="mt-4">
          {chartBars.length > 0 ? (
            <PriceChart
              bars={chartBars}
              signals={preview?.signals ?? []}
              emaFast={overlayFast.slice(-252)}
              emaSlow={overlaySlow.slice(-252)}
              patternMarkers={patternMarkers}
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
      </section>

      {scan && (
        <section className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
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
                        href={`/symbol/${row.symbol}?scanId=${scan.id}`}
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
