"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { BacktestTopBar } from "@/components/backtest/BacktestTopBar";
import {
  BacktestWorkflowSidebar,
  type BacktestLabView,
  type BacktestSetupStep,
} from "@/components/backtest/BacktestWorkflowSidebar";
import { ConsolidatedResultsPanel } from "@/components/backtest/ConsolidatedResultsPanel";
import { StrategySelector } from "@/components/backtest/StrategySelector";
import { StrategySettingsModal } from "@/components/backtest/StrategySettingsModal";
import { SymbolSelector } from "@/components/backtest/SymbolSelector";
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

export function BacktestClient() {
  const [labView, setLabView] = useState<BacktestLabView>("setup");
  const [setupStep, setSetupStep] = useState<BacktestSetupStep>("symbols");
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([
    "AAPL",
    "MSFT",
    "GOOGL",
  ]);
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

  const estimate = useMemo(
    () => estimateSweepRuns(selectedStrategies, selectedSymbols.length),
    [selectedStrategies, selectedSymbols.length],
  );

  const paramSetCount = useMemo(
    () =>
      selectedStrategies.reduce(
        (sum, strategy) => sum + countParamCombos(strategy.vars),
        0,
      ),
    [selectedStrategies],
  );

  const symbolSummary =
    selectedSymbols.length === 0
      ? "No symbols selected"
      : selectedSymbols.length <= 4
        ? selectedSymbols.join(", ")
        : `${selectedSymbols.length} symbols`;

  const strategySummary =
    selectedStrategies.length === 0
      ? "No strategies selected"
      : selectedStrategies.length === 1
        ? selectedStrategies[0]!.name
        : `${selectedStrategies.length} strategies`;

  useEffect(() => {
    void listSymbols().then((list) =>
      setStoredSymbols(list.map((s) => s.symbol)),
    );
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
    if (selectedSymbols.length === 0) {
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
      const priceData = await getPriceBarsBatch(selectedSymbols, () => {
        setProgress({ done: 0, total: estimate.total });
      });

      const rows = await runParameterSweep({
        strategies: selectedStrategies,
        symbols: selectedSymbols,
        priceData,
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
  }, [selectedStrategies, selectedSymbols, estimate]);

  const goToSetup = (step: BacktestSetupStep) => {
    setLabView("setup");
    setSetupStep(step);
  };

  return (
    <div className="space-y-6">
      <BacktestTopBar
        symbolCount={selectedSymbols.length}
        strategyCount={selectedIds.length}
        runCount={estimate.total}
        paramSetCount={paramSetCount}
        running={running}
        canRun={selectedIds.length > 0 && selectedSymbols.length > 0}
        onRun={() => void runBacktests()}
      />

      {(running || error) && (
        <div className="space-y-2">
          {running && (
            <p className="ui-helper rounded-xl border border-border-subtle bg-surface px-4 py-3">
              Progress: {progress.done} / {progress.total}
            </p>
          )}
          {error && (
            <p className="rounded-xl bg-danger-light px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(13rem,15rem)_1fr]">
        <BacktestWorkflowSidebar
          labView={labView}
          setupStep={setupStep}
          symbolSummary={symbolSummary}
          strategySummary={strategySummary}
          hasResults={results.length > 0}
          onSelectStep={goToSetup}
          onViewResults={() => results.length > 0 && setLabView("results")}
        />

        <main className="min-w-0 space-y-6">
          {labView === "setup" && setupStep === "symbols" && (
            <SymbolSelector
              selected={selectedSymbols}
              storedSymbols={storedSymbols}
              onChange={setSelectedSymbols}
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
