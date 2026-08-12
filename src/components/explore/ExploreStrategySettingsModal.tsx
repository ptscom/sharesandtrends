"use client";

import { useEffect } from "react";
import { OptimizationPanel } from "@/components/explore/OptimizationPanel";
import type { PatternDefinition } from "@/lib/types";

interface ExploreStrategySettingsModalProps {
  open: boolean;
  pattern: PatternDefinition | null;
  strategyName: string;
  onClose: () => void;
  onSave: () => void;
  onChange: (pattern: PatternDefinition) => void;
}

export function ExploreStrategySettingsModal({
  open,
  pattern,
  strategyName,
  onClose,
  onSave,
  onChange,
}: ExploreStrategySettingsModalProps) {
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
            <p className="ui-helper mt-0.5">
              Adjust indicator periods, thresholds, and backtest settings.
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <OptimizationPanel pattern={pattern} onChange={onChange} />
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
