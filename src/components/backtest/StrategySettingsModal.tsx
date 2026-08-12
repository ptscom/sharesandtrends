"use client";

import { useEffect } from "react";
import { StrategySweepPanel } from "@/components/backtest/StrategySweepPanel";
import type { StrategySweepState } from "@/lib/engine/param-sweep";

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
              Configure fixed values or sweep ranges for each parameter.
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
          <StrategySweepPanel config={config} onChange={onChange} hideTitle />
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
