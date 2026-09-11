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
  includeGroups?: OptimizationVarGroup[];
  emptyMessage?: string;
}

const GROUP_LABELS: Record<OptimizationVarGroup, string> = {
  indicator: "Entry parameters",
  entry: "Entry parameters",
  signal_exit: "Signal exit",
  time_exit: "Time exit",
  backtest: "Backtest settings",
};

const GROUP_HELP: Partial<Record<OptimizationVarGroup, string>> = {
  signal_exit:
    "Exits when the signal rule fires. Whichever comes first — signal exit or time exit — closes the trade.",
  time_exit:
    "Exits after the hold period. Whichever comes first — signal exit or time exit — closes the trade.",
};

const ALL_GROUPS: OptimizationVarGroup[] = [
  "indicator",
  "entry",
  "signal_exit",
  "time_exit",
  "backtest",
];

export function OptimizationPanel({
  pattern,
  onChange,
  hideGroups = [],
  includeGroups,
  emptyMessage = "No tunable parameters for this section.",
}: OptimizationPanelProps) {
  const hidden = new Set(hideGroups);
  const included = includeGroups ? new Set(includeGroups) : null;
  const vars = extractOptimizationVars(pattern).filter((variable) => {
    if (included && !included.has(variable.group)) return false;
    if (hidden.has(variable.group)) return false;
    return true;
  });

  const grouped = ALL_GROUPS.map((group) => ({
    group,
    items: vars.filter((variable) => variable.group === group),
  })).filter((section) => section.items.length > 0);

  const mergedEntry = vars.filter(
    (variable) => variable.group === "indicator" || variable.group === "entry",
  );
  const sections = [
    ...(mergedEntry.length > 0 && (!included || included.has("indicator") || included.has("entry"))
      ? [{ group: "entry" as OptimizationVarGroup, items: mergedEntry }]
      : []),
    ...grouped.filter(
      (section) => section.group !== "indicator" && section.group !== "entry",
    ),
  ];

  if (sections.length === 0) {
    return <p className="text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.group}>
          <p className="ui-field-label">{GROUP_LABELS[section.group]}</p>
          {GROUP_HELP[section.group] && (
            <p className="mt-1 text-xs text-muted">{GROUP_HELP[section.group]}</p>
          )}
          {section.group === "signal_exit" && !pattern.exit && (
            <p className="mt-2 rounded-lg border border-dashed border-border bg-bg px-3 py-2 text-sm text-muted">
              No signal exit configured yet. Trades will exit on the time rule
              until you add a signal exit.
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {section.items.map((variable) => (
              <VarInput
                key={variable.id}
                variable={variable}
                onChange={(value) =>
                  onChange(applyOptimizationVar(pattern, variable.id, value))
                }
              />
            ))}
          </div>
        </div>
      ))}
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
