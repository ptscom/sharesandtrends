"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, startTransition, type MouseEvent } from "react";
import { ExplorePriceCacheFooter } from "@/components/explore/ExplorePriceCacheFooter";
import { ExploreScanResultsPanel } from "@/components/explore/ExploreScanResultsPanel";
import { ExploreStrategySelector } from "@/components/explore/ExploreStrategySelector";
import { ExploreStrategySettingsModal } from "@/components/explore/ExploreStrategySettingsModal";
import { ExploreTopBar } from "@/components/explore/ExploreTopBar";
import { LabStatusBanner } from "@/components/lab/LabShell";
import {
  ExploreWorkflowSidebar,
  type ExploreLabView,
  type ExploreSetupStep,
} from "@/components/explore/ExploreWorkflowSidebar";
import { ScanSettingsPanel } from "@/components/explore/ScanSettingsPanel";
import { SymbolSelector } from "@/components/shared/SymbolSelector";
import { DEFAULT_WATCHLIST } from "@/lib/data/default-universe";
import { runUniverseScanInWorker } from "@/lib/engine/scan-worker-client";
import { patternToPreset } from "@/lib/patterns/custom";
import { EMA_CROSS_PATTERN } from "@/lib/patterns/defaults";
import {
  getEffectivePreset,
  isBuiltInPresetId,
  listModifiedPresetIds,
} from "@/lib/patterns/preset-store";
import type { StrategyPreset } from "@/lib/patterns/strategies";
import { STRATEGY_PRESETS } from "@/lib/patterns/strategies";
import type { LibraryFilterId } from "@/lib/patterns/strategy-ui";
import {
  getPattern,
  listPatterns,
  savePattern,
  saveScanRun,
} from "@/lib/storage/patterns";
import { listSymbols } from "@/lib/storage/prices";
import {
  countSelectedSymbols,
  formatSymbolSummary,
  resolveSymbolUniverse,
} from "@/lib/symbols/selection";
import type { PatternDefinition, ScanRun } from "@/lib/types";

export function ExploreClient() {
  const searchParams = useSearchParams();

  const [labView, setLabView] = useState<ExploreLabView>("setup");
  const [setupStep, setSetupStep] = useState<ExploreSetupStep>("symbols");
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [storedSymbols, setStoredSymbols] = useState<string[]>([]);
  const [useAllStored, setUseAllStored] = useState(false);
  const [symbolsInitialized, setSymbolsInitialized] = useState(false);

  const [selectedId, setSelectedId] = useState("ema-cross");
  const [pattern, setPattern] = useState<PatternDefinition>(EMA_CROSS_PATTERN);
  const [customStrategies, setCustomStrategies] = useState<StrategyPreset[]>([]);
  const [modifiedPresetIds, setModifiedPresetIds] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<LibraryFilterId>("all");
  const [minWinRate, setMinWinRate] = useState(70);
  const [minTrades, setMinTrades] = useState(5);
  const [signalTodayOnly, setSignalTodayOnly] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState<"loading" | "scanning">("loading");
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [scan, setScan] = useState<ScanRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheRefreshKey, setCacheRefreshKey] = useState(0);

  const allPresets = useMemo(
    () => [...STRATEGY_PRESETS, ...customStrategies],
    [customStrategies],
  );

  const filteredPresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allPresets.filter((preset) => {
      if (categoryFilter !== "all" && preset.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        preset.pattern.name.toLowerCase().includes(q) ||
        preset.category.toLowerCase().includes(q) ||
        preset.id.toLowerCase().includes(q) ||
        preset.entryLogic.toLowerCase().includes(q)
      );
    });
  }, [allPresets, query, categoryFilter]);

  const activePreset = allPresets.find((p) => p.id === selectedId);
  const strategyName = activePreset?.pattern.name ?? pattern.name;

  const symbolCount = countSelectedSymbols(
    selectedSymbols,
    storedSymbols.length,
    useAllStored,
  );

  const symbolSummary = formatSymbolSummary(
    selectedSymbols,
    storedSymbols.length,
    useAllStored,
  );

  const strategySummary = strategyName;
  const scanSummary = `${minWinRate}% win · ${minTrades}+ trades${
    signalTodayOnly ? " · signal today" : ""
  }`;

  const selectStrategy = useCallback(async (preset: StrategyPreset) => {
    setSelectedId(preset.id);
    if (isBuiltInPresetId(preset.id)) {
      const { pattern: next } = await getEffectivePreset(preset.id);
      setPattern(structuredClone(next));
    } else {
      setPattern(structuredClone(preset.pattern));
    }
  }, []);

  const buildPattern = useCallback((): PatternDefinition => pattern, [pattern]);

  useEffect(() => {
    void listSymbols().then((list) => {
      const symbols = list.map((s) => s.symbol);
      setStoredSymbols(symbols);
    });
  }, []);

  useEffect(() => {
    if (symbolsInitialized || storedSymbols.length === 0) return;
    setUseAllStored(true);
    setSymbolsInitialized(true);
  }, [storedSymbols, symbolsInitialized]);

  useEffect(() => {
    void (async () => {
      const [list, modified] = await Promise.all([
        listPatterns(),
        listModifiedPresetIds(),
      ]);
      const presetIds = new Set(STRATEGY_PRESETS.map((s) => s.id));
      const custom = list
        .filter((p) => p.id && !presetIds.has(p.id))
        .map(patternToPreset);
      setCustomStrategies(custom);
      setModifiedPresetIds(modified);
    })();
  }, []);

  useEffect(() => {
    if (searchParams.get("patternId")) return;
    void getEffectivePreset("ema-cross").then(({ pattern: next }) => {
      setPattern(structuredClone(next));
    });
  }, [searchParams]);

  useEffect(() => {
    const patternId = searchParams.get("patternId");
    if (!patternId) return;

    void (async () => {
      const preset = STRATEGY_PRESETS.find((s) => s.id === patternId);
      if (preset) {
        const { pattern: next } = await getEffectivePreset(patternId);
        setSelectedId(patternId);
        setPattern(structuredClone(next));
        return;
      }
      const stored = await getPattern(patternId);
      if (stored) {
        setSelectedId(patternId);
        setPattern(structuredClone(stored));
      }
    })();
  }, [searchParams]);

  const openStrategySettings = (id: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (id !== selectedId) {
      const preset = allPresets.find((p) => p.id === id);
      if (preset) void selectStrategy(preset);
    }
    setSettingsOpen(true);
  };

  const saveStrategySettings = useCallback(async () => {
    const saved = await savePattern({
      ...pattern,
      id: pattern.id ?? selectedId,
    });
    setPattern(structuredClone(saved));
    if (isBuiltInPresetId(selectedId)) {
      setModifiedPresetIds((prev) =>
        prev.includes(selectedId) ? prev : [...prev, selectedId],
      );
    }
    setSettingsOpen(false);
  }, [pattern, selectedId]);

  const runScan = useCallback(async () => {
    setError(null);

    const universe = resolveSymbolUniverse({
      useAllStored,
      selected: selectedSymbols,
      stored: storedSymbols,
      fallback: DEFAULT_WATCHLIST,
    });

    if (universe.length === 0) {
      setError("Select at least one symbol or download data first.");
      setLabView("setup");
      setSetupStep("symbols");
      return;
    }

    setScanning(true);
    setScanPhase("scanning");
    setScanProgress({ done: 0, total: universe.length });

    try {
      const built = buildPattern();
      const p = { ...built, id: built.id ?? selectedId };
      const needsSave =
        !isBuiltInPresetId(selectedId) ||
        modifiedPresetIds.includes(selectedId);
      const patternForScan = needsSave ? await savePattern(p) : p;

      const result = await runUniverseScanInWorker({
        universe,
        pattern: patternForScan,
        minWinRate,
        minTrades,
        signalTodayOnly,
        onProgress: (done, total, phase) => {
          setScanPhase(phase);
          setScanProgress({ done, total });
        },
      });

      await saveScanRun(result);
      setScan(result);
      setLabView("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
      setCacheRefreshKey((key) => key + 1);
    }
  }, [
    selectedSymbols,
    storedSymbols,
    useAllStored,
    buildPattern,
    minWinRate,
    minTrades,
    signalTodayOnly,
    selectedId,
    modifiedPresetIds,
  ]);

  const goToSetup = (step: ExploreSetupStep) => {
    startTransition(() => {
      setLabView("setup");
      setSetupStep(step);
    });
  };

  const viewResults = () => {
    if (!scan) return;
    startTransition(() => setLabView("results"));
  };

  return (
    <div className="space-y-6">
      <ExploreTopBar
        symbolCount={symbolCount}
        strategyName={strategyName}
        minWinRate={minWinRate}
        minTrades={minTrades}
        signalTodayOnly={signalTodayOnly}
        scanning={scanning}
        canScan={symbolCount > 0 || storedSymbols.length > 0}
        onScan={() => void runScan()}
      />

      <LabStatusBanner
        progress={
          scanning
            ? scanPhase === "loading"
              ? `Loading prices ${scanProgress.done}/${scanProgress.total}…`
              : `Scanning ${scanProgress.done}/${scanProgress.total}…`
            : null
        }
        error={error}
        errorExtra={
          error && storedSymbols.length === 0 ? (
            <>
              {" "}
              <Link href="/data" className="underline">
                Download data
              </Link>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(13rem,15rem)_1fr]">
        <ExploreWorkflowSidebar
          labView={labView}
          setupStep={setupStep}
          symbolSummary={symbolSummary}
          strategySummary={strategySummary}
          scanSummary={scanSummary}
          resultCount={scan?.results.length ?? 0}
          onSelectStep={goToSetup}
          onViewResults={viewResults}
        />

        <main className="min-w-0 space-y-6">
          {labView === "setup" && setupStep === "symbols" && (
            <SymbolSelector
              selected={selectedSymbols}
              storedSymbols={storedSymbols}
              useAllStored={useAllStored}
              onUseAllStoredChange={setUseAllStored}
              onChange={setSelectedSymbols}
              maxSymbols={null}
              stepLabel="Step 1"
              description="Choose the symbol universe for this scan."
            />
          )}

          {labView === "setup" && setupStep === "strategy" && (
            <ExploreStrategySelector
              presets={filteredPresets}
              allPresets={allPresets}
              selectedId={selectedId}
              modifiedPresetIds={modifiedPresetIds}
              query={query}
              categoryFilter={categoryFilter}
              onQueryChange={setQuery}
              onCategoryChange={setCategoryFilter}
              onSelect={(preset) => void selectStrategy(preset)}
              onOpenSettings={openStrategySettings}
            />
          )}

          {labView === "setup" && setupStep === "scan" && (
            <ScanSettingsPanel
              minWinRate={minWinRate}
              minTrades={minTrades}
              signalTodayOnly={signalTodayOnly}
              symbolCount={symbolCount}
              storedSymbolCount={storedSymbols.length}
              onMinWinRateChange={setMinWinRate}
              onMinTradesChange={setMinTrades}
              onSignalTodayOnlyChange={setSignalTodayOnly}
            />
          )}

          {labView === "results" && scan && (
            <ExploreScanResultsPanel scan={scan} />
          )}
        </main>
      </div>

      <ExplorePriceCacheFooter refreshKey={cacheRefreshKey} />

      <ExploreStrategySettingsModal
        open={settingsOpen}
        pattern={pattern}
        strategyName={strategyName}
        onClose={() => setSettingsOpen(false)}
        onSave={() => void saveStrategySettings()}
        onChange={setPattern}
      />
    </div>
  );
}
