"use client";

import { useEffect, useMemo, useState } from "react";
import { ExplorationParamFields } from "@/components/explore/ExplorationParamFields";
import { OptimizationPanel } from "@/components/explore/OptimizationPanel";
import { getExplorationPreset } from "@/lib/explore/exploration-presets";
import {
  buildSweepVarsForStrategy,
  normalizeExplorationStrategyPattern,
} from "@/lib/patterns/exploration-sweep-vars";
import {
  inferExplorationParams,
  rebuildStrategyPattern,
} from "@/lib/patterns/exploration-strategies";
import type { StrategySweepState } from "@/lib/engine/param-sweep";
import type { PatternDefinition } from "@/lib/types";

interface StrategySettingsModalProps {
  open: boolean;
  config: StrategySweepState | null;
  onClose: () => void;
  onChange: (config: StrategySweepState) => void;
}

export function StrategySettingsModal({
  open,
  config,
  onClose,
  onChange,
}: StrategySettingsModalProps) {
  const explorationPreset = config ? getExplorationPreset(config.id) : null;

  const explorationParams = useMemo(() => {
    if (!explorationPreset || !config) return undefined;
    return inferExplorationParams(explorationPreset, config.pattern);
  }, [explorationPreset, config]);

  const [draftParams, setDraftParams] = useState(explorationParams ?? {});

  useEffect(() => {
    if (open && explorationParams) {
      setDraftParams(explorationParams);
    }
  }, [open, explorationParams]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !config) return null;

  const updatePattern = (nextPattern: PatternDefinition) => {
    const normalized = normalizeExplorationStrategyPattern(config.id, nextPattern);
    onChange({
      ...config,
      pattern: normalized,
      vars: buildSweepVarsForStrategy(config.id, normalized),
    });
  };

  const handleExplorationParamsChange = (
    params: Record<string, number | string>,
  ) => {
    if (!explorationPreset) return;
    setDraftParams(params);
    const rebuilt = rebuildStrategyPattern(
      config.id,
      params,
      config.pattern,
      "1D",
    );
    onChange({
      ...config,
      pattern: rebuilt,
      vars: buildSweepVarsForStrategy(config.id, rebuilt),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="strategy-settings-title"
        className="relative flex max-h-[85vh] w-[90vw] max-w-[720px] flex-col rounded-[18px] border border-border bg-surface"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="strategy-settings-title" className="ui-page-title">
              {config.name}
            </h2>
            <p className="ui-helper mt-0.5">
              {explorationPreset
                ? "Entry parameters match indicator exploration. Configure signal exit and time exit below — whichever triggers first closes the trade."
                : "Configure entry parameters, signal exit, and time exit. Whichever exit triggers first closes the trade."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2.5 py-1.5 text-muted hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {explorationPreset ? (
            <section>
              <p className="ui-field-label">Entry parameters</p>
              <div className="mt-3">
                <ExplorationParamFields
                  paramDefs={explorationPreset.params}
                  params={draftParams}
                  onChange={handleExplorationParamsChange}
                />
              </div>
            </section>
          ) : (
            <OptimizationPanel
              pattern={config.pattern}
              onChange={updatePattern}
              includeGroups={["indicator", "entry"]}
            />
          )}

          <OptimizationPanel
            pattern={config.pattern}
            onChange={updatePattern}
            includeGroups={["signal_exit", "time_exit", "backtest"]}
          />
        </div>

        <div className="flex items-center justify-end border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="ui-btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
