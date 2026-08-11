"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConsolidatedResultsPanel } from "@/components/backtest/ConsolidatedResultsPanel";
import { StrategySweepPanel } from "@/components/backtest/StrategySweepPanel";
import { DEFAULT_WATCHLIST } from "@/lib/data/default-universe";
import {
  MAX_BACKTEST_SYMBOLS,
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
import { categoryStyle } from "@/lib/patterns/strategy-ui";
import { listPatterns } from "@/lib/storage/patterns";
import { getPriceBarsBatch, listSymbols } from "@/lib/storage/prices";

export function BacktestClient() {
  const [selectedIds, setSelectedIds] = useState<string[]>(["ema-cross"]);
  const [strategyConfigs, setStrategyConfigs] = useState<
    Record<string, StrategySweepState>
  >({});
  const [symbolsInput, setSymbolsInput] = useState("AAPL, MSFT, GOOGL");
  const [useStoredUniverse, setUseStoredUniverse] = useState(false);
  const [storedSymbols, setStoredSymbols] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<BacktestSweepRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [customPresets, setCustomPresets] = useState<StrategyPreset[]>([]);

  const allPresets = useMemo(
    () => [...STRATEGY_PRESETS, ...customPresets],
    [customPresets],
  );

  const filteredPresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allPresets;
    return allPresets.filter(
      (p) =>
        p.pattern.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [allPresets, query]);

  const symbolList = useMemo(() => {
    const raw = useStoredUniverse
      ? storedSymbols
      : symbolsInput
          .split(/[,\s]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
    return [...new Set(raw)].slice(0, MAX_BACKTEST_SYMBOLS);
  }, [symbolsInput, storedSymbols, useStoredUniverse]);

  const selectedStrategies = useMemo(
    () =>
      selectedIds
        .map((id) => strategyConfigs[id])
        .filter((s): s is StrategySweepState => Boolean(s)),
    [selectedIds, strategyConfigs],
  );

  const estimate = useMemo(
    () => estimateSweepRuns(selectedStrategies, symbolList.length),
    [selectedStrategies, symbolList.length],
  );

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

  const updateStrategyConfig = (config: StrategySweepState) => {
    setStrategyConfigs((prev) => ({ ...prev, [config.id]: config }));
  };

  const runBacktests = useCallback(async () => {
    setError(null);
    setResults([]);

    if (selectedStrategies.length === 0) {
      setError("Select at least one strategy.");
      return;
    }
    if (symbolList.length === 0) {
      setError("Enter at least one symbol.");
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
      const priceData = await getPriceBarsBatch(symbolList, (done, total) => {
        setProgress({ done: Math.floor(done * 0.1), total: estimate.total });
      });

      const rows = await runParameterSweep({
        strategies: selectedStrategies,
        symbols: symbolList,
        priceData,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      setResults(rows);
      if (rows.length === 0) {
        setError(
          "No results. Ensure symbols have at least 60 bars of stored data.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backtest failed");
    } finally {
      setRunning(false);
    }
  }, [selectedStrategies, symbolList, estimate]);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="ui-panel p-6">
          <p className="ui-eyebrow">Step 1</p>
          <h2 className="ui-section-title mt-2">Select strategies</h2>
          <p className="ui-helper mt-1">
            Choose one or more strategies. Configure fixed values or sweep
            ranges for each parameter.
          </p>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search strategies…"
            className="ui-input mt-4"
          />

          <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
            {filteredPresets.map((preset) => {
              const style = categoryStyle(preset.category);
              const checked = selectedIds.includes(preset.id);
              return (
                <label
                  key={preset.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    checked
                      ? "border-brand bg-brand-light/40"
                      : "border-border-subtle bg-input hover:border-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStrategy(preset.id)}
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-ink">
                      {preset.pattern.name}
                    </span>
                    <span
                      className={`ui-badge ml-2 ${style.bg} ${style.text}`}
                    >
                      {preset.category}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="ui-panel p-6">
          <p className="ui-eyebrow">Step 2</p>
          <h2 className="ui-section-title mt-2">Select symbols</h2>
          <p className="ui-helper mt-1">
            Up to {MAX_BACKTEST_SYMBOLS} symbols per run.
          </p>

          <label className="mt-4 flex items-center gap-3 text-sm text-body">
            <input
              type="checkbox"
              checked={useStoredUniverse}
              onChange={(e) => setUseStoredUniverse(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Use all stored symbols ({storedSymbols.length})
          </label>

          {!useStoredUniverse && (
            <>
              <label className="mt-4 block">
                <span className="ui-field-label">Symbols</span>
                <textarea
                  value={symbolsInput}
                  onChange={(e) => setSymbolsInput(e.target.value.toUpperCase())}
                  rows={4}
                  className="ui-input mt-2 font-mono"
                  placeholder="AAPL, MSFT, GOOGL"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setSymbolsInput(DEFAULT_WATCHLIST.slice(0, MAX_BACKTEST_SYMBOLS).join(", "))
                }
                className="ui-btn-link mt-2"
              >
                Use default watchlist
              </button>
            </>
          )}

          <p className="ui-helper mt-4">
            {symbolList.length} symbol{symbolList.length === 1 ? "" : "s"} selected
            {symbolList.length > 0 && (
              <span className="text-muted"> · {symbolList.slice(0, 8).join(", ")}{symbolList.length > 8 ? "…" : ""}</span>
            )}
          </p>
        </div>
      </section>

      {selectedStrategies.length > 0 && (
        <section className="ui-panel p-6">
          <p className="ui-eyebrow">Step 3</p>
          <h2 className="ui-section-title mt-2">Optimization parameters</h2>
          <p className="ui-helper mt-1">
            Enable sweep on a parameter to test a range (e.g. EMA fast 3–10 step
            1, slow 50–60 step 10). Each strategy can have different settings.
          </p>

          <div className="mt-4 space-y-4">
            {selectedStrategies.map((config) => (
              <StrategySweepPanel
                key={config.id}
                config={config}
                onChange={updateStrategyConfig}
              />
            ))}
          </div>
        </section>
      )}

      <section className="ui-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="ui-eyebrow">Run</p>
            <h2 className="ui-section-title mt-2">Execute backtest</h2>
            <p className="ui-helper mt-1">
              Estimated {estimate.total.toLocaleString()} backtest
              {estimate.total === 1 ? "" : "s"} across {selectedStrategies.length}{" "}
              strateg{selectedStrategies.length === 1 ? "y" : "ies"} and{" "}
              {symbolList.length} symbol{symbolList.length === 1 ? "" : "s"}.
            </p>
          </div>
          <button
            type="button"
            disabled={running || selectedStrategies.length === 0}
            onClick={() => void runBacktests()}
            className="ui-btn-primary disabled:opacity-50"
          >
            {running ? "Running…" : "Run backtest"}
          </button>
        </div>

        {running && (
          <p className="ui-helper mt-4">
            Progress: {progress.done} / {progress.total}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </section>

      <ConsolidatedResultsPanel rows={results} />
    </div>
  );
}
