"use client";

import type { MouseEvent } from "react";
import type { StrategySweepState } from "@/lib/engine/param-sweep";
import { countParamCombos } from "@/lib/engine/param-sweep";
import type { StrategyPreset } from "@/lib/patterns/strategies";
import {
  LIBRARY_FILTERS,
  categoryStyle,
  type LibraryFilterId,
} from "@/lib/patterns/strategy-ui";

interface StrategySelectorProps {
  presets: StrategyPreset[];
  selectedIds: string[];
  strategyConfigs: Record<string, StrategySweepState>;
  query: string;
  categoryFilter: LibraryFilterId;
  onQueryChange: (query: string) => void;
  onCategoryChange: (filter: LibraryFilterId) => void;
  onToggle: (id: string) => void;
  onOpenSettings: (id: string, e: MouseEvent) => void;
}

export function StrategySelector({
  presets,
  selectedIds,
  strategyConfigs,
  query,
  categoryFilter,
  onQueryChange,
  onCategoryChange,
  onToggle,
  onOpenSettings,
}: StrategySelectorProps) {
  return (
    <section className="ui-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Step 2</p>
          <h2 className="ui-section-title mt-2">Select strategies</h2>
          <p className="ui-helper mt-1">
            Choose strategies and use the settings icon to configure parameters
            and sweeps.
          </p>
        </div>
        <span className="ui-badge bg-brand-light text-brand-text">
          {selectedIds.length} selected
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search strategies…"
          className="ui-input flex-1"
        />
        <select
          value={categoryFilter}
          onChange={(e) =>
            onCategoryChange(e.target.value as LibraryFilterId)
          }
          className="ui-input w-full sm:w-48"
        >
          {LIBRARY_FILTERS.map((filter) => (
            <option key={filter.id} value={filter.id}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {presets.map((preset) => {
          const style = categoryStyle(preset.category);
          const checked = selectedIds.includes(preset.id);
          const comboCount = strategyConfigs[preset.id]
            ? countParamCombos(strategyConfigs[preset.id].vars)
            : 0;

          return (
            <div
              key={preset.id}
              className={`rounded-xl border p-4 transition ${
                checked
                  ? "border-brand bg-brand/5"
                  : "border-border hover:border-brand/40 hover:bg-bg"
              }`}
            >
              <div className="flex items-start gap-3">
                <label className="mt-1 flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(preset.id)}
                    className="h-4 w-4 rounded border-border"
                  />
                </label>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.bg}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">
                    {preset.pattern.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted line-clamp-2">
                    {preset.entryLogic}
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}
                    >
                      {preset.category}
                    </span>
                    {checked && comboCount > 0 && (
                      <span className="text-[10px] text-muted">
                        {comboCount} combo{comboCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => onOpenSettings(preset.id, e)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-body transition hover:border-brand hover:text-brand-text"
                  title={`Configure ${preset.pattern.name}`}
                  aria-label={`Configure ${preset.pattern.name}`}
                >
                  <SettingsIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {presets.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">
          No strategies match your search.
        </p>
      )}
    </section>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.286-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}
