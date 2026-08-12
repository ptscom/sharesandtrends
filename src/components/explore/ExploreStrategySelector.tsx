"use client";

import { useState, type MouseEvent } from "react";
import { StrategyLibraryModal } from "@/components/explore/StrategyLibraryModal";
import type { StrategyPreset } from "@/lib/patterns/strategies";
import {
  LIBRARY_FILTERS,
  categoryStyle,
  type LibraryFilterId,
} from "@/lib/patterns/strategy-ui";

interface ExploreStrategySelectorProps {
  presets: StrategyPreset[];
  allPresets: StrategyPreset[];
  selectedId: string;
  modifiedPresetIds: string[];
  query: string;
  categoryFilter: LibraryFilterId;
  onQueryChange: (query: string) => void;
  onCategoryChange: (filter: LibraryFilterId) => void;
  onSelect: (preset: StrategyPreset) => void;
  onOpenSettings: (id: string, e: MouseEvent) => void;
}

export function ExploreStrategySelector({
  presets,
  allPresets,
  selectedId,
  modifiedPresetIds,
  query,
  categoryFilter,
  onQueryChange,
  onCategoryChange,
  onSelect,
  onOpenSettings,
}: ExploreStrategySelectorProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);

  return (
    <section className="ui-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Step 2</p>
          <h2 className="ui-section-title mt-2">Select strategy</h2>
          <p className="ui-helper mt-1">
            Choose one strategy. Use the settings icon to tune parameters before
            scanning.
          </p>
        </div>
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {presets.map((preset) => {
          const style = categoryStyle(preset.category);
          const isSelected = preset.id === selectedId;
          const modified = modifiedPresetIds.includes(preset.id);

          return (
            <div
              key={preset.id}
              className={`rounded-xl border p-3 transition ${
                isSelected
                  ? "border-brand bg-brand/5"
                  : "border-border hover:border-brand/40 hover:bg-bg"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => onSelect(preset)}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    isSelected
                      ? "border-brand bg-brand"
                      : "border-border bg-surface"
                  }`}
                  aria-label={`Select ${preset.pattern.name}`}
                >
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onSelect(preset)}
                    className="w-full text-left"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-medium text-ink leading-snug">
                        {preset.pattern.name}
                        {modified ? " *" : ""}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${style.bg} ${style.text}`}
                      >
                        {preset.category}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted line-clamp-2">
                      {preset.entryLogic}
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={(e) => onOpenSettings(preset.id, e)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-body transition hover:border-brand hover:text-brand-text"
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

      <button
        type="button"
        onClick={() => setLibraryOpen(true)}
        className="ui-btn-secondary mt-4"
      >
        Browse strategy library
      </button>

      <StrategyLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        allPresets={allPresets}
        selectedId={selectedId}
        modifiedPresetIds={modifiedPresetIds}
        onSelect={(preset) => {
          onSelect(preset);
          setLibraryOpen(false);
        }}
      />
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
