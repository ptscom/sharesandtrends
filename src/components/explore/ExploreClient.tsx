"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  startTransition,
  type MouseEvent,
} from "react";
import { ExploreIndicatorResultsPanel } from "@/components/explore/ExploreIndicatorResultsPanel";
import { ExploreExplorationSelector } from "@/components/explore/ExploreExplorationSelector";
import {
  ExplorationBuilderModal,
  ExplorationPresetSettingsModal,
} from "@/components/explore/ExplorationBuilderModal";
import { ExploreMtfStrategySelector, type MtfSlotSelection } from "@/components/explore/ExploreMtfStrategySelector";
import { ExplorePriceCacheFooter } from "@/components/explore/ExplorePriceCacheFooter";
import { ExploreScanResultsPanel } from "@/components/explore/ExploreScanResultsPanel";
import { ExploreStrategySelector } from "@/components/explore/ExploreStrategySelector";
import { ExploreStrategySettingsModal } from "@/components/explore/ExploreStrategySettingsModal";
import { ExploreTimeframeTabs } from "@/components/explore/ExploreTimeframeTabs";
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
import { runIndicatorScanInWorker } from "@/lib/engine/indicator-scan-worker-client";
import { runUniverseScanInWorker } from "@/lib/engine/scan-worker-client";
import type {
  ExplorationFilter,
  IndicatorScanRun,
} from "@/lib/explore/exploration-models";
import {
  defaultParamsForPreset,
  summarizeExplorationFilter,
} from "@/lib/explore/exploration-models";
import {
  DEFAULT_EXPLORATION_PRESET_ID,
  getExplorationPreset,
  type ExplorationFilterId,
} from "@/lib/explore/exploration-presets";
import {
  describeExplorationFilter,
  explorationFilterToPattern,
} from "@/lib/explore/exploration-to-pattern";
import type { ExplorePath } from "@/lib/explore/indicator-models";
import { patternToPreset } from "@/lib/patterns/custom";
import { EMA_CROSS_PATTERN } from "@/lib/patterns/defaults";
import {
  combineMtfPatterns,
  formatMtfExitModeLabel,
  formatMtfStrategySummary,
  formatTimeframeModeLabel,
  type ExploreTimeframeMode,
  type MtfExitMode,
  type MtfSlot,
} from "@/lib/patterns/mtf-combine";
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

const MTF_FILTER_LABELS: Record<"weekly" | "monthly", string> = {
  weekly: "Weekly filter",
  monthly: "Monthly filter",
};

function createDefaultExplorationFilter(
  timeframeMode: ExploreTimeframeMode,
): ExplorationFilter {
  const preset = getExplorationPreset(DEFAULT_EXPLORATION_PRESET_ID)!;
  return {
    source: "preset",
    name: preset.name,
    timeframeMode,
    presetId: preset.id,
    params: defaultParamsForPreset(preset),
  };
}

export function ExploreClient() {
  const searchParams = useSearchParams();

  const [labView, setLabView] = useState<ExploreLabView>("setup");
  const [setupStep, setSetupStep] = useState<ExploreSetupStep>("symbols");
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [storedSymbols, setStoredSymbols] = useState<string[]>([]);
  const [useAllStored, setUseAllStored] = useState(false);
  const [symbolsInitialized, setSymbolsInitialized] = useState(false);

  const [explorePath, setExplorePath] = useState<ExplorePath | null>(null);
  const [explorationTimeframeMode, setExplorationTimeframeMode] =
    useState<ExploreTimeframeMode>("1D");
  const [explorationFilter, setExplorationFilter] =
    useState<ExplorationFilter | null>(null);
  const [selectedExplorationPresetId, setSelectedExplorationPresetId] =
    useState<string | null>(DEFAULT_EXPLORATION_PRESET_ID);
  const [explorationQuery, setExplorationQuery] = useState("");
  const [explorationCategoryFilter, setExplorationCategoryFilter] =
    useState<ExplorationFilterId>("all");
  const [presetSettingsId, setPresetSettingsId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [indicatorScan, setIndicatorScan] = useState<IndicatorScanRun | null>(
    null,
  );
  const [lastScanPath, setLastScanPath] = useState<ExplorePath | null>(null);

  const [selectedId, setSelectedId] = useState("ema-cross");
  const [pattern, setPattern] = useState<PatternDefinition>(EMA_CROSS_PATTERN);
  const [timeframeMode, setTimeframeMode] = useState<ExploreTimeframeMode>("1D");
  const [mtfSlots, setMtfSlots] = useState<Record<MtfSlot, MtfSlotSelection | null>>({
    daily: { id: "ema-cross", pattern: EMA_CROSS_PATTERN },
    weekly: null,
    monthly: null,
  });
  const [activeMtfSlot, setActiveMtfSlot] = useState<MtfSlot>("daily");
  const [mtfExitMode, setMtfExitMode] =
    useState<MtfExitMode>("daily_and_filter_break");
  const [settingsTarget, setSettingsTarget] = useState<"single" | MtfSlot>("single");
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
  const strategyName =
    timeframeMode === "mtf"
      ? formatMtfStrategySummary(
          (["daily", "weekly", "monthly"] as MtfSlot[]).map((slot) => ({
            slot,
            name: mtfSlots[slot]?.pattern.name ?? null,
          })),
        )
      : (activePreset?.pattern.name ?? pattern.name);

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

  const strategySummary =
    explorePath === "indicator"
      ? "Not used"
      : timeframeMode === "mtf"
        ? `${strategyName} · ${formatMtfExitModeLabel(mtfExitMode)}`
        : `${formatTimeframeModeLabel(timeframeMode)}: ${strategyName}`;

  const explorationSummary =
    explorePath === "strategy"
      ? "Not used"
      : summarizeExplorationFilter(explorationFilter);

  const scanSummary = `${minWinRate}% win · ${minTrades}+ trades${
    signalTodayOnly ? " · signal today" : ""
  }`;

  const topBarStrategyLabel =
    explorePath === "indicator"
      ? `Exploration: ${explorationSummary}`
      : strategyName;

  const resultCount =
    lastScanPath === "indicator"
      ? (indicatorScan?.results.length ?? 0)
      : (scan?.results.length ?? 0);

  const resolvePresetPattern = useCallback(
    async (preset: StrategyPreset): Promise<PatternDefinition> => {
      if (isBuiltInPresetId(preset.id)) {
        const { pattern: next } = await getEffectivePreset(preset.id);
        return structuredClone(next);
      }
      return structuredClone(preset.pattern);
    },
    [],
  );

  const activateStrategyPath = useCallback(() => {
    setExplorePath("strategy");
    setExplorationFilter(null);
    setSelectedExplorationPresetId(null);
  }, []);

  const activateExplorationPath = useCallback(
    (filter?: ExplorationFilter) => {
      setExplorePath("indicator");
      if (filter) {
        setExplorationFilter(filter);
      } else if (!explorationFilter) {
        const next = createDefaultExplorationFilter(explorationTimeframeMode);
        setExplorationFilter(next);
        setSelectedExplorationPresetId(DEFAULT_EXPLORATION_PRESET_ID);
      }
    },
    [explorationFilter, explorationTimeframeMode],
  );

  const selectExplorationPreset = useCallback(
    (presetId: string) => {
      const preset = getExplorationPreset(presetId);
      if (!preset) return;

      const existingParams =
        explorationFilter?.source === "preset" &&
        explorationFilter.presetId === presetId
          ? explorationFilter.params
          : defaultParamsForPreset(preset);

      activateExplorationPath({
        source: "preset",
        name: preset.name,
        timeframeMode: explorationTimeframeMode,
        presetId,
        params: existingParams ?? defaultParamsForPreset(preset),
      });
      setSelectedExplorationPresetId(presetId);
    },
    [activateExplorationPath, explorationFilter, explorationTimeframeMode],
  );

  const selectStrategy = useCallback(
    async (preset: StrategyPreset) => {
      activateStrategyPath();
      const next = await resolvePresetPattern(preset);
      setSelectedId(preset.id);
      setPattern(next);
      setMtfSlots((prev) => ({
        ...prev,
        daily: { id: preset.id, pattern: structuredClone(next) },
      }));
    },
    [resolvePresetPattern, activateStrategyPath],
  );

  const selectMtfStrategy = useCallback(
    async (slot: MtfSlot, preset: StrategyPreset) => {
      activateStrategyPath();
      const next = await resolvePresetPattern(preset);
      setMtfSlots((prev) => ({
        ...prev,
        [slot]: { id: preset.id, pattern: next },
      }));
      if (slot === "daily") {
        setSelectedId(preset.id);
        setPattern(structuredClone(next));
      }
    },
    [resolvePresetPattern, activateStrategyPath],
  );

  const clearMtfSlot = useCallback((slot: MtfSlot) => {
    if (slot === "daily") return;
    setMtfSlots((prev) => ({ ...prev, [slot]: null }));
  }, []);

  const buildPattern = useCallback((): PatternDefinition => {
    if (timeframeMode === "mtf") {
      const daily = mtfSlots.daily?.pattern;
      if (!daily) {
        throw new Error("Select a daily strategy for multi-timeframe scan.");
      }
      return combineMtfPatterns({
        daily,
        weekly: mtfSlots.weekly?.pattern ?? null,
        monthly: mtfSlots.monthly?.pattern ?? null,
        exitMode: mtfExitMode,
      });
    }
    return pattern;
  }, [timeframeMode, mtfSlots, mtfExitMode, pattern]);

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

  useEffect(() => {
    setExplorationFilter((prev) =>
      prev ? { ...prev, timeframeMode: explorationTimeframeMode } : prev,
    );
  }, [explorationTimeframeMode]);

  const openStrategySettings = (id: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (id !== selectedId) {
      const preset = allPresets.find((p) => p.id === id);
      if (preset) void selectStrategy(preset);
    }
    setSettingsTarget("single");
    setSettingsOpen(true);
  };

  const openMtfStrategySettings = (slot: MtfSlot, id: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const current = mtfSlots[slot];
    if (!current || current.id !== id) {
      const preset = allPresets.find((p) => p.id === id);
      if (preset) void selectMtfStrategy(slot, preset);
    }
    setSettingsTarget(slot);
    setSettingsOpen(true);
  };

  const openExplorationPresetSettings = (presetId: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedExplorationPresetId !== presetId) {
      selectExplorationPreset(presetId);
    }
    setPresetSettingsId(presetId);
  };

  const settingsPattern =
    settingsTarget === "single"
      ? pattern
      : (mtfSlots[settingsTarget]?.pattern ?? null);

  const isMtfFilterSettings =
    settingsTarget === "weekly" || settingsTarget === "monthly";

  const settingsStrategyName =
    settingsTarget === "single"
      ? (activePreset?.pattern.name ?? pattern.name)
      : settingsTarget === "daily"
        ? (mtfSlots.daily?.pattern.name ?? "Daily strategy")
        : `${MTF_FILTER_LABELS[settingsTarget]}: ${mtfSlots[settingsTarget]?.pattern.name ?? "Filter"}`;

  const updateSettingsPattern = useCallback(
    (next: PatternDefinition) => {
      if (settingsTarget === "single") {
        setPattern(next);
        return;
      }
      setMtfSlots((prev) => {
        const current = prev[settingsTarget];
        if (!current) return prev;
        return {
          ...prev,
          [settingsTarget]: { ...current, pattern: next },
        };
      });
    },
    [settingsTarget],
  );

  const saveStrategySettings = useCallback(async () => {
    if (settingsTarget === "single") {
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
      return;
    }

    const slot = settingsTarget;
    const current = mtfSlots[slot];
    if (!current) return;

    const saved = await savePattern({
      ...current.pattern,
      id: current.pattern.id ?? current.id,
    });
    const cloned = structuredClone(saved);
    setMtfSlots((prev) => ({
      ...prev,
      [slot]: { id: current.id, pattern: cloned },
    }));
    if (slot === "daily") {
      setPattern(cloned);
    }
    if (isBuiltInPresetId(current.id)) {
      setModifiedPresetIds((prev) =>
        prev.includes(current.id) ? prev : [...prev, current.id],
      );
    }
    setSettingsOpen(false);
  }, [pattern, selectedId, settingsTarget, mtfSlots]);

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

    if (!explorePath) {
      setError("Select an exploration filter or a strategy before scanning.");
      setLabView("setup");
      setSetupStep("indicators");
      return;
    }

    if (explorePath === "indicator") {
      if (!explorationFilter) {
        setError("Select or build an exploration filter.");
        setLabView("setup");
        setSetupStep("indicators");
        return;
      }

      setScanning(true);
      setScanPhase("scanning");
      setScanProgress({ done: 0, total: universe.length });

      try {
        const patternForScan = explorationFilterToPattern(explorationFilter);
        const result = await runIndicatorScanInWorker({
          universe,
          pattern: patternForScan,
          filterName: explorationFilter.name,
          filterDescription: describeExplorationFilter(explorationFilter),
          timeframeMode: explorationFilter.timeframeMode,
          onProgress: (done, total, phase) => {
            setScanPhase(phase);
            setScanProgress({ done, total });
          },
        });

        setIndicatorScan(result);
        setScan(null);
        setLastScanPath("indicator");
        setLabView("results");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Exploration scan failed");
      } finally {
        setScanning(false);
        setCacheRefreshKey((key) => key + 1);
      }
      return;
    }

    if (timeframeMode === "mtf" && !mtfSlots.daily) {
      setError("Select a daily strategy for multi-timeframe scan.");
      setLabView("setup");
      setSetupStep("strategy");
      return;
    }

    setScanning(true);
    setScanPhase("scanning");
    setScanProgress({ done: 0, total: universe.length });

    try {
      const built = buildPattern();
      const scanTimeframeMode: ExploreTimeframeMode =
        timeframeMode === "mtf" ? "1D" : timeframeMode;

      let patternForScan: PatternDefinition;
      if (timeframeMode === "mtf") {
        patternForScan = await savePattern({ ...built });
      } else {
        const p = { ...built, id: built.id ?? selectedId };
        const needsSave =
          !isBuiltInPresetId(selectedId) ||
          modifiedPresetIds.includes(selectedId);
        patternForScan = needsSave ? await savePattern(p) : p;
      }

      const result = await runUniverseScanInWorker({
        universe,
        pattern: patternForScan,
        timeframeMode: scanTimeframeMode,
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
      setIndicatorScan(null);
      setLastScanPath("strategy");
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
    explorePath,
    explorationFilter,
    buildPattern,
    timeframeMode,
    mtfSlots,
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
    if (resultCount === 0) return;
    startTransition(() => setLabView("results"));
  };

  const canScan =
    (symbolCount > 0 || storedSymbols.length > 0) &&
    explorePath !== null &&
    (explorePath === "strategy" ||
      (explorePath === "indicator" && explorationFilter !== null));

  const presetForSettings = presetSettingsId
    ? getExplorationPreset(presetSettingsId)
    : null;

  return (
    <div className="space-y-6">
      <ExploreTopBar
        symbolCount={symbolCount}
        strategyName={topBarStrategyLabel}
        minWinRate={minWinRate}
        minTrades={minTrades}
        signalTodayOnly={signalTodayOnly}
        scanning={scanning}
        canScan={canScan}
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
          explorePath={explorePath}
          symbolSummary={symbolSummary}
          indicatorSummary={explorationSummary}
          strategySummary={strategySummary}
          scanSummary={scanSummary}
          resultCount={resultCount}
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

          {labView === "setup" && setupStep === "indicators" && (
            <div className="space-y-4">
              <ExploreTimeframeTabs
                mode={explorationTimeframeMode}
                onChange={setExplorationTimeframeMode}
              />
              <ExploreExplorationSelector
                filter={explorationFilter}
                selectedPresetId={selectedExplorationPresetId}
                query={explorationQuery}
                categoryFilter={explorationCategoryFilter}
                onQueryChange={setExplorationQuery}
                onCategoryChange={setExplorationCategoryFilter}
                onSelectPreset={selectExplorationPreset}
                onOpenPresetSettings={openExplorationPresetSettings}
                onOpenBuilder={() => {
                  activateExplorationPath();
                  setBuilderOpen(true);
                }}
                onEditBuilder={() => setBuilderOpen(true)}
              />
            </div>
          )}

          {labView === "setup" && setupStep === "strategy" && (
            <div className="space-y-4">
              <ExploreTimeframeTabs
                mode={timeframeMode}
                onChange={(mode) => {
                  setTimeframeMode(mode);
                  if (mode === "mtf" && !mtfSlots.daily) {
                    setMtfSlots((prev) => ({
                      ...prev,
                      daily: { id: selectedId, pattern: structuredClone(pattern) },
                    }));
                  }
                }}
              />

              {timeframeMode === "mtf" ? (
                <ExploreMtfStrategySelector
                  presets={filteredPresets}
                  slots={mtfSlots}
                  modifiedPresetIds={modifiedPresetIds}
                  exitMode={mtfExitMode}
                  query={query}
                  categoryFilter={categoryFilter}
                  activeSlot={activeMtfSlot}
                  onActiveSlotChange={setActiveMtfSlot}
                  onExitModeChange={setMtfExitMode}
                  onQueryChange={setQuery}
                  onCategoryChange={setCategoryFilter}
                  onSelect={(slot, preset) => void selectMtfStrategy(slot, preset)}
                  onClearSlot={clearMtfSlot}
                  onOpenSettings={openMtfStrategySettings}
                />
              ) : (
                <ExploreStrategySelector
                  presets={filteredPresets}
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
            </div>
          )}

          {labView === "setup" && setupStep === "scan" && explorePath === "strategy" && (
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

          {labView === "results" && lastScanPath === "strategy" && scan && (
            <ExploreScanResultsPanel scan={scan} />
          )}

          {labView === "results" && lastScanPath === "indicator" && indicatorScan && (
            <ExploreIndicatorResultsPanel scan={indicatorScan} />
          )}
        </main>
      </div>

      <ExplorePriceCacheFooter refreshKey={cacheRefreshKey} />

      <ExploreStrategySettingsModal
        open={settingsOpen}
        pattern={settingsPattern}
        strategyName={settingsStrategyName}
        settingsSubtitle={
          isMtfFilterSettings
            ? "Adjust filter indicator parameters and entry thresholds only."
            : undefined
        }
        hideBacktestSettings={isMtfFilterSettings}
        onClose={() => setSettingsOpen(false)}
        onSave={() => void saveStrategySettings()}
        onChange={updateSettingsPattern}
      />

      {presetForSettings && (
        <ExplorationPresetSettingsModal
          open={Boolean(presetSettingsId)}
          presetName={presetForSettings.name}
          params={
            explorationFilter?.source === "preset" &&
            explorationFilter.presetId === presetForSettings.id &&
            explorationFilter.params
              ? explorationFilter.params
              : defaultParamsForPreset(presetForSettings)
          }
          paramDefs={presetForSettings.params}
          description={presetForSettings.description}
          onClose={() => setPresetSettingsId(null)}
          onSave={(params) => {
            activateExplorationPath({
              source: "preset",
              name: presetForSettings.name,
              timeframeMode: explorationTimeframeMode,
              presetId: presetForSettings.id,
              params,
            });
            setSelectedExplorationPresetId(presetForSettings.id);
            setPresetSettingsId(null);
          }}
        />
      )}

      <ExplorationBuilderModal
        open={builderOpen}
        initial={
          explorationFilter?.source === "builder"
            ? (explorationFilter.builder ?? null)
            : null
        }
        onClose={() => setBuilderOpen(false)}
        onSave={(name, builder) => {
          activateExplorationPath({
            source: "builder",
            name,
            timeframeMode: explorationTimeframeMode,
            builder,
          });
          setSelectedExplorationPresetId(null);
        }}
      />
    </div>
  );
}
