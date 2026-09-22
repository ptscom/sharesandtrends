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
  operandPickerValue,
  parseOperandPickerValue,
  primaryPeriodKey,
  PRICE_FIELD_OPTIONS,
} from "@/lib/explore/exploration-to-pattern";

/** Compact controls — !h-9 overrides global ui-input h-11 */
const FIELD =
  "ui-input !h-9 !min-h-9 shrink-0 px-2 !py-0 text-sm leading-tight";
const FIELD_NUM = `${FIELD} w-full tabular-nums`;
const FIELD_SRC = `${FIELD} w-full`;
const FIELD_OP = `${FIELD} w-full`;
const FIELD_IND = `${FIELD} w-full min-w-0`;

/** Shorter operator labels so selects don't truncate in the rule grid */
const OP_LABELS_COMPACT: Record<ExplorationOp, string> = {
  gt: "above",
  gte: "at/above",
  lt: "below",
  lte: "at/below",
  crosses_above: "cross above",
  crosses_below: "cross below",
};

/** Shared column tracks — flat fixed columns, no 1fr (avoids huge middle gap) */
const RULE_GRID_COLS =
  "grid-cols-[4.25rem_10rem_3.25rem_4.75rem_8.5rem_5rem_1.75rem]";
const RULE_GRID_GAP = "gap-x-1.5 gap-y-1";
const CONNECTOR_FIELD = `${FIELD} w-full !px-1 text-center text-[10px] font-bold uppercase tracking-tight`;

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
  initialName?: string;
  editingSavedId?: string | null;
  onClose: () => void;
  onAdd: (
    name: string,
    builder: ExplorationBuilderState,
    savedId?: string,
  ) => void;
}

export function ExplorationBuilderModal({
  open,
  initial,
  initialName,
  editingSavedId,
  onClose,
  onAdd,
}: ExplorationBuilderModalProps) {
  const [name, setName] = useState("Custom exploration");
  const [rows, setRows] = useState<ExplorationConditionRow[]>([]);

  useEffect(() => {
    if (!open) return;
    const normalized = normalizeBuilderState(
      initial ?? { rows: [{ id: crypto.randomUUID(), condition: createBlankCondition() }] },
    );
    setName(initialName?.trim() || "Custom exploration");
    setRows(
      normalized.rows.map((row) => ({
        ...row,
        condition: { ...row.condition },
      })),
    );
  }, [open, initial, initialName]);

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

  const handleAdd = () => {
    if (rows.length === 0) return;
    onAdd(name, { rows }, editingSavedId ?? undefined);
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
        className="relative flex max-h-[92vh] w-[min(96vw,920px)] flex-col rounded-[18px] border border-border bg-surface"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="ui-page-title text-base">Rule builder</h2>
            <p className="ui-helper mt-0.5 text-xs">
              IF / AND / OR rows · mix logic · candlesticks included
            </p>
          </div>
          <label className="min-w-[12rem] flex-1 text-sm sm:max-w-xs">
            <span className="ui-field-label text-xs">Filter name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${FIELD} mt-0.5 w-full`}
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="rounded-lg border border-border bg-bg/50 px-2.5 py-2">
            <div
              className={`grid w-fit max-w-full ${RULE_GRID_COLS} ${RULE_GRID_GAP}`}
            >
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
              className="mt-1.5 pl-0.5 text-xs font-medium text-brand-text hover:underline"
            >
              + Add condition
            </button>
          </div>

          <p className="mt-2 rounded-lg border border-border-subtle bg-bg px-3 py-2 text-xs text-muted">
            <span className="font-semibold uppercase tracking-wide">Preview</span>
            <span className="mx-1.5 text-border">·</span>
            <span className="text-ink">{preview}</span>
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-2.5">
          <button type="button" onClick={onClose} className="ui-btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={rows.length === 0 || !name.trim()}
            className="ui-btn-primary disabled:opacity-50"
          >
            Add to Exploration
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
    <div
      className={`col-span-full grid ${RULE_GRID_COLS} grid-cols-subgrid items-center ${RULE_GRID_GAP} rounded-md border border-transparent py-0.5 hover:border-border-subtle`}
    >
      <div className="flex h-9 w-full items-center justify-center">
        {index === 0 ? (
          <span className="w-full text-center text-[11px] font-bold uppercase tracking-wide text-muted">
            IF
          </span>
        ) : (
          <select
            value={connector ?? "and"}
            onChange={(e) =>
              onConnectorChange(e.target.value as "and" | "or")
            }
            className={CONNECTOR_FIELD}
            aria-label="Connector to previous condition"
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
          </select>
        )}
      </div>

      <LeftOperandFields
        operand={left}
        onChange={(next) => onChange({ left: next })}
      />

      <select
        value={condition.op}
        onChange={(e) => onChange({ op: e.target.value as ExplorationOp })}
        className={FIELD_OP}
      >
        {availableOps.map((op) => (
          <option key={op} value={op}>
            {OP_LABELS_COMPACT[op]}
          </option>
        ))}
      </select>

      <RightOperandPicker
        left={left}
        op={condition.op}
        operand={condition.right}
        onChange={(right) => onChange({ right })}
      />

      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="flex h-9 w-full items-center justify-center text-sm text-muted hover:text-ink"
          aria-label="Remove condition"
        >
          ✕
        </button>
      ) : (
        <span className="h-9" aria-hidden />
      )}
    </div>
  );
}

function LeftOperandFields({
  operand,
  onChange,
}: {
  operand: ExplorationOperand;
  onChange: (operand: ExplorationOperand) => void;
}) {
  const selectValue = operandPickerValue(operand);

  const indicatorType =
    operand.kind === "indicator" ? operand.indicatorType : "rsi";
  const periodKey = primaryPeriodKey(indicatorType);
  const def = getIndicatorDefinition(indicatorType);
  const outputs = def?.outputs ?? [];
  const isCandle = indicatorType === "candle_pattern";
  const showLinePicker =
    operand.kind === "indicator" &&
    !isCandle &&
    getIndicatorRole(indicatorType) === "line_cross" &&
    outputs.length > 1;
  const showSource =
    operand.kind === "indicator" &&
    !isCandle &&
    indicatorHasSource(indicatorType);
  const periodDefault = periodKey
    ? defaultPeriodForIndicator(indicatorType, periodKey)
    : 14;

  const showPeriod =
    operand.kind === "indicator" && periodKey && !isCandle && !showLinePicker;

  return (
    <>
      <select
        value={selectValue}
        onChange={(e) => {
          onChange(parseOperandPickerValue(e.target.value));
        }}
        className={FIELD_IND}
      >
        {groupedIndicatorsForPicker().map((group) => (
          <optgroup key={group.category} label={group.label}>
            {group.items.map((item) => (
              <option key={item.id} value={item.id.startsWith("candle:") ? item.id : `ind:${item.id}`}>
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

      {showPeriod ? (
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
                  defaultPeriodForIndicator(indicatorType, periodKey),
              },
            })
          }
          className={FIELD_NUM}
          aria-label="Period"
        />
      ) : showLinePicker && operand.kind === "indicator" ? (
        <select
          value={operand.output ?? outputs[0]}
          onChange={(e) => onChange({ ...operand, output: e.target.value })}
          className={FIELD_NUM}
          aria-label="Line"
        >
          {outputs.map((output) => (
            <option key={output} value={output}>
              {output}
            </option>
          ))}
        </select>
      ) : (
        <span className="h-9" aria-hidden />
      )}

      {showSource && operand.kind === "indicator" ? (
        <select
          value={String(operand.params.source ?? "close")}
          onChange={(e) =>
            onChange({
              ...operand,
              params: { ...operand.params, source: e.target.value },
            })
          }
          className={FIELD_SRC}
          aria-label="Price source"
        >
          {indicatorSourceOptions(indicatorType).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <span className="h-9" aria-hidden />
      )}
    </>
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
      operand.kind === "indicator"
        ? operand.output
        : outputs.find((o) => o !== leftLine);
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
        className={FIELD}
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

  if (leftRole === "oscillator" || leftRole === "pattern") {
    const defaultVal = leftRole === "pattern" ? 0.5 : 30;
    const value = operand.kind === "number" ? operand.value : defaultVal;
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
        className={`${FIELD} w-full tabular-nums`}
        aria-label="Threshold"
      />
    );
  }

  if (
    left.kind === "price" ||
    crossOp ||
    leftRole === "overlay" ||
    leftRole === "band"
  ) {
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
        className={`${FIELD} w-full`}
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
      className={`${FIELD} w-full tabular-nums`}
      aria-label="Value"
    />
  );
}
