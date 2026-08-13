"use client";

import type { MouseEvent } from "react";
import type { StrategyPreset } from "@/lib/patterns/strategies";
import {
  LIBRARY_FILTERS,
  categoryStyle,
  type LibraryFilterId,
} from "@/lib/patterns/strategy-ui";
import type { MtfSlot } from "@/lib/patterns/mtf-combine";
import type { PatternDefinition } from "@/lib/types";

export interface MtfSlotSelection {
  id: string;
  pattern: PatternDefinition;
}

interface ExploreMtfStrategySelectorProps {
  presets: StrategyPreset[];
  slots: Record<MtfSlot, MtfSlotSelection | null>;
  modifiedPresetIds: string[];
  query: string;
  categoryFilter: LibraryFilterId;
  activeSlot: MtfSlot;
  onActiveSlotChange: (slot: MtfSlot) => void;
  onQueryChange: (query: string) => void;
  onCategoryChange: (filter: LibraryFilterId) => void;
  onSelect: (slot: MtfSlot, preset: StrategyPreset) => void;
  onClearSlot: (slot: MtfSlot) => void;
  onOpenSettings: (slot: MtfSlot, id: string, e: MouseEvent) => void;
}

const SLOT_LABELS: Record<MtfSlot, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const SLOT_ORDER: MtfSlot[] = ["daily", "weekly", "monthly"];

export function ExploreMtfStrategySelector({
  presets,
  slots,
  modifiedPresetIds,
  query,
  categoryFilter,
  activeSlot,
  onActiveSlotChange,
  onQueryChange,
  onCategoryChange,
  onSelect,
  onClearSlot,
  onOpenSettings,
}: ExploreMtfStrategySelectorProps) {
  return (
    <section className="ui-panel p-6">
      <div>
        <p className="ui-eyebrow">Step 2</p>
        <h2 className="ui-section-title mt-2">Multi-timeframe strategy</h2>
        <p className="ui-helper mt-1">
          Pick a strategy for each timeframe. Buy when all selected entries align;
          sell when all exits align.
        </p>
      </div>

      <div className="mt-5 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
        {SLOT_ORDER.map((slot, index) => (
          <div key={slot} className="flex flex-1 items-center gap-3">
            {index > 0 && (
              <span
                className="hidden shrink-0 text-lg font-medium text-muted lg:block"
                aria-hidden
              >
                +
              </span>
            )}
            <MtfSlotCard
              slot={slot}
              label={SLOT_LABELS[slot]}
              selection={slots[slot]}
              optional={slot !== "daily"}
              modified={
                slots[slot] ? modifiedPresetIds.includes(slots[slot]!.id) : false
              }
              active={activeSlot === slot}
              onActivate={() => onActiveSlotChange(slot)}
              onClear={() => onClearSlot(slot)}
              onOpenSettings={(id, e) => onOpenSettings(slot, id, e)}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <p className="text-sm font-medium text-ink">
          Choose strategy for {SLOT_LABELS[activeSlot]}
          {activeSlot !== "daily" ? " (optional)" : ""}
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
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
            const isSelected = slots[activeSlot]?.id === preset.id;
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
                    onClick={() => onSelect(activeSlot, preset)}
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      isSelected
                        ? "border-brand bg-brand"
                        : "border-border bg-surface"
                    }`}
                    aria-label={`Select ${preset.pattern.name} for ${SLOT_LABELS[activeSlot]}`}
                  >
                    {isSelected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onSelect(activeSlot, preset)}
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
                    onClick={(e) => onOpenSettings(activeSlot, preset.id, e)}
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
      </div>
    </section>
  );
}

interface MtfSlotCardProps {
  slot: MtfSlot;
  label: string;
  selection: MtfSlotSelection | null;
  optional: boolean;
  modified: boolean;
  active: boolean;
  onActivate: () => void;
  onClear: () => void;
  onOpenSettings: (id: string, e: MouseEvent) => void;
}

function MtfSlotCard({
  label,
  selection,
  optional,
  modified,
  active,
  onActivate,
  onClear,
  onOpenSettings,
}: MtfSlotCardProps) {
  return (
    <button
      type="button"
      onClick={onActivate}
      className={`flex min-h-[5.5rem] w-full flex-col rounded-xl border p-3 text-left transition ${
        active
          ? "border-brand bg-brand/5 ring-1 ring-brand/30"
          : "border-border bg-surface hover:border-brand/40"
      }`}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
        {optional ? " (optional)" : ""}
      </span>
      {selection ? (
        <>
          <span className="mt-2 font-medium text-ink leading-snug">
            {selection.pattern.name}
            {modified ? " *" : ""}
          </span>
          <span className="mt-auto flex items-center justify-between pt-2">
            <span className="text-xs text-muted">Tap to change</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings(selection.id, e);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenSettings(selection.id, e as unknown as MouseEvent);
                }
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-bg text-body hover:border-brand hover:text-brand-text"
              aria-label={`Configure ${selection.pattern.name}`}
            >
              <SettingsIcon />
            </span>
          </span>
        </>
      ) : (
        <span className="mt-2 text-sm text-muted">
          {optional ? "None — tap to add" : "Select a strategy below"}
        </span>
      )}
      {optional && selection && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onClear();
            }
          }}
          className="mt-2 self-start text-xs text-muted underline hover:text-ink"
        >
          Clear
        </span>
      )}
    </button>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5"
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
