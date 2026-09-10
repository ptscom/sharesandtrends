"use client";

import { useEffect, useMemo, useState } from "react";
import { ExplorationParamFields } from "@/components/explore/ExplorationParamFields";
import { OptimizationPanel } from "@/components/explore/OptimizationPanel";
import type { ExplorationPreset } from "@/lib/explore/exploration-presets";
import type { PatternDefinition } from "@/lib/types";

interface ExploreStrategySettingsModalProps {
  open: boolean;
  pattern: PatternDefinition | null;
  strategyName: string;
  explorationPreset?: ExplorationPreset | null;
  explorationParams?: Record<string, number | string>;
  settingsSubtitle?: string;
  hideBacktestSettings?: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: (pattern: PatternDefinition) => void;
  onExplorationParamsChange?: (
    params: Record<string, number | string>,
  ) => void;
}

export function ExploreStrategySettingsModal({
  open,
  pattern,
  strategyName,
  explorationPreset,
  explorationParams,
  settingsSubtitle,
  hideBacktestSettings = false,
  onClose,
  onSave,
  onChange,
  onExplorationParamsChange,
}: ExploreStrategySettingsModalProps) {
  const [draftParams, setDraftParams] = useState(explorationParams ?? {});

  useEffect(() => {
    if (open && explorationParams) {
      setDraftParams(explorationParams);
    }
  }, [open, explorationParams]);

  const subtitle = useMemo(() => {
    if (settingsSubtitle) return settingsSubtitle;
    if (explorationPreset) {
      return "Tune entry parameters the same way as indicator exploration. Exit and backtest settings are below.";
    }
    return "Adjust indicator periods, thresholds, and backtest settings.";
  }, [explorationPreset, settingsSubtitle]);

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

  if (!open || !pattern) return null;

  const handleExplorationParamsChange = (
    params: Record<string, number | string>,
  ) => {
    setDraftParams(params);
    onExplorationParamsChange?.(params);
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
        aria-labelledby="explore-settings-title"
        className="relative flex max-h-[85vh] w-[90vw] max-w-[720px] flex-col rounded-[18px] border border-border bg-surface"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="explore-settings-title" className="ui-page-title">
              {strategyName}
            </h2>
            <p className="ui-helper mt-0.5">{subtitle}</p>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {explorationPreset && onExplorationParamsChange ? (
            <>
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
              <section>
                <OptimizationPanel
                  pattern={pattern}
                  onChange={onChange}
                  hideGroups={
                    hideBacktestSettings
                      ? ["indicator", "threshold", "backtest"]
                      : ["indicator", "threshold"]
                  }
                />
              </section>
            </>
          ) : (
            <OptimizationPanel
              pattern={pattern}
              onChange={onChange}
              hideGroups={hideBacktestSettings ? ["backtest"] : []}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="ui-btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={onSave} className="ui-btn-primary">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
