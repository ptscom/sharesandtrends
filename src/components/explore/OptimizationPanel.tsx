"use client";

import {
  applyOptimizationVar,
  extractOptimizationVars,
  type OptimizationVar,
  type OptimizationVarGroup,
} from "@/lib/patterns/optimization";
import type { PatternDefinition } from "@/lib/types";

interface OptimizationPanelProps {
  pattern: PatternDefinition;
  onChange: (pattern: PatternDefinition) => void;
  hideGroups?: OptimizationVarGroup[];
}

const GROUP_LABELS: Record<OptimizationVarGroup, string> = {
  indicator: "Indicator parameters",
  threshold: "Signal thresholds",
  backtest: "Backtest settings",
};

export function OptimizationPanel({
  pattern,
  onChange,
  hideGroups = [],
}: OptimizationPanelProps) {
  const hidden = new Set(hideGroups);
  const vars = extractOptimizationVars(pattern);
  const grouped = vars.reduce<Record<OptimizationVarGroup, OptimizationVar[]>>(
    (acc, v) => {
      acc[v.group].push(v);
      return acc;
    },
    { indicator: [], threshold: [], backtest: [] },
  );

  if (vars.length === 0) {
    return (
      <p className="text-sm text-muted">No tunable parameters for this strategy.</p>
    );
  }

  return (
    <div className="space-y-6">
      {(Object.keys(grouped) as OptimizationVarGroup[]).map((group) => {
        if (hidden.has(group)) return null;
        const items = grouped[group];
        if (items.length === 0) return null;
        return (
          <div key={group}>
            <p className="ui-field-label">
              {GROUP_LABELS[group]}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {items.map((v) => (
                <VarInput
                  key={v.id}
                  variable={v}
                  onChange={(value) =>
                    onChange(applyOptimizationVar(pattern, v.id, value))
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VarInput({
  variable,
  onChange,
}: {
  variable: OptimizationVar;
  onChange: (value: number | string) => void;
}) {
  const inputClass = "ui-input mt-1";

  if (variable.type === "enum" && variable.options) {
    return (
      <label className="block text-sm">
        <span className="ui-field-label">{variable.label}</span>
        <select
          value={String(variable.value)}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {variable.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="block text-sm">
      <span className="ui-field-label">{variable.label}</span>
      <input
        type="number"
        value={Number(variable.value)}
        min={variable.min}
        max={variable.max}
        step={variable.step ?? (variable.type === "float" ? 0.01 : 1)}
        onChange={(e) =>
          onChange(
            variable.type === "float"
              ? Number(e.target.value)
              : Number.parseInt(e.target.value, 10),
          )
        }
        className={inputClass}
      />
    </label>
  );
}
