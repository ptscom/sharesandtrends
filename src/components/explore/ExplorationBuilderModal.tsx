"use client";

import { useEffect, useState } from "react";
import {
  getIndicatorDefinition,
  INDICATOR_REGISTRY,
} from "@/lib/engine/registry";
import type {
  ExplorationBuilderState,
  ExplorationCondition,
  ExplorationOp,
  ExplorationOperand,
  PriceField,
} from "@/lib/explore/exploration-models";
import {
  coerceConditionForLeft,
  createBlankCondition,
  defaultIndicatorParams,
  defaultOpForLeft,
  defaultRightForLeft,
  describeBuilderState,
  formatIndicatorLabel,
  getIndicatorRole,
  operatorsForLeft,
  OP_LABELS,
  primaryPeriodKey,
  PRICE_FIELD_OPTIONS,
} from "@/lib/explore/exploration-to-pattern";

interface ExplorationPresetSettingsModalProps {
  open: boolean;
  presetName: string;
  params: Record<string, number | string>;
  paramDefs: {
    key: string;
    label: string;
    type: "int" | "float" | "enum";
    default: number | string;
    min?: number;
    max?: number;
    options?: { value: string; label: string }[];
  }[];
  description: string;
  onClose: () => void;
  onSave: (params: Record<string, number | string>) => void;
}

export function ExplorationPresetSettingsModal({
  open,
  presetName,
  params,
  paramDefs,
  description,
  onClose,
  onSave,
}: ExplorationPresetSettingsModalProps) {
  const [draft, setDraft] = useState(params);

  useEffect(() => {
    if (open) setDraft(params);
  }, [open, params]);

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
        className="relative flex max-h-[90vh] w-[95vw] max-w-[520px] flex-col rounded-[18px] border border-border bg-surface"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="ui-page-title">{presetName}</h2>
          <p className="ui-helper mt-0.5">{description}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {paramDefs.map((def) => (
            <label key={def.key} className="block text-sm">
              <span className="ui-field-label">{def.label}</span>
              {def.type === "enum" ? (
                <select
                  value={String(draft[def.key] ?? def.default)}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [def.key]: e.target.value }))
                  }
                  className="ui-input mt-1"
                >
                  {(def.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={Number(draft[def.key] ?? def.default)}
                  min={def.min}
                  max={def.max}
                  step={def.type === "float" ? 0.1 : 1}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [def.key]:
                        def.type === "float"
                          ? parseFloat(e.target.value)
                          : parseInt(e.target.value, 10),
                    }))
                  }
                  className="ui-input mt-1"
                />
              )}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="ui-btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="ui-btn-primary"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

interface ExplorationBuilderModalProps {
  open: boolean;
  initial: ExplorationBuilderState | null;
  onClose: () => void;
  onSave: (name: string, builder: ExplorationBuilderState) => void;
}

export function ExplorationBuilderModal({
  open,
  initial,
  onClose,
  onSave,
}: ExplorationBuilderModalProps) {
  const [name, setName] = useState("Custom exploration");
  const [logic, setLogic] = useState<"and" | "or">("and");
  const [conditions, setConditions] = useState<ExplorationCondition[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName("Custom exploration");
      setLogic(initial.logic);
      setConditions(initial.conditions.map((c) => ({ ...c })));
    } else {
      setName("Custom exploration");
      setLogic("and");
      setConditions([createBlankCondition()]);
    }
  }, [open, initial]);

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

  const updateCondition = (
    id: string,
    patch: Partial<ExplorationCondition>,
  ) => {
    setConditions((prev) =>
      prev.map((condition) => {
        if (condition.id !== id) return condition;

        let next: ExplorationCondition = { ...condition, ...patch };

        if (patch.left) {
          const coerced = coerceConditionForLeft(
            next.left,
            defaultOpForLeft(next.left),
            defaultRightForLeft(next.left),
          );
          next = { ...next, op: coerced.op, right: coerced.right };
        }

        if (patch.left || patch.op || patch.right) {
          const coerced = coerceConditionForLeft(
            next.left,
            next.op,
            next.right,
          );
          next = { ...next, op: coerced.op, right: coerced.right };
        }

        return next;
      }),
    );
  };

  const handleSave = () => {
    if (conditions.length === 0) return;
    onSave(name, { logic, conditions });
    onClose();
  };

  const preview = describeBuilderState({ logic, conditions });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        aria-label="Close builder"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90vh] w-[95vw] max-w-[680px] flex-col rounded-[18px] border border-border bg-surface"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="ui-page-title">Rule builder</h2>
          <p className="ui-helper mt-0.5">
            Build a filter with IF / AND rows. Pick an indicator, choose how it
            compares, then set the threshold or compare target.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <label className="block text-sm">
            <span className="ui-field-label">Filter name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ui-input mt-1"
            />
          </label>

          <div className="rounded-xl border border-border bg-bg/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink">Conditions</p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted">Combine with</span>
                {(["and", "or"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setLogic(item)}
                    className={`rounded-md border px-2 py-1 font-semibold uppercase ${
                      logic === item
                        ? "border-brand bg-brand/10 text-brand-text"
                        : "border-border text-muted"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <RuleRow
                  key={condition.id}
                  label={index === 0 ? "IF" : logic.toUpperCase()}
                  condition={condition}
                  onChange={(patch) => updateCondition(condition.id, patch)}
                  onRemove={() =>
                    setConditions((prev) =>
                      prev.filter((c) => c.id !== condition.id),
                    )
                  }
                  canRemove={conditions.length > 1}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setConditions((prev) => [...prev, createBlankCondition()])
              }
              className="mt-3 text-sm font-medium text-brand-text hover:underline"
            >
              + Add condition
            </button>
          </div>

          <div className="rounded-xl border border-border-subtle bg-bg px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Preview
            </p>
            <p className="mt-1 text-sm text-ink">{preview}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="ui-btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={conditions.length === 0}
            className="ui-btn-primary disabled:opacity-50"
          >
            Use filter
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleRow({
  label,
  condition,
  onChange,
  onRemove,
  canRemove,
}: {
  label: string;
  condition: ExplorationCondition;
  onChange: (patch: Partial<ExplorationCondition>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const left = condition.left;
  const availableOps = operatorsForLeft(left);

  return (
    <div className="flex items-center gap-3">
      <span className="w-10 shrink-0 text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </span>

      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        <LeftOperandPicker operand={left} onChange={(next) => onChange({ left: next })} />

        <select
          value={condition.op}
          onChange={(e) => onChange({ op: e.target.value as ExplorationOp })}
          className="ui-input"
        >
          {availableOps.map((op) => (
            <option key={op} value={op}>
              {OP_LABELS[op]}
            </option>
          ))}
        </select>

        <RightOperandPicker
          left={left}
          op={condition.op}
          operand={condition.right}
          onChange={(right) => onChange({ right })}
        />
      </div>

      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-muted hover:text-ink"
          aria-label="Remove condition"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function LeftOperandPicker({
  operand,
  onChange,
}: {
  operand: ExplorationOperand;
  onChange: (operand: ExplorationOperand) => void;
}) {
  const selectValue =
    operand.kind === "price"
      ? `price:${operand.field}`
      : operand.kind === "indicator"
        ? `ind:${operand.indicatorType}`
        : "ind:rsi";

  const indicatorOperand =
    operand.kind === "indicator"
      ? operand
      : {
          kind: "indicator" as const,
          indicatorType: "rsi",
          params: defaultIndicatorParams("rsi"),
        };

  const periodKey = primaryPeriodKey(indicatorOperand.indicatorType);
  const def = getIndicatorDefinition(indicatorOperand.indicatorType);
  const outputs = def?.outputs ?? [];
  const showLinePicker =
    operand.kind === "indicator" &&
    getIndicatorRole(operand.indicatorType) === "line_cross" &&
    outputs.length > 1;

  return (
    <div className="flex min-w-0 gap-2">
      <select
        value={selectValue}
        onChange={(e) => {
          const value = e.target.value;
          if (value.startsWith("price:")) {
            onChange({
              kind: "price",
              field: value.replace("price:", "") as PriceField,
            });
            return;
          }
          const type = value.replace("ind:", "");
          onChange({
            kind: "indicator",
            indicatorType: type,
            params: defaultIndicatorParams(type),
            output: undefined,
          });
        }}
        className="ui-input min-w-0 flex-1"
      >
        {INDICATOR_REGISTRY.map((item) => (
          <option key={item.id} value={`ind:${item.id}`}>
            {formatIndicatorLabel(item.id, defaultIndicatorParams(item.id))}
          </option>
        ))}
        <optgroup label="Price">
          {PRICE_FIELD_OPTIONS.map((opt) => (
            <option key={opt.value} value={`price:${opt.value}`}>
              {opt.label}
            </option>
          ))}
        </optgroup>
      </select>

      {operand.kind === "indicator" && periodKey && (
        <input
          type="number"
          value={Number(operand.params[periodKey] ?? 14)}
          min={2}
          max={500}
          onChange={(e) =>
            onChange({
              ...operand,
              params: {
                ...operand.params,
                [periodKey]: parseInt(e.target.value, 10) || 14,
              },
            })
          }
          className="ui-input w-16 shrink-0 tabular-nums"
          aria-label="Period"
        />
      )}

      {showLinePicker && operand.kind === "indicator" && (
        <select
          value={operand.output ?? outputs[0]}
          onChange={(e) => onChange({ ...operand, output: e.target.value })}
          className="ui-input w-24 shrink-0"
        >
          {outputs.map((output) => (
            <option key={output} value={output}>
              {output}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function RightOperandPicker({
  left,
  op,
  operand,
  onChange,
}: {
  left: ExplorationOperand;
  op: ExplorationOp;
  operand: ExplorationOperand;
  onChange: (operand: ExplorationOperand) => void;
}) {
  const crossOp = op === "crosses_above" || op === "crosses_below";
  const leftRole =
    left.kind === "indicator" ? getIndicatorRole(left.indicatorType) : null;

  if (leftRole === "line_cross" && left.kind === "indicator") {
    const def = getIndicatorDefinition(left.indicatorType);
    const outputs = def?.outputs ?? [];
    const leftLine = left.output ?? outputs[0];
    const currentOutput =
      operand.kind === "indicator" ? operand.output : outputs.find((o) => o !== leftLine);
    return (
      <select
        value={currentOutput ?? outputs[1] ?? outputs[0]}
        onChange={(e) =>
          onChange({
            kind: "indicator",
            indicatorType: left.indicatorType,
            params: { ...left.params },
            output: e.target.value,
          })
        }
        className="ui-input"
      >
        {outputs
          .filter((output) => output !== leftLine)
          .map((output) => (
            <option key={output} value={output}>
              {output}
            </option>
          ))}
      </select>
    );
  }

  if (leftRole === "oscillator") {
    const value = operand.kind === "number" ? operand.value : 30;
    return (
      <input
        type="number"
        value={value}
        step={
          left.kind === "indicator" && left.indicatorType === "rsi" ? 1 : 0.1
        }
        onChange={(e) =>
          onChange({ kind: "number", value: parseFloat(e.target.value) || 0 })
        }
        className="ui-input tabular-nums"
        aria-label="Threshold"
      />
    );
  }

  if (left.kind === "price" || crossOp || leftRole === "overlay" || leftRole === "band") {
    const selectValue =
      operand.kind === "price"
        ? `price:${operand.field}`
        : operand.kind === "indicator"
          ? `ind:${operand.indicatorType}:${operand.params.length ?? 20}`
          : "price:close";

    return (
      <select
        value={selectValue}
        onChange={(e) => {
          const value = e.target.value;
          if (value.startsWith("price:")) {
            onChange({
              kind: "price",
              field: value.replace("price:", "") as PriceField,
            });
            return;
          }
          const [, type, period] = value.split(":");
          onChange({
            kind: "indicator",
            indicatorType: type!,
            params: {
              ...defaultIndicatorParams(type!),
              length: parseInt(period ?? "20", 10),
            },
          });
        }}
        className="ui-input"
      >
        <optgroup label="Price">
          {PRICE_FIELD_OPTIONS.map((opt) => (
            <option key={opt.value} value={`price:${opt.value}`}>
              {opt.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Moving averages">
          {["sma", "ema"].flatMap((type) =>
            [20, 50, 200].map((period) => (
              <option key={`${type}-${period}`} value={`ind:${type}:${period}`}>
                {formatIndicatorLabel(type, { length: period })}
              </option>
            )),
          )}
        </optgroup>
      </select>
    );
  }

  const value = operand.kind === "number" ? operand.value : 0;
  return (
    <input
      type="number"
      value={value}
      onChange={(e) =>
        onChange({ kind: "number", value: parseFloat(e.target.value) || 0 })
      }
      className="ui-input tabular-nums"
      aria-label="Value"
    />
  );
}
