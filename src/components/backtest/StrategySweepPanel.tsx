"use client";

import type { SweepVarConfig, StrategySweepState } from "@/lib/engine/param-sweep";
import { countParamCombos } from "@/lib/engine/param-sweep";

interface StrategySweepPanelProps {
  config: StrategySweepState;
  onChange: (config: StrategySweepState) => void;
  hideTitle?: boolean;
}

export function StrategySweepPanel({
  config,
  onChange,
  hideTitle = false,
}: StrategySweepPanelProps) {
  const comboCount = countParamCombos(config.vars);

  const updateVar = (id: string, patch: Partial<SweepVarConfig>) => {
    onChange({
      ...config,
      vars: config.vars.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    });
  };

  return (
    <div className="ui-nested-card space-y-4">
      {!hideTitle && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="ui-card-title">{config.name}</h3>
          <span className="ui-badge bg-brand-light text-brand-text">
            {comboCount} combo{comboCount === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {hideTitle && (
        <div className="flex justify-end">
          <span className="ui-badge bg-brand-light text-brand-text">
            {comboCount} combo{comboCount === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="space-y-3">
        {config.vars.map((v) => (
          <VarRow key={v.id} variable={v} onChange={(patch) => updateVar(v.id, patch)} />
        ))}
      </div>
    </div>
  );
}

function VarRow({
  variable,
  onChange,
}: {
  variable: SweepVarConfig;
  onChange: (patch: Partial<SweepVarConfig>) => void;
}) {
  const canSweep = variable.type !== "enum";

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={variable.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          <span className="font-medium text-ink">{variable.label}</span>
        </label>

        {variable.enabled && canSweep && (
          <label className="flex items-center gap-2 text-xs text-body">
            <input
              type="checkbox"
              checked={variable.sweep}
              onChange={(e) => onChange({ sweep: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-border"
            />
            Sweep range
          </label>
        )}
      </div>

      {variable.enabled && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {variable.type === "enum" && variable.options ? (
            <label className="block sm:col-span-2">
              <span className="ui-field-label">Value</span>
              <select
                value={String(variable.value)}
                onChange={(e) => onChange({ value: e.target.value })}
                className="ui-input mt-1"
              >
                {variable.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          ) : variable.sweep ? (
            <>
              <label className="block">
                <span className="ui-field-label">Min</span>
                <input
                  type="number"
                  value={variable.min}
                  step={variable.step}
                  onChange={(e) =>
                    onChange({ min: Number(e.target.value) })
                  }
                  className="ui-input mt-1"
                />
              </label>
              <label className="block">
                <span className="ui-field-label">Max</span>
                <input
                  type="number"
                  value={variable.max}
                  step={variable.step}
                  onChange={(e) =>
                    onChange({ max: Number(e.target.value) })
                  }
                  className="ui-input mt-1"
                />
              </label>
              <label className="block">
                <span className="ui-field-label">Step</span>
                <input
                  type="number"
                  value={variable.step}
                  min={variable.type === "int" ? 1 : 0.01}
                  step={variable.type === "int" ? 1 : 0.01}
                  onChange={(e) =>
                    onChange({ step: Number(e.target.value) })
                  }
                  className="ui-input mt-1"
                />
              </label>
            </>
          ) : (
            <label className="block">
              <span className="ui-field-label">Value</span>
              <input
                type="number"
                value={Number(variable.value)}
                step={variable.step}
                onChange={(e) =>
                  onChange({
                    value:
                      variable.type === "int"
                        ? Number.parseInt(e.target.value, 10)
                        : Number(e.target.value),
                  })
                }
                className="ui-input mt-1"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
