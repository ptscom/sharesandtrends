"use client";

import type { ExplorationParamDef } from "@/lib/explore/exploration-models";

interface ExplorationParamFieldsProps {
  paramDefs: ExplorationParamDef[];
  params: Record<string, number | string>;
  onChange: (params: Record<string, number | string>) => void;
}

export function ExplorationParamFields({
  paramDefs,
  params,
  onChange,
}: ExplorationParamFieldsProps) {
  return (
    <div className="space-y-4">
      {paramDefs.map((def) => (
        <label key={def.key} className="block text-sm">
          <span className="ui-field-label">{def.label}</span>
          {def.type === "enum" ? (
            <select
              value={String(params[def.key] ?? def.default)}
              onChange={(e) =>
                onChange({ ...params, [def.key]: e.target.value })
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
              value={Number(params[def.key] ?? def.default)}
              min={def.min}
              max={def.max}
              step={def.type === "float" ? 0.1 : 1}
              onChange={(e) =>
                onChange({
                  ...params,
                  [def.key]:
                    def.type === "float"
                      ? Number(e.target.value)
                      : Number.parseInt(e.target.value, 10),
                })
              }
              className="ui-input mt-1"
            />
          )}
        </label>
      ))}
    </div>
  );
}
