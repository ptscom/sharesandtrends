"use client";

import { useEffect, useState } from "react";
import {
  getIndicatorDefinition,
  type IndicatorDefinition,
} from "@/lib/engine/registry";
import type { IndicatorRule, IndicatorRuleOp } from "@/lib/explore/indicator-models";

interface IndicatorSettingsModalProps {
  open: boolean;
  indicatorName: string;
  indicatorType: string;
  params: Record<string, number | string>;
  rule: IndicatorRule;
  onClose: () => void;
  onSave: (
    params: Record<string, number | string>,
    rule: IndicatorRule,
  ) => void;
}

const RULE_OPS: { value: IndicatorRuleOp; label: string }[] = [
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less or equal" },
  { value: "crosses_above", label: "Crosses above" },
  { value: "crosses_below", label: "Crosses below" },
];

export function IndicatorSettingsModal({
  open,
  indicatorName,
  indicatorType,
  params,
  rule,
  onClose,
  onSave,
}: IndicatorSettingsModalProps) {
  const def = getIndicatorDefinition(indicatorType);

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

  if (!open || !def) return null;

  return (
    <IndicatorSettingsForm
      indicatorName={indicatorName}
      def={def}
      params={params}
      rule={rule}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function IndicatorSettingsForm({
  indicatorName,
  def,
  params: initialParams,
  rule: initialRule,
  onClose,
  onSave,
}: {
  indicatorName: string;
  def: IndicatorDefinition;
  params: Record<string, number | string>;
  rule: IndicatorRule;
  onClose: () => void;
  onSave: (
    params: Record<string, number | string>,
    rule: IndicatorRule,
  ) => void;
}) {
  const [params, setParams] = useState(initialParams);
  const [rule, setRule] = useState(initialRule);

  useEffect(() => {
    setParams(initialParams);
    setRule(initialRule);
  }, [initialParams, initialRule]);

  const compareOptions = buildCompareOptions(def);

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
        className="relative flex max-h-[85vh] w-[90vw] max-w-[560px] flex-col rounded-[18px] border border-border bg-surface"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="ui-page-title">{indicatorName}</h2>
          <p className="ui-helper mt-0.5">
            Indicator parameters and signal condition.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <p className="ui-field-label">Parameters</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {Object.entries(def.params).map(([key, schema]) => (
                <label key={key} className="block text-sm">
                  <span className="ui-field-label">{schema.label}</span>
                  {schema.type === "enum" ? (
                    <select
                      value={String(params[key] ?? schema.default)}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="ui-input mt-1"
                    >
                      {schema.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={Number(params[key] ?? schema.default)}
                      min={schema.min}
                      max={schema.max}
                      step={schema.type === "float" ? 0.01 : 1}
                      onChange={(e) =>
                        setParams((prev) => ({
                          ...prev,
                          [key]:
                            schema.type === "float"
                              ? Number(e.target.value)
                              : Number.parseInt(e.target.value, 10),
                        }))
                      }
                      className="ui-input mt-1"
                    />
                  )}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="ui-field-label">Signal condition</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="ui-field-label">Operator</span>
                <select
                  value={rule.op}
                  onChange={(e) =>
                    setRule((prev) => ({
                      ...prev,
                      op: e.target.value as IndicatorRuleOp,
                    }))
                  }
                  className="ui-input mt-1"
                >
                  {RULE_OPS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="ui-field-label">Compare to</span>
                <select
                  value={rule.compareTo}
                  onChange={(e) =>
                    setRule((prev) => ({
                      ...prev,
                      compareTo: e.target.value as "value" | "series",
                    }))
                  }
                  className="ui-input mt-1"
                >
                  <option value="value">Fixed value</option>
                  <option value="series">Series / line</option>
                </select>
              </label>

              {rule.compareTo === "value" ? (
                <label className="block text-sm sm:col-span-2">
                  <span className="ui-field-label">Value</span>
                  <input
                    type="number"
                    value={rule.value ?? 0}
                    step={0.01}
                    onChange={(e) =>
                      setRule((prev) => ({
                        ...prev,
                        value: Number(e.target.value),
                      }))
                    }
                    className="ui-input mt-1"
                  />
                </label>
              ) : (
                <label className="block text-sm sm:col-span-2">
                  <span className="ui-field-label">Series</span>
                  <select
                    value={rule.seriesRef ?? "close"}
                    onChange={(e) =>
                      setRule((prev) => ({
                        ...prev,
                        seriesRef: e.target.value,
                      }))
                    }
                    className="ui-input mt-1"
                  >
                    {compareOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="ui-btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(params, rule)}
            className="ui-btn-primary"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function buildCompareOptions(
  def: IndicatorDefinition,
): { value: string; label: string }[] {
  const options = [
    { value: "close", label: "Close price" },
    { value: "open", label: "Open price" },
    { value: "high", label: "High price" },
    { value: "low", label: "Low price" },
  ];

  for (const output of def.outputs) {
    options.push({
      value: output,
      label: output.replaceAll("_", " "),
    });
  }

  return options;
}
