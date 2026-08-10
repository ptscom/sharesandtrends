"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  POPULAR_STRATEGY_IDS,
  categoryStyle,
  loadRecentStrategyIds,
  paramTags,
  pushRecentStrategyId,
  shortStrategyName,
} from "@/lib/patterns/strategy-ui";
import {
  STRATEGY_PRESETS,
  type StrategyPreset,
} from "@/lib/patterns/strategies";
import { StrategyLibraryModal } from "@/components/explore/StrategyLibraryModal";

interface StrategyPickerProps {
  selectedId: string;
  customStrategies?: StrategyPreset[];
  modifiedPresetIds?: string[];
  onSelect: (preset: StrategyPreset) => void;
}

export function StrategyPicker({
  selectedId,
  customStrategies = [],
  modifiedPresetIds = [],
  onSelect,
}: StrategyPickerProps) {
  const [recentOpen, setRecentOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const recentRef = useRef<HTMLDivElement>(null);

  const allPresets = useMemo(
    () => [...STRATEGY_PRESETS, ...customStrategies],
    [customStrategies],
  );

  const presetById = useMemo(
    () => new Map(allPresets.map((p) => [p.id, p])),
    [allPresets],
  );

  const selected = presetById.get(selectedId);

  const popularPresets = useMemo(
    () =>
      POPULAR_STRATEGY_IDS.map((id) => presetById.get(id)).filter(
        (p): p is StrategyPreset => p != null,
      ),
    [presetById],
  );

  const recentPresets = useMemo(() => {
    const ids = [
      selectedId,
      ...recentIds.filter((id) => id !== selectedId),
    ].slice(0, 5);
    return ids
      .map((id) => presetById.get(id))
      .filter((p): p is StrategyPreset => p != null);
  }, [recentIds, selectedId, presetById]);

  useEffect(() => {
    setRecentIds(loadRecentStrategyIds());
  }, []);

  useEffect(() => {
    if (!recentOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (recentRef.current && !recentRef.current.contains(e.target as Node)) {
        setRecentOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [recentOpen]);

  const handleSelect = (preset: StrategyPreset) => {
    setRecentIds(pushRecentStrategyId(preset.id));
    onSelect(preset);
    setRecentOpen(false);
  };

  const style = categoryStyle(selected?.category ?? "Trend");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <h3 className="ui-section-title">1. Select strategy</h3>
        <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[10px] font-semibold text-brand-dark">
          {allPresets.length} strategies
        </span>
      </div>

      {/* Quick switch dropdown (recents) */}
      <label className="ui-field-label mt-4 block">Strategy</label>
      <div ref={recentRef} className="relative mt-1.5">
        <button
          type="button"
          onClick={() => setRecentOpen((v) => !v)}
          className="ui-input flex items-center gap-3 py-2.5 text-left transition hover:border-brand/50"
        >
          {selected ? (
            <>
              <StrategyIcon category={selected.category} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">
                  {selected.pattern.name}
                  {modifiedPresetIds.includes(selected.id) ? " *" : ""}
                </span>
              </span>
            </>
          ) : (
            <span className="text-muted">Choose a strategy…</span>
          )}
          <ChevronIcon open={recentOpen} />
        </button>

        {recentOpen && (
          <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-border bg-surface">
            <p className="ui-field-label border-b border-border px-3 py-2">
              Recent
            </p>
            <div className="max-h-48 overflow-y-auto p-1">
              {recentPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelect(preset)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${
                    preset.id === selectedId
                      ? "bg-brand/10"
                      : "hover:bg-bg"
                  }`}
                >
                  <StrategyIcon category={preset.category} size="sm" />
                  <span className="truncate text-sm font-medium text-ink">
                    {preset.pattern.name}
                  </span>
                </button>
              ))}
              {recentPresets.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted">No recent picks yet</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected strategy card */}
      {selected && (
        <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <StrategyIcon category={selected.category} size="lg" />
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {selected.pattern.name}
                  {modifiedPresetIds.includes(selected.id) ? " *" : ""}
                </p>
                <p className="mt-0.5 text-sm text-muted">{selected.entryLogic}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {paramTags(selected).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
              <CheckIcon />
              Selected
            </span>
          </div>
        </div>
      )}

      {/* Popular strategies */}
      <div className="mt-5">
        <p className="ui-field-label">Popular strategies</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {popularPresets.map((preset) => {
            const isActive = preset.id === selectedId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelect(preset)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${
                  isActive
                    ? "border-brand bg-brand/10"
                    : "border-border bg-bg hover:border-brand/40"
                }`}
              >
                <StrategyIcon category={preset.category} size="md" />
                <span className="text-xs font-medium leading-tight text-ink">
                  {shortStrategyName(preset.pattern.name)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Browse all */}
      <button
        type="button"
        onClick={() => setLibraryOpen(true)}
        className="mt-4 text-left text-sm font-medium text-brand-dark hover:underline"
      >
        Browse all strategies →
      </button>

      <StrategyLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        allPresets={allPresets}
        selectedId={selectedId}
        modifiedPresetIds={modifiedPresetIds}
        onSelect={handleSelect}
      />
    </div>
  );
}

function StrategyIcon({
  category,
  size,
}: {
  category: string;
  size: "sm" | "md" | "lg";
}) {
  const style = categoryStyle(category);
  const dim =
    size === "sm" ? "h-7 w-7" : size === "md" ? "h-8 w-8" : "h-10 w-10";
  const dot = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg ${dim} ${style.bg}`}
    >
      <span className={`rounded-full ${dot} ${style.dot}`} />
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.42 0l-3.25-3.25a1 1 0 111.42-1.42l2.54 2.54 6.54-6.54a1 1 0 011.42 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
