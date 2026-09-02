"use client";

import { useEffect, useState } from "react";
import { getIndicatorDefinition } from "@/lib/engine/registry";
import type {
  ExplorationBuilderState,
  ExplorationCondition,
  ExplorationConditionRow,
  ExplorationOp,
  ExplorationOperand,
  PriceField,
} from "@/lib/explore/exploration-models";
import {
  coerceConditionForLeft,
  createBlankCondition,
  createBlankRow,
  defaultIndicatorParams,
  defaultOpForLeft,
  defaultPeriodForIndicator,
  defaultRightForLeft,
  describeBuilderState,
  getIndicatorRole,
  groupedIndicatorsForPicker,
  indicatorHasSource,
  indicatorSourceOptions,
  INDICATOR_SHORT_NAMES,
  normalizeBuilderState,
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
  const [rows, setRows] = useState<ExplorationConditionRow[]>([]);

  useEffect(() => {
    if (!open) return;
    const normalized = normalizeBuilderState(
      initial ?? { rows: [{ id: crypto.randomUUID(), condition: createBlankCondition() }] },
    );
    setName("Custom exploration");
    setRows(
      normalized.rows.map((row) => ({
        ...row,
        condition: { ...row.condition },
      })),
    );
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

  const updateRow = (
    id: string,
    patch: {
      connector?: "and" | "or";
      condition?: Partial<ExplorationCondition>;
    },
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        let nextCondition: ExplorationCondition = patch.condition
          ? { ...row.condition, ...patch.condition }
          : row.condition;

        if (patch.condition?.left) {
          const coerced = coerceConditionForLeft(
            nextCondition.left,
            defaultOpForLeft(nextCondition.left),
            defaultRightForLeft(nextCondition.left),
          );
          nextCondition = {
            ...nextCondition,
            op: coerced.op,
            right: coerced.right,
          };
        }

        if (
          patch.condition?.left ||
          patch.condition?.op ||
          patch.condition?.right
        ) {
          const coerced = coerceConditionForLeft(
            nextCondition.left,
            nextCondition.op,
            nextCondition.right,
          );
          nextCondition = {
            ...nextCondition,
            op: coerced.op,
            right: coerced.right,
          };
        }

        return {
          ...row,
          connector: patch.connector ?? row.connector,
          condition: nextCondition,
        };
      }),
    );
  };

  const handleSave = () => {
    if (rows.length === 0) return;
    onSave(name, { rows });
    onClose();
  };

  const preview = describeBuilderState({ rows });

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
        className="relative flex max-h-[90vh] w-[95vw] max-w-[760px] flex-col rounded-[18px] border border-border bg-surface"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="ui-page-title">Rule builder</h2>
          <p className="ui-helper mt-0.5">
            Build a filter with IF / AND / OR rows. Each indicator can use its
            own source (close, open, etc.). Mix AND and OR between rows — e.g. A
            OR B AND C OR A.
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
            <p className="mb-3 text-sm font-medium text-ink">Conditions</p>

            <div className="space-y-3">
              {rows.map((row, index) => (
                <RuleRow
                  key={row.id}
                  index={index}
                  connector={row.connector}
                  condition={row.condition}
                  onConnectorChange={(connector) =>
                    updateRow(row.id, { connector })
                  }
                  onChange={(patch) =>
                    updateRow(row.id, { condition: patch })
                  }
                  onRemove={() =>
                    setRows((prev) => prev.filter((r) => r.id !== row.id))
                  }
                  canRemove={rows.length > 1}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, createBlankRow()])}
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
            disabled={rows.length === 0}
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
  index,
  connector,
  condition,
  onConnectorChange,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  connector?: "and" | "or";
  condition: ExplorationCondition;
  onConnectorChange: (connector: "and" | "or") => void;
  onChange: (patch: Partial<ExplorationCondition>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const left = condition.left;
  const availableOps = operatorsForLeft(left);

  return (
    <div className="flex items-start gap-3">
      <div className="flex w-16 shrink-0 flex-col gap-1 pt-2">
        {index === 0 ? (
          <span className="text-xs font-bold uppercase tracking-wide text-muted">
            IF
          </span>
        ) : (
          <select
            value={connector ?? "and"}
            onChange={(e) =>
              onConnectorChange(e.target.value as "and" | "or")
            }
            className="ui-input px-1 text-xs font-bold uppercase"
            aria-label="Connector to previous condition"
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        )}
      </div>

      <div className="grid min-w-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.75fr)]">
        <LeftOperandPicker
          operand={left}
          onChange={(next) => onChange({ left: next })}
        />

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
          className="shrink-0 pt-2 text-muted hover:text-ink"
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

  const showSource =
    operand.kind === "indicator" && indicatorHasSource(operand.indicatorType);

  const periodDefault =
    operand.kind === "indicator" && periodKey
      ? defaultPeriodForIndicator(operand.indicatorType, periodKey)
      : 14;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
        className="ui-input min-w-[5.5rem] flex-1"
      >
        {groupedIndicatorsForPicker().map((group) => (
          <optgroup key={group.category} label={group.label}>
            {group.items.map((item) => (
              <option key={item.id} value={`ind:${item.id}`}>
                {item.name}
              </option>
            ))}
          </optgroup>
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
          value={Number(operand.params[periodKey] ?? periodDefault)}
          min={2}
          max={500}
          onChange={(e) =>
            onChange({
              ...operand,
              params: {
                ...operand.params,
                [periodKey]:
                  parseInt(e.target.value, 10) ||
                  defaultPeriodForIndicator(operand.indicatorType, periodKey),
              },
            })
          }
          className="ui-input w-14 shrink-0 tabular-nums"
          aria-label="Period"
        />
      )}

      {showSource && operand.kind === "indicator" && (
        <select
          value={String(operand.params.source ?? "close")}
          onChange={(e) =>
            onChange({
              ...operand,
              params: { ...operand.params, source: e.target.value },
            })
          }
          className="ui-input w-[5.25rem] shrink-0"
          aria-label="Price source"
        >
          {indicatorSourceOptions(operand.indicatorType).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {showLinePicker && operand.kind === "indicator" && (
        <select
          value={operand.output ?? outputs[0]}
          onChange={(e) => onChange({ ...operand, output: e.target.value })}
          className="ui-input w-20 shrink-0"
          aria-label="Line"
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
          {["sma", "ema", "wma"].flatMap((type) =>
            [20, 50, 200].map((period) => (
              <option key={`${type}-${period}`} value={`ind:${type}:${period}`}>
                {INDICATOR_SHORT_NAMES[type] ?? type} {period}
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
