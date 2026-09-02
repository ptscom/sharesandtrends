"use client";

import type { MouseEvent } from "react";
import {
  EXPLORATION_FILTERS,
  EXPLORATION_PRESETS,
  explorationCategoryStyle,
  type ExplorationFilterId,
} from "@/lib/explore/exploration-presets";
import {
  describeExplorationFilter,
  describePreset,
} from "@/lib/explore/exploration-to-pattern";
import type { ExplorationFilter, SavedExploration } from "@/lib/explore/exploration-models";
import { describeBuilderState } from "@/lib/explore/exploration-to-pattern";

interface ExploreExplorationSelectorProps {
  filter: ExplorationFilter | null;
  selectedPresetId: string | null;
  savedExplorations: SavedExploration[];
  query: string;
  categoryFilter: ExplorationFilterId;
  onQueryChange: (query: string) => void;
  onCategoryChange: (filter: ExplorationFilterId) => void;
  onSelectPreset: (presetId: string) => void;
  onSelectSaved: (savedId: string) => void;
  onDeleteSaved: (savedId: string) => void;
  onOpenPresetSettings: (presetId: string, e: MouseEvent) => void;
  onOpenBuilder: () => void;
  onEditBuilder: () => void;
}

export function ExploreExplorationSelector({
  filter,
  selectedPresetId,
  savedExplorations,
  query,
  categoryFilter,
  onQueryChange,
  onCategoryChange,
  onSelectPreset,
  onSelectSaved,
  onDeleteSaved,
  onOpenPresetSettings,
  onOpenBuilder,
  onEditBuilder,
}: ExploreExplorationSelectorProps) {
  const q = query.trim().toLowerCase();
  const presets = EXPLORATION_PRESETS.filter((preset) => {
    if (categoryFilter === "custom") return false;
    if (categoryFilter !== "all" && preset.category !== categoryFilter) {
      return false;
    }
    if (!q) return true;
    return (
      preset.name.toLowerCase().includes(q) ||
      preset.description.toLowerCase().includes(q) ||
      preset.category.toLowerCase().includes(q)
    );
  });

  const saved = savedExplorations.filter((item) => {
    if (
      categoryFilter !== "all" &&
      categoryFilter !== "custom"
    ) {
      return false;
    }
    if (!q) return true;
    const preview = describeBuilderState(item.builder).toLowerCase();
    return (
      item.name.toLowerCase().includes(q) || preview.includes(q)
    );
  });

  const activeDescription = filter ? describeExplorationFilter(filter) : null;
  const isCustom = filter?.source === "builder";
  const isSavedCustom = Boolean(filter?.savedId);

  return (
    <section className="ui-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Step 2</p>
          <h2 className="ui-section-title mt-2">Build exploration filter</h2>
          <p className="ui-helper mt-1">
            Pick a preset exploration or build a custom filter. One filter scans
            the universe and returns a single results table.
          </p>
        </div>
        <button
          type="button"
          onClick={isCustom ? onEditBuilder : onOpenBuilder}
          className="ui-btn-secondary flex items-center gap-2"
        >
          <BuilderIcon />
          {isCustom ? "Edit custom filter" : "Build custom"}
        </button>
      </div>

      {filter && (
        <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <p className="text-sm font-medium text-ink">Active filter</p>
          <p className="mt-1 font-semibold text-brand-text">{filter.name}</p>
          <p className="mt-0.5 text-sm text-muted">{activeDescription}</p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search explorations…"
          className="ui-input flex-1"
        />
        <select
          value={categoryFilter}
          onChange={(e) =>
            onCategoryChange(e.target.value as ExplorationFilterId)
          }
          className="ui-input w-full sm:w-48"
        >
          {EXPLORATION_FILTERS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {saved.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            My explorations
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((item) => {
              const isSelected =
                isSavedCustom && filter?.savedId === item.id;
              const preview = describeBuilderState(item.builder);
              const style = explorationCategoryStyle("Custom");

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 transition ${
                    isSelected
                      ? "border-brand bg-brand/5"
                      : "border-border hover:border-brand/40 hover:bg-bg"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectSaved(item.id)}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? "border-brand bg-brand"
                          : "border-border bg-surface"
                      }`}
                      aria-label={`Select ${item.name}`}
                    >
                      {isSelected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onSelectSaved(item.id)}
                        className="text-left"
                      >
                        <p className="font-medium text-ink">{item.name}</p>
                        <p className="mt-0.5 text-xs text-muted line-clamp-2">
                          {preview}
                        </p>
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                          />
                          Custom
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSaved(item.id);
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:border-danger hover:text-danger"
                      aria-label={`Delete ${item.name}`}
                      title="Remove from my explorations"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {categoryFilter !== "custom" && (
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {presets.map((preset) => {
          const style = explorationCategoryStyle(preset.category);
          const isSelected =
            !isCustom &&
            selectedPresetId === preset.id &&
            filter !== null;
          const preview = describePreset(
            preset,
            filter?.source === "preset" && filter.presetId === preset.id
              ? (filter.params ?? {})
              : Object.fromEntries(
                  preset.params.map((p) => [p.key, p.default]),
                ),
          );

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
                  onClick={() => onSelectPreset(preset.id)}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    isSelected
                      ? "border-brand bg-brand"
                      : "border-border bg-surface"
                  }`}
                  aria-label={`Select ${preset.name}`}
                >
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onSelectPreset(preset.id)}
                    className="text-left"
                  >
                    <p className="font-medium text-ink">{preset.name}</p>
                    <p className="mt-0.5 text-xs text-muted line-clamp-2">
                      {preset.description}
                    </p>
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {preset.category}
                    </span>
                    <span className="text-[11px] text-muted">{preview}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => onOpenPresetSettings(preset.id, e)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:border-brand hover:text-ink"
                  aria-label={`Configure ${preset.name}`}
                  title="Configure parameters"
                >
                  ⚙
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {presets.length === 0 && saved.length === 0 && (
        <p className="ui-helper mt-4 rounded-xl border border-border-subtle px-4 py-8 text-center">
          No explorations match your search.
        </p>
      )}
    </section>
  );
}

function BuilderIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M2 4h12M4 8h8M6 12h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
