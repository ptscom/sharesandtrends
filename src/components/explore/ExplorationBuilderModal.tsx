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
  createBlankCondition,
  defaultIndicatorParams,
  describeBuilderState,
  isValidOperandPair,
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

const OPS: { value: ExplorationOp; label: string; cross?: boolean }[] = [
  { value: "crosses_above", label: "Crosses above", cross: true },
  { value: "crosses_below", label: "Crosses below", cross: true },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
];

const OSCILLATOR_TYPES = new Set([
  "rsi",
  "cci",
  "williamsr",
  "mfi",
  "adx",
  "roc",
  "momentum",
  "zscore",
]);

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
        const next = { ...condition, ...patch };
        if (
          patch.left ||
          patch.right ||
          patch.op
        ) {
          if (!isValidOperandPair(next.left, next.op, next.right)) {
            if (next.op === "crosses_above" || next.op === "crosses_below") {
              if (next.right.kind === "number") {
                next.right = { kind: "price", field: "close" };
              }
            }
          }
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
        className="relative flex max-h-[90vh] w-[95vw] max-w-[760px] flex-col rounded-[18px] border border-border bg-surface"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="ui-page-title">Exploration builder</h2>
          <p className="ui-helper mt-0.5">
            Combine conditions with AND / OR. Operands are typed — crosses
            compare two series; thresholds use a number on the right.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-sm">
            <span className="ui-field-label">Filter name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="ui-input mt-1"
            />
          </label>

          <div>
            <span className="ui-field-label">Combine with</span>
            <div className="mt-2 flex gap-2">
              {(["and", "or"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLogic(item)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium uppercase ${
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
              <ConditionRow
                key={condition.id}
                index={index}
                logic={logic}
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
            className="ui-btn-secondary text-sm"
          >
            + Add condition
          </button>

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

function ConditionRow({
  index,
  logic,
  condition,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  logic: "and" | "or";
  condition: ExplorationCondition;
  onChange: (patch: Partial<ExplorationCondition>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const crossOp =
    condition.op === "crosses_above" || condition.op === "crosses_below";
  const leftIsOscillator =
    condition.left.kind === "indicator" &&
    OSCILLATOR_TYPES.has(condition.left.indicatorType);

  const availableOps = OPS.filter((op) => {
    if (leftIsOscillator && op.cross) return false;
    return true;
  });

  return (
    <div className="rounded-xl border border-border p-3">
      {index > 0 && (
        <p className="mb-2 text-xs font-semibold uppercase text-muted">
          {logic}
        </p>
      )}
      <div className="grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto]">
        <OperandEditor
          operand={condition.left}
          onChange={(left) => onChange({ left })}
        />
        <select
          value={condition.op}
          onChange={(e) => onChange({ op: e.target.value as ExplorationOp })}
          className="ui-input"
        >
          {availableOps.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
        <OperandEditor
          operand={condition.right}
          onChange={(right) => onChange({ right })}
          allowNumber={!crossOp}
          leftHint={condition.left}
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-muted hover:text-ink"
            aria-label="Remove condition"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function OperandEditor({
  operand,
  onChange,
  allowNumber = true,
  leftHint,
}: {
  operand: ExplorationOperand;
  onChange: (operand: ExplorationOperand) => void;
  allowNumber?: boolean;
  leftHint?: ExplorationOperand;
}) {
  const [kind, setKind] = useState<"price" | "indicator" | "number">(
    operand.kind,
  );

  useEffect(() => {
    setKind(operand.kind);
  }, [operand.kind]);

  const leftIsOscillator =
    leftHint?.kind === "indicator" &&
    OSCILLATOR_TYPES.has(leftHint.indicatorType);

  return (
    <div className="space-y-2">
      <select
        value={kind}
        onChange={(e) => {
          const next = e.target.value as "price" | "indicator" | "number";
          setKind(next);
          if (next === "price") {
            onChange({ kind: "price", field: "close" });
          } else if (next === "number") {
            onChange({ kind: "number", value: leftIsOscillator ? 50 : 0 });
          } else {
            onChange({
              kind: "indicator",
              indicatorType: "sma",
              params: defaultIndicatorParams("sma"),
            });
          }
        }}
        className="ui-input"
      >
        <option value="price">Price</option>
        <option value="indicator">Indicator</option>
        {allowNumber && <option value="number">Number</option>}
      </select>

      {operand.kind === "price" && (
        <select
          value={operand.field}
          onChange={(e) =>
            onChange({ kind: "price", field: e.target.value as PriceField })
          }
          className="ui-input"
        >
          {PRICE_FIELD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {operand.kind === "number" && (
        <input
          type="number"
          value={operand.value}
          onChange={(e) =>
            onChange({ kind: "number", value: parseFloat(e.target.value) })
          }
          className="ui-input"
        />
      )}

      {operand.kind === "indicator" && (
        <IndicatorOperandEditor operand={operand} onChange={onChange} />
      )}
    </div>
  );
}

function IndicatorOperandEditor({
  operand,
  onChange,
}: {
  operand: Extract<ExplorationOperand, { kind: "indicator" }>;
  onChange: (operand: ExplorationOperand) => void;
}) {
  const def = getIndicatorDefinition(operand.indicatorType);
  const outputs = def?.outputs ?? [];

  return (
    <div className="space-y-2">
      <select
        value={operand.indicatorType}
        onChange={(e) => {
          const type = e.target.value;
          onChange({
            kind: "indicator",
            indicatorType: type,
            params: defaultIndicatorParams(type),
            output: undefined,
          });
        }}
        className="ui-input"
      >
        {INDICATOR_REGISTRY.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>

      {def &&
        Object.entries(def.params).map(([key, schema]) => (
          <label key={key} className="block text-xs">
            <span className="text-muted">{schema.label ?? key}</span>
            {schema.type === "enum" ? (
              <select
                value={String(operand.params[key] ?? schema.default)}
                onChange={(e) =>
                  onChange({
                    ...operand,
                    params: { ...operand.params, [key]: e.target.value },
                  })
                }
                className="ui-input mt-1"
              >
                {(schema.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                value={Number(operand.params[key] ?? schema.default)}
                min={schema.min}
                max={schema.max}
                step={schema.type === "float" ? 0.1 : 1}
                onChange={(e) =>
                  onChange({
                    ...operand,
                    params: {
                      ...operand.params,
                      [key]:
                        schema.type === "float"
                          ? parseFloat(e.target.value)
                          : parseInt(e.target.value, 10),
                    },
                  })
                }
                className="ui-input mt-1"
              />
            )}
          </label>
        ))}

      {outputs.length > 1 && (
        <select
          value={operand.output ?? outputs[0]}
          onChange={(e) =>
            onChange({ ...operand, output: e.target.value })
          }
          className="ui-input"
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
