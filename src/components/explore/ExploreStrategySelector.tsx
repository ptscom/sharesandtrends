"use client";

import type { MouseEvent } from "react";
import { ExploreCategoryTabs } from "@/components/explore/ExploreCategoryTabs";
import {
  explorationCategoryStyle,
  type ExplorationCategoryId,
} from "@/lib/explore/exploration-presets";
import type { StrategyPreset } from "@/lib/patterns/strategies";

interface ExploreStrategySelectorProps {
  presets: StrategyPreset[];
  selectedId: string;
  modifiedPresetIds: string[];
  query: string;
  categoryFilter: ExplorationCategoryId;
  onQueryChange: (query: string) => void;
  onCategoryChange: (filter: ExplorationCategoryId) => void;
  onSelect: (preset: StrategyPreset) => void;
  onOpenSettings: (id: string, e: MouseEvent) => void;
}

export function ExploreStrategySelector({
  presets,
  selectedId,
  modifiedPresetIds,
  query,
  categoryFilter,
  onQueryChange,
  onCategoryChange,
  onSelect,
  onOpenSettings,
}: ExploreStrategySelectorProps) {
  const q = query.trim().toLowerCase();

  const visiblePresets = presets.filter((preset) => {
    if (categoryFilter === "custom") return preset.category === "Custom";
    if (categoryFilter === "favorites") return false;
    if (
      categoryFilter !== "all" &&
      categoryFilter !== "Candlesticks" &&
      preset.category !== categoryFilter
    ) {
      return false;
    }
    if (categoryFilter === "Candlesticks") return false;
    if (!q) return true;
    return (
      preset.pattern.name.toLowerCase().includes(q) ||
      preset.category.toLowerCase().includes(q) ||
      preset.entryLogic.toLowerCase().includes(q) ||
      preset.defaultParams.toLowerCase().includes(q)
    );
  });

  const showCategoryBadge =
    categoryFilter === "all" ||
    categoryFilter === "custom" ||
    categoryFilter === "favorites";

  return (
    <section className="ui-panel p-6">
      <ExploreCategoryTabs
        category={categoryFilter}
        onChange={onCategoryChange}
      />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Step 2</p>
          <h2 className="ui-section-title mt-2">Select strategy</h2>
          <p className="ui-helper mt-1">
            Same catalog as indicator exploration. Configure entry, signal exit,
            and time exit before scanning.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search strategies…"
          className="ui-input w-full"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visiblePresets.map((preset) => {
          const style = explorationCategoryStyle(preset.category);
          const isSelected = preset.id === selectedId;
          const modified = modifiedPresetIds.includes(preset.id);
          const exitSummary = preset.pattern.exit
            ? preset.exitLogic !== "Not configured"
              ? preset.exitLogic
              : "Signal exit configured"
            : "Time exit only";

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
                    <p className="font-medium text-ink leading-snug">
                      {preset.pattern.name}
                      {modified ? " *" : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted line-clamp-2">
                      {preset.entryLogic}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {showCategoryBadge && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {preset.category}
                        </span>
                      )}
                      <span className="text-[11px] text-muted">
                        {preset.defaultParams}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted line-clamp-1">
                      Exit: {exitSummary}
                    </p>
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

      {categoryFilter === "Candlesticks" ? (
        <p className="py-8 text-center text-sm text-muted">
          Candlestick strategies are not in the strategy catalog yet.
        </p>
      ) : visiblePresets.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          No strategies match your search.
        </p>
      ) : null}
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
