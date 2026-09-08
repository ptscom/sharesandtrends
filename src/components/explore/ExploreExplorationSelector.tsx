"use client";

import type { MouseEvent } from "react";
import {
  EXPLORATION_PRESETS,
  explorationCategoryStyle,
  type ExplorationCategoryId,
} from "@/lib/explore/exploration-presets";
import {
  describeBuilderState,
  describeExplorationFilter,
  describePreset,
} from "@/lib/explore/exploration-to-pattern";
import type { ExplorationFilter, SavedExploration } from "@/lib/explore/exploration-models";
import {
  explorationFilterKey,
  presetFilterKey,
  savedFilterKey,
} from "@/lib/explore/exploration-filter-key";
import { ExplorationHistoryIcon } from "@/components/explore/ExplorationRunHistoryModal";

import {
  presetFavoriteKey,
  savedFavoriteKey,
} from "@/lib/storage/exploration-favorites";

interface ExploreExplorationSelectorProps {
  selectedFilters: Record<string, ExplorationFilter>;
  savedExplorations: SavedExploration[];
  favoriteKeys: Set<string>;
  query: string;
  categoryFilter: ExplorationCategoryId;
  onQueryChange: (query: string) => void;
  onTogglePreset: (presetId: string) => void;
  onToggleSaved: (savedId: string) => void;
  onToggleFavorite: (key: string) => void;
  onDeleteSaved: (savedId: string) => void;
  onOpenPresetSettings: (presetId: string, e: MouseEvent) => void;
  onOpenHistory: (filterKey: string, filterName: string) => void;
  onOpenBuilder: () => void;
  onEditBuilder: () => void;
}

export function ExploreExplorationSelector({
  selectedFilters,
  savedExplorations,
  favoriteKeys,
  query,
  categoryFilter,
  onQueryChange,
  onTogglePreset,
  onToggleSaved,
  onToggleFavorite,
  onDeleteSaved,
  onOpenPresetSettings,
  onOpenHistory,
  onOpenBuilder,
  onEditBuilder,
}: ExploreExplorationSelectorProps) {
  const q = query.trim().toLowerCase();
  const selectedCount = Object.keys(selectedFilters).length;
  const presets = EXPLORATION_PRESETS.filter((preset) => {
    const favoriteKey = presetFavoriteKey(preset.id);
    if (categoryFilter === "custom") return false;
    if (categoryFilter === "favorites") {
      if (!favoriteKeys.has(favoriteKey)) return false;
    } else if (
      categoryFilter !== "all" &&
      preset.category !== categoryFilter
    ) {
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
    const favoriteKey = savedFavoriteKey(item.id);
    if (categoryFilter === "favorites") {
      if (!favoriteKeys.has(favoriteKey)) return false;
    } else if (
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

  const selectedList = Object.values(selectedFilters);
  const editingCustom = selectedList.find((item) => item.source === "builder");

  return (
    <section className="ui-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Step 2</p>
          <h2 className="ui-section-title mt-2">Build exploration filter</h2>
          <p className="ui-helper mt-1">
            Select one or more explorations to run together. You&apos;ll get a
            consolidated report first, then drill into each exploration&apos;s
            symbol table.
          </p>
        </div>
        <button
          type="button"
          onClick={editingCustom ? onEditBuilder : onOpenBuilder}
          className="ui-btn-secondary flex items-center gap-2"
        >
          <BuilderIcon />
          {editingCustom ? "Edit custom filter" : "Build custom"}
        </button>
      </div>

      {selectedCount > 0 && (
        <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <p className="text-sm font-medium text-ink">
            {selectedCount} exploration{selectedCount === 1 ? "" : "s"} selected
          </p>
          <ul className="mt-2 space-y-2">
            {selectedList.map((filter) => (
              <li
                key={explorationFilterKey(filter)}
                className="flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-brand-text">{filter.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {describeExplorationFilter(filter)}
                  </p>
                </div>
                <HistoryButton
                  label={`View past runs for ${filter.name}`}
                  onClick={() =>
                    onOpenHistory(explorationFilterKey(filter), filter.name)
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search explorations…"
          className="ui-input w-full"
        />
      </div>

      {saved.length > 0 && categoryFilter !== "Candlesticks" && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            My explorations
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((item) => {
              const filterKey = savedFilterKey(item.id);
              const favoriteKey = savedFavoriteKey(item.id);
              const isSelected = Boolean(selectedFilters[filterKey]);
              const isFavorite = favoriteKeys.has(favoriteKey);
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
                      onClick={() => onToggleSaved(item.id)}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-brand bg-brand text-white"
                          : "border-border bg-surface"
                      }`}
                      aria-label={`${isSelected ? "Deselect" : "Select"} ${item.name}`}
                      aria-pressed={isSelected}
                    >
                      {isSelected && <CheckIcon />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onToggleSaved(item.id)}
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
                    <div className="flex shrink-0 flex-col gap-1">
                      <FavoriteButton
                        active={isFavorite}
                        label={`${isFavorite ? "Remove" : "Add"} ${item.name} from favorites`}
                        onClick={() => onToggleFavorite(favoriteKey)}
                      />
                      <HistoryButton
                        label={`Past runs for ${item.name}`}
                        onClick={() =>
                          onOpenHistory(savedFilterKey(item.id), item.name)
                        }
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSaved(item.id);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:border-danger hover:text-danger"
                        aria-label={`Delete ${item.name}`}
                        title="Remove from my explorations"
                      >
                        ✕
                      </button>
                    </div>
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
          const filterKey = presetFilterKey(preset.id);
          const favoriteKey = presetFavoriteKey(preset.id);
          const isSelected = Boolean(selectedFilters[filterKey]);
          const isFavorite = favoriteKeys.has(favoriteKey);
          const style = explorationCategoryStyle(preset.category);
          const selectedFilter = selectedFilters[filterKey];
          const preview = describePreset(
            preset,
            selectedFilter?.source === "preset" &&
              selectedFilter.presetId === preset.id
              ? (selectedFilter.params ?? {})
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
                  onClick={() => onTogglePreset(preset.id)}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    isSelected
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-surface"
                  }`}
                  aria-label={`${isSelected ? "Deselect" : "Select"} ${preset.name}`}
                  aria-pressed={isSelected}
                >
                  {isSelected && <CheckIcon />}
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onTogglePreset(preset.id)}
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
                <div className="flex shrink-0 flex-col gap-1">
                  <FavoriteButton
                    active={isFavorite}
                    label={`${isFavorite ? "Remove" : "Add"} ${preset.name} from favorites`}
                    onClick={() => onToggleFavorite(favoriteKey)}
                  />
                  <HistoryButton
                    label={`Past runs for ${preset.name}`}
                    onClick={() =>
                      onOpenHistory(presetFilterKey(preset.id), preset.name)
                    }
                  />
                  <button
                    type="button"
                    onClick={(e) => onOpenPresetSettings(preset.id, e)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:border-brand hover:text-ink"
                    aria-label={`Configure ${preset.name}`}
                    title="Configure parameters"
                  >
                    ⚙
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {presets.length === 0 && saved.length === 0 && (
        <p className="ui-helper mt-4 rounded-xl border border-border-subtle px-4 py-8 text-center">
          {categoryFilter === "Candlesticks"
            ? "Candlestick explorations are coming soon."
            : categoryFilter === "favorites"
              ? "Star explorations to add them to your favorites."
              : "No explorations match your search."}
        </p>
      )}
    </section>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M2 5.2 4.1 7.3 8 3.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FavoriteButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
        active
          ? "border-brand bg-brand/10 text-brand"
          : "border-border text-muted hover:border-brand hover:text-ink"
      }`}
      aria-label={label}
      title={active ? "Remove from favorites" : "Add to favorites"}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path
          d="M7 2.2 8.55 5.3 12 5.85 9.5 8.2 10.1 11.6 7 9.95 3.9 11.6 4.5 8.2 2 5.85 5.45 5.3 7 2.2Z"
          stroke="currentColor"
          strokeWidth="1.2"
          fill={active ? "currentColor" : "none"}
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function HistoryButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:border-brand hover:text-ink"
      aria-label={label}
      title="Past runs"
    >
      <ExplorationHistoryIcon />
    </button>
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
