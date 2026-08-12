"use client";

import { useCallback, useEffect, useMemo, useState, startTransition, type MouseEvent } from "react";
import { BacktestTopBar } from "@/components/backtest/BacktestTopBar";
import { LabStatusBanner } from "@/components/lab/LabShell";
import {
  BacktestWorkflowSidebar,
  type BacktestLabView,
  type BacktestSetupStep,
} from "@/components/backtest/BacktestWorkflowSidebar";
import { ConsolidatedResultsPanel } from "@/components/backtest/ConsolidatedResultsPanel";
import { StrategySelector } from "@/components/backtest/StrategySelector";
import { StrategySettingsModal } from "@/components/backtest/StrategySettingsModal";
import { TradeSettingsPanel } from "@/components/backtest/TradeSettingsPanel";
import { SymbolSelector } from "@/components/shared/SymbolSelector";
import {
  DEFAULT_TRADE_SETTINGS,
  formatTradeSettingsSummary,
  type TradeSettings,
} from "@/lib/engine/trade-settings";
import {
  MAX_COMBOS_PER_STRATEGY,
  countParamCombos,
  createStrategySweepState,
  estimateSweepRuns,
  runParameterSweep,
  type BacktestSweepRow,
  type StrategySweepState,
} from "@/lib/engine/param-sweep";
import { getEffectivePreset } from "@/lib/patterns/preset-store";
import { STRATEGY_PRESETS, type StrategyPreset } from "@/lib/patterns/strategies";
import type { LibraryFilterId } from "@/lib/patterns/strategy-ui";
import { listPatterns } from "@/lib/storage/patterns";
import { getPriceBarsBatch, listSymbols } from "@/lib/storage/prices";
import {
  countSelectedSymbols,
  formatSymbolSummary,
  resolveSymbolUniverse,
} from "@/lib/symbols/selection";

export function BacktestClient() {
  const [labView, setLabView] = useState<BacktestLabView>("setup");
  const [setupStep, setSetupStep] = useState<BacktestSetupStep>("symbols");
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [useAllStored, setUseAllStored] = useState(false);
  const [symbolsInitialized, setSymbolsInitialized] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(["ema-cross"]);
  const [settingsStrategyId, setSettingsStrategyId] = useState<string | null>(
    null,
  );
  const [strategyConfigs, setStrategyConfigs] = useState<
    Record<string, StrategySweepState>
  >({});
  const [storedSymbols, setStoredSymbols] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<LibraryFilterId>("all");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<BacktestSweepRow[]>([]);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customPresets, setCustomPresets] = useState<StrategyPreset[]>([]);
  const [tradeSettings, setTradeSettings] =
    useState<TradeSettings>(DEFAULT_TRADE_SETTINGS);

  const allPresets = useMemo(
    () => [...STRATEGY_PRESETS, ...customPresets],
    [customPresets],
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

  const selectedStrategies = useMemo(
    () =>
      selectedIds
        .map((id) => strategyConfigs[id])
        .filter((s): s is StrategySweepState => Boolean(s)),
    [selectedIds, strategyConfigs],
  );

  const settingsConfig = settingsStrategyId
    ? strategyConfigs[settingsStrategyId]
    : null;

  const symbolCount = countSelectedSymbols(
    selectedSymbols,
    storedSymbols.length,
    useAllStored,
  );

  const estimate = useMemo(
    () => estimateSweepRuns(selectedStrategies, symbolCount),
    [selectedStrategies, symbolCount],
  );

  const paramSetCount = useMemo(
    () =>
      selectedStrategies.reduce(
        (sum, strategy) => sum + countParamCombos(strategy.vars),
        0,
      ),
    [selectedStrategies],
  );

  const symbolSummary = formatSymbolSummary(
    selectedSymbols,
    storedSymbols.length,
    useAllStored,
  );

  const strategySummary =
    selectedStrategies.length === 0
      ? "No strategies selected"
      : selectedStrategies.length === 1
        ? selectedStrategies[0]!.name
        : `${selectedStrategies.length} strategies`;

  const tradeSummary = formatTradeSettingsSummary(tradeSettings);

  useEffect(() => {
    void listSymbols().then((list) => {
      setStoredSymbols(list.map((s) => s.symbol));
    });
    void listPatterns().then((patterns) => {
      const presetIds = new Set(STRATEGY_PRESETS.map((s) => s.id));
      const custom = patterns
        .filter((p) => p.id && !presetIds.has(p.id))
        .map((p) => ({
          id: p.id!,
          category: "Custom",
          pattern: p,
          entryLogic: "Custom strategy",
          defaultParams: "",
          exitLogic: "",
        }));
      setCustomPresets(custom);
      setStrategyConfigs((prev) => {
        const next = { ...prev };
        for (const preset of custom) {
          if (!next[preset.id]) {
            next[preset.id] = createStrategySweepState(
              preset.id,
              preset.pattern.name,
              preset.pattern,
            );
          }
        }
        return next;
      });
    });
  }, []);

  useEffect(() => {
    if (symbolsInitialized || storedSymbols.length === 0) return;
    setUseAllStored(true);
    setSymbolsInitialized(true);
  }, [storedSymbols, symbolsInitialized]);

  useEffect(() => {
    void (async () => {
      for (const id of selectedIds) {
        if (strategyConfigs[id]) continue;
        if (STRATEGY_PRESETS.some((p) => p.id === id)) {
          const { pattern } = await getEffectivePreset(id);
          const preset = STRATEGY_PRESETS.find((p) => p.id === id)!;
          setStrategyConfigs((prev) => ({
            ...prev,
            [id]: createStrategySweepState(id, preset.pattern.name, pattern),
          }));
        }
      }
    })();
  }, [selectedIds, strategyConfigs]);

  const toggleStrategy = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const openStrategySettings = (id: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setSettingsStrategyId(id);
  };

  const updateStrategyConfig = (config: StrategySweepState) => {
    setStrategyConfigs((prev) => ({ ...prev, [config.id]: config }));
  };

  const runBacktests = useCallback(async () => {
    setError(null);
    setResults([]);
    setCompletedAt(null);

    if (selectedStrategies.length === 0) {
      setError("Select at least one strategy.");
      setLabView("setup");
      setSetupStep("strategies");
      return;
    }
    const universe = resolveSymbolUniverse({
      useAllStored,
      selected: selectedSymbols,
      stored: storedSymbols,
    });

    if (universe.length === 0) {
      setError("Select at least one symbol.");
      setLabView("setup");
      setSetupStep("symbols");
      return;
    }

    const overCombo = selectedStrategies.find(
      (s) => countParamCombos(s.vars) > MAX_COMBOS_PER_STRATEGY,
    );
    if (overCombo) {
      setError(
        `"${overCombo.name}" exceeds ${MAX_COMBOS_PER_STRATEGY} parameter combinations. Narrow your sweep ranges.`,
      );
      return;
    }
    if (estimate.warnings.length > 0) {
      setError(estimate.warnings[0]!);
      return;
    }

    setRunning(true);
    setProgress({ done: 0, total: estimate.total });

    try {
      const priceData = await getPriceBarsBatch(universe, () => {
        setProgress({ done: 0, total: estimate.total });
      });

      const rows = await runParameterSweep({
        strategies: selectedStrategies,
        symbols: universe,
        priceData,
        tradeSettings,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      setResults(rows);
      if (rows.length === 0) {
        setError(
          "No results. Ensure symbols have at least 60 bars of stored data.",
        );
      } else {
        setCompletedAt(new Date().toISOString());
        setLabView("results");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setRunning(false);
    }
  }, [selectedStrategies, selectedSymbols, useAllStored, storedSymbols, estimate, tradeSettings]);

  const goToSetup = (step: BacktestSetupStep) => {
    startTransition(() => {
      setLabView("setup");
      setSetupStep(step);
    });
  };

  const viewResults = () => {
    if (results.length === 0) return;
    startTransition(() => setLabView("results"));
  };

  return (
    <div className="space-y-6">
      <BacktestTopBar
        symbolCount={symbolCount}
        strategyCount={selectedIds.length}
        runCount={estimate.total}
        paramSetCount={paramSetCount}
        running={running}
        canRun={selectedIds.length > 0 && symbolCount > 0}
        onRun={() => void runBacktests()}
      />

      <LabStatusBanner
        progress={
          running ? `Progress: ${progress.done} / ${progress.total}` : null
        }
        error={error}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(13rem,15rem)_1fr]">
        <BacktestWorkflowSidebar
          labView={labView}
          setupStep={setupStep}
          symbolSummary={symbolSummary}
          strategySummary={strategySummary}
          tradeSummary={tradeSummary}
          hasResults={results.length > 0}
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
              description="Choose symbols to include in this backtest sweep."
            />
          )}

          {labView === "setup" && setupStep === "strategies" && (
            <StrategySelector
              presets={filteredPresets}
              selectedIds={selectedIds}
              strategyConfigs={strategyConfigs}
              query={query}
              categoryFilter={categoryFilter}
              onQueryChange={setQuery}
              onCategoryChange={setCategoryFilter}
              onToggle={toggleStrategy}
              onOpenSettings={openStrategySettings}
            />
          )}

          {labView === "setup" && setupStep === "trade" && (
            <TradeSettingsPanel
              settings={tradeSettings}
              onChange={setTradeSettings}
            />
          )}

          {labView === "results" && (
            <ConsolidatedResultsPanel
              rows={results}
              completedAt={completedAt}
            />
          )}
        </main>
      </div>

      <StrategySettingsModal
        open={settingsStrategyId != null}
        config={settingsConfig}
        onClose={() => setSettingsStrategyId(null)}
        onChange={updateStrategyConfig}
      />
    </div>
  );
}
