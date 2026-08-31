"use client";

import { useEffect, useState } from "react";
import {
  getIndicatorDefinition,
  INDICATOR_REGISTRY,
  type IndicatorDefinition,
} from "@/lib/engine/registry";
import {
  createComboIndicatorItem,
  defaultParamsForIndicator,
  defaultRuleForIndicator,
  primaryOutputKey,
  type IndicatorComboPart,
  type IndicatorRule,
  type IndicatorRuleOp,
} from "@/lib/explore/indicator-models";
import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";
import { IndicatorSettingsModal } from "@/components/explore/IndicatorSettingsModal";

interface IndicatorComboBuilderModalProps {
  open: boolean;
  timeframeMode: ExploreTimeframeMode;
  onClose: () => void;
  onSave: (combo: ReturnType<typeof createComboIndicatorItem>) => void;
}

const RULE_OPS: { value: IndicatorRuleOp; label: string }[] = [
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "crosses_above", label: "Crosses above" },
  { value: "crosses_below", label: "Crosses below" },
];

export function IndicatorComboBuilderModal({
  open,
  timeframeMode,
  onClose,
  onSave,
}: IndicatorComboBuilderModalProps) {
  const [name, setName] = useState("Custom combo");
  const [comboLogic, setComboLogic] = useState<"and" | "or">("and");
  const [parts, setParts] = useState<IndicatorComboPart[]>([]);
  const [settingsPartId, setSettingsPartId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("Custom combo");
    setComboLogic("and");
    setParts([]);
    setSettingsPartId(null);
  }, [open]);

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

  if (!open) return null;

  const settingsPart = parts.find((p) => p.id === settingsPartId);

  const addPart = (type: string) => {
    const def = getIndicatorDefinition(type);
    if (!def) return;
    const alias = type;
    setParts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        indicatorType: type,
        name: def.name,
        params: defaultParamsForIndicator(def),
        outputKey: primaryOutputKey(def, alias),
        rule: defaultRuleForIndicator(type),
      },
    ]);
  };

  const updatePart = (
    id: string,
    params: Record<string, number | string>,
    rule: IndicatorRule,
  ) => {
    setParts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, params, rule } : p)),
    );
    setSettingsPartId(null);
  };

  const handleSave = () => {
    if (parts.length === 0) return;
    onSave(createComboIndicatorItem(name, timeframeMode, comboLogic, parts));
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
        <button
          type="button"
          className="absolute inset-0 bg-ink/30"
          aria-label="Close combo builder"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          className="relative flex max-h-[90vh] w-[95vw] max-w-[720px] flex-col rounded-[18px] border border-border bg-surface"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="border-b border-border px-5 py-4">
            <h2 className="ui-page-title">Build indicator combo</h2>
            <p className="ui-helper mt-0.5">
              Combine indicators with AND / OR and custom conditions.
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <label className="block text-sm">
              <span className="ui-field-label">Combo name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="ui-input mt-1"
              />
            </label>

            <div>
              <span className="ui-field-label">Combine with</span>
              <div className="mt-2 flex gap-2">
                {(["and", "or"] as const).map((logic) => (
                  <button
                    key={logic}
                    type="button"
                    onClick={() => setComboLogic(logic)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium uppercase ${
                      comboLogic === logic
                        ? "border-brand bg-brand/10 text-brand-text"
                        : "border-border text-muted"
                    }`}
                  >
                    {logic}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {parts.map((part, index) => (
                <div
                  key={part.id}
                  className="flex items-center gap-2 rounded-xl border border-border p-3"
                >
                  {index > 0 && (
                    <span className="text-xs font-semibold uppercase text-muted">
                      {comboLogic}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{part.name}</p>
                    <p className="text-xs text-muted">
                      {part.rule.op}{" "}
                      {part.rule.compareTo === "value"
                        ? part.rule.value
                        : part.rule.seriesRef}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettingsPartId(part.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:border-brand"
                    aria-label={`Configure ${part.name}`}
                  >
                    ⚙
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setParts((prev) => prev.filter((p) => p.id !== part.id))
                    }
                    className="text-muted hover:text-ink"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div>
              <p className="ui-field-label">Add indicator</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {INDICATOR_REGISTRY.map((def) => (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => addPart(def.id)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-brand"
                  >
                    + {def.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button type="button" onClick={onClose} className="ui-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={parts.length === 0}
              className="ui-btn-primary disabled:opacity-50"
            >
              Save combo
            </button>
          </div>
        </div>
      </div>

      {settingsPart && (
        <IndicatorSettingsModal
          open
          indicatorName={settingsPart.name}
          indicatorType={settingsPart.indicatorType}
          params={settingsPart.params}
          rule={settingsPart.rule}
          onClose={() => setSettingsPartId(null)}
          onSave={(params, rule) => updatePart(settingsPart.id, params, rule)}
        />
      )}
    </>
  );
}
