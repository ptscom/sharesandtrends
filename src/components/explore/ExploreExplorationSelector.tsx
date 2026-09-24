"use client";

import type { MouseEvent, ReactNode } from "react";
import { ExploreCategoryTabs } from "@/components/explore/ExploreCategoryTabs";
import {
  EXPLORATION_PRESETS,
  explorationCategoryStyle,
  type ExplorationCategoryId,
  type ExplorationPreset,
} from "@/lib/explore/exploration-presets";
import {
  describeBuilderState,
  describeExplorationFilter,
  describePreset,
} from "@/lib/explore/exploration-to-pattern";
import {
  EXPLORATION_DESCRIPTION_MAX,
  resolveExplorationDescription,
} from "@/lib/explore/exploration-description";
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
  onCategoryChange: (category: ExplorationCategoryId) => void;
  onQueryChange: (query: string) => void;
  onTogglePreset: (presetId: string) => void;
  onToggleSaved: (savedId: string) => void;
  onToggleFavorite: (key: string) => void;
  onUpdateFilterDescription: (key: string, description: string) => void;
  onDeleteSaved: (savedId: string) => void;
  onOpenPresetSettings: (presetId: string, e: MouseEvent) => void;
  onOpenHistory: (filterKey: string, filterName: string) => void;
  onOpenBuilder: () => void;
  onEditBuilder: () => void;
}

type GridItem =
  | { type: "preset"; preset: ExplorationPreset }
  | { type: "saved"; item: SavedExploration };

export function ExploreExplorationSelector({
  selectedFilters,
  savedExplorations,
  favoriteKeys,
  query,
  categoryFilter,
  onCategoryChange,
  onQueryChange,
  onTogglePreset,
  onToggleSaved,
  onToggleFavorite,
  onUpdateFilterDescription,
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
    } else if (categoryFilter !== "all" && categoryFilter !== "custom") {
      return false;
    }
    if (!q) return true;
    const preview = describeBuilderState(item.builder).toLowerCase();
    return (
      item.name.toLowerCase().includes(q) || preview.includes(q)
    );
  });

  const gridItems: GridItem[] = [];
  if (categoryFilter === "custom") {
    for (const item of saved) gridItems.push({ type: "saved", item });
  } else if (categoryFilter === "all" || categoryFilter === "favorites") {
    for (const preset of presets) gridItems.push({ type: "preset", preset });
    for (const item of saved) gridItems.push({ type: "saved", item });
  } else if (categoryFilter !== "Candlesticks") {
    for (const preset of presets) gridItems.push({ type: "preset", preset });
  }

  const selectedList = Object.values(selectedFilters);
  const editingCustom = selectedList.find((item) => item.source === "builder");
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

      <p className="ui-eyebrow mt-4">Step 2</p>

      {selectedCount > 0 && (
        <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <p className="text-sm font-medium text-ink">
            {selectedCount} exploration{selectedCount === 1 ? "" : "s"} selected
          </p>
          <ul className="mt-2 space-y-2">
            {selectedList.map((filter) => {
              const filterKey = explorationFilterKey(filter);
              return (
              <li
                key={filterKey}
                className="flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-brand-text">{filter.name}</p>
                  <label className="mt-2 block">
                    <span className="sr-only">Description for {filter.name}</span>
                    <input
                      value={resolveExplorationDescription(filter)}
                      onChange={(e) =>
                        onUpdateFilterDescription(filterKey, e.target.value)
                      }
                      maxLength={EXPLORATION_DESCRIPTION_MAX}
                      className="ui-input w-full py-1.5 text-sm"
                      placeholder="Short description for snapshot"
                    />
                  </label>
                  <p className="mt-1 text-xs text-muted">
                    {describeExplorationFilter(filter)}
                  </p>
                </div>
                <HistoryButton
                  label={`View past runs for ${filter.name}`}
                  onClick={() => onOpenHistory(filterKey, filter.name)}
                />
              </li>
            );
            })}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search explorations…"
          className="ui-input min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={editingCustom ? onEditBuilder : onOpenBuilder}
          className="ui-btn-secondary flex shrink-0 items-center justify-center gap-2 sm:w-auto"
        >
          <BuilderIcon />
          {editingCustom ? "Edit custom" : "Build custom"}
        </button>
      </div>

      {gridItems.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gridItems.map((entry) =>
            entry.type === "preset"
              ? (
                  <PresetCard
                    key={entry.preset.id}
                    preset={entry.preset}
                    showCategoryBadge={showCategoryBadge}
                    selectedFilters={selectedFilters}
                    favoriteKeys={favoriteKeys}
                    onTogglePreset={onTogglePreset}
                    onToggleFavorite={onToggleFavorite}
                    onOpenHistory={onOpenHistory}
                    onOpenPresetSettings={onOpenPresetSettings}
                  />
                )
              : (
                  <SavedCard
                    key={entry.item.id}
                    item={entry.item}
                    showCategoryBadge={showCategoryBadge}
                    selectedFilters={selectedFilters}
                    favoriteKeys={favoriteKeys}
                    onToggleSaved={onToggleSaved}
                    onToggleFavorite={onToggleFavorite}
                    onDeleteSaved={onDeleteSaved}
                    onOpenHistory={onOpenHistory}
                  />
                ),
          )}
        </div>
      )}

      {gridItems.length === 0 && (
        <p className="ui-helper mt-4 rounded-xl border border-border-subtle px-4 py-8 text-center">
          {categoryFilter === "Candlesticks"
            ? "Candlestick explorations are coming soon."
            : categoryFilter === "favorites"
              ? "Star explorations to add them to your favorites."
              : categoryFilter === "custom"
                ? "No custom explorations yet. Use Build custom to create one."
                : "No explorations match your search."}
        </p>
      )}
    </section>
  );
}

function PresetCard({
  preset,
  showCategoryBadge,
  selectedFilters,
  favoriteKeys,
  onTogglePreset,
  onToggleFavorite,
  onOpenHistory,
  onOpenPresetSettings,
}: {
  preset: ExplorationPreset;
  showCategoryBadge: boolean;
  selectedFilters: Record<string, ExplorationFilter>;
  favoriteKeys: Set<string>;
  onTogglePreset: (presetId: string) => void;
  onToggleFavorite: (key: string) => void;
  onOpenHistory: (filterKey: string, filterName: string) => void;
  onOpenPresetSettings: (presetId: string, e: MouseEvent) => void;
}) {
  const filterKey = presetFilterKey(preset.id);
  const favoriteKey = presetFavoriteKey(preset.id);
  const isSelected = Boolean(selectedFilters[filterKey]);
  const isFavorite = favoriteKeys.has(favoriteKey);
  const style = explorationCategoryStyle(preset.category);
  const selectedFilter = selectedFilters[filterKey];
  const preview = describePreset(
    preset,
    selectedFilter?.source === "preset" && selectedFilter.presetId === preset.id
      ? (selectedFilter.params ?? {})
      : Object.fromEntries(preset.params.map((p) => [p.key, p.default])),
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onTogglePreset(preset.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTogglePreset(preset.id);
        }
      }}
      className={`rounded-xl border p-3 transition cursor-pointer ${
        isSelected
          ? "border-brand bg-brand/5"
          : "border-border hover:border-brand/40 hover:bg-bg"
      }`}
      aria-pressed={isSelected}
      aria-label={`${isSelected ? "Deselect" : "Select"} ${preset.name}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{preset.name}</p>
          <p className="mt-0.5 text-xs text-muted line-clamp-2">
            {preset.description}
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
            <span className="text-[11px] text-muted">{preview}</span>
          </div>
        </div>
        <div
          className="flex shrink-0 flex-col gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <FavoriteButton
            active={isFavorite}
            label={`${isFavorite ? "Remove" : "Add"} ${preset.name} from favorites`}
            onClick={() => onToggleFavorite(favoriteKey)}
          />
          <HistoryButton
            label={`Past runs for ${preset.name}`}
            onClick={() => onOpenHistory(presetFilterKey(preset.id), preset.name)}
          />
          <CardIconButton
            label={`Configure ${preset.name}`}
            title="Configure parameters"
            onClick={(e) => onOpenPresetSettings(preset.id, e)}
          >
            <SettingsIcon />
          </CardIconButton>
        </div>
      </div>
    </div>
  );
}

function SavedCard({
  item,
  showCategoryBadge,
  selectedFilters,
  favoriteKeys,
  onToggleSaved,
  onToggleFavorite,
  onDeleteSaved,
  onOpenHistory,
}: {
  item: SavedExploration;
  showCategoryBadge: boolean;
  selectedFilters: Record<string, ExplorationFilter>;
  favoriteKeys: Set<string>;
  onToggleSaved: (savedId: string) => void;
  onToggleFavorite: (key: string) => void;
  onDeleteSaved: (savedId: string) => void;
  onOpenHistory: (filterKey: string, filterName: string) => void;
}) {
  const filterKey = savedFilterKey(item.id);
  const favoriteKey = savedFavoriteKey(item.id);
  const isSelected = Boolean(selectedFilters[filterKey]);
  const isFavorite = favoriteKeys.has(favoriteKey);
  const preview = describeBuilderState(item.builder);
  const style = explorationCategoryStyle("Custom");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggleSaved(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleSaved(item.id);
        }
      }}
      className={`rounded-xl border p-3 transition cursor-pointer ${
        isSelected
          ? "border-brand bg-brand/5"
          : "border-border hover:border-brand/40 hover:bg-bg"
      }`}
      aria-pressed={isSelected}
      aria-label={`${isSelected ? "Deselect" : "Select"} ${item.name}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{item.name}</p>
          <p className="mt-0.5 text-xs text-muted line-clamp-2">{preview}</p>
          {showCategoryBadge && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                Custom
              </span>
            </div>
          )}
        </div>
        <div
          className="flex shrink-0 flex-col gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <FavoriteButton
            active={isFavorite}
            label={`${isFavorite ? "Remove" : "Add"} ${item.name} from favorites`}
            onClick={() => onToggleFavorite(favoriteKey)}
          />
          <HistoryButton
            label={`Past runs for ${item.name}`}
            onClick={() => onOpenHistory(savedFilterKey(item.id), item.name)}
          />
          <CardIconButton
            label={`Delete ${item.name}`}
            title="Remove from my explorations"
            onClick={() => onDeleteSaved(item.id)}
            className="hover:border-danger hover:text-danger"
          >
            <DeleteIcon />
          </CardIconButton>
        </div>
      </div>
    </div>
  );
}

const cardIconButtonClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition hover:border-brand hover:text-ink";

function CardIconButton({
  label,
  title,
  onClick,
  className = "",
  children,
}: {
  label: string;
  title?: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={`${cardIconButtonClass} ${className}`}
      aria-label={label}
      title={title}
    >
      {children}
    </button>
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
    <CardIconButton
      label={label}
      title={active ? "Remove from favorites" : "Add to favorites"}
      onClick={() => onClick()}
      className={
        active
          ? "border-brand bg-brand/10 text-brand hover:border-brand hover:text-brand"
          : ""
      }
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
    </CardIconButton>
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
    <CardIconButton label={label} title="Past runs" onClick={() => onClick()}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.25" />
        <path
          d="M8 5v3.25l2 1.25"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </CardIconButton>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 1.75v1.1M7 11.15v1.1M2.25 7h1.1M10.65 7h1.1M3.7 3.7l.78.78M9.52 9.52l.78.78M3.7 10.3l.78-.78M9.52 4.48l.78-.78"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <circle cx="7" cy="7" r="2.1" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3.5 3.5 10.5 10.5M10.5 3.5 3.5 10.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
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
