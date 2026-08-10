"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { POPULAR_STRATEGY_IDS } from "@/lib/patterns/strategy-ui";
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

function matchesQuery(preset: StrategyPreset, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    preset.pattern.name.toLowerCase().includes(needle) ||
    preset.category.toLowerCase().includes(needle) ||
    preset.entryLogic.toLowerCase().includes(needle)
  );
}

export function StrategyPicker({
  selectedId,
  customStrategies = [],
  modifiedPresetIds = [],
  onSelect,
}: StrategyPickerProps) {
  const [open, setOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const allPresets = useMemo(
    () => [...STRATEGY_PRESETS, ...customStrategies],
    [customStrategies],
  );

  const selected = allPresets.find((s) => s.id === selectedId);

  const popularPresets = useMemo(
    () =>
      POPULAR_STRATEGY_IDS.map((id) =>
        allPresets.find((p) => p.id === id),
      ).filter((p): p is StrategyPreset => p != null),
    [allPresets],
  );

  const searching = query.trim().length > 0;

  const filteredBuiltIn = useMemo(
    () => STRATEGY_PRESETS.filter((p) => matchesQuery(p, query)),
    [query],
  );

  const filteredCustom = useMemo(
    () => customStrategies.filter((p) => matchesQuery(p, query)),
    [customStrategies, query],
  );

  const flatResults = useMemo(
    () => allPresets.filter((p) => matchesQuery(p, query)),
    [allPresets, query],
  );

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSelect = (preset: StrategyPreset) => {
    onSelect(preset);
    setOpen(false);
    setQuery("");
  };

  const toggleOpen = () => {
    setOpen((v) => {
      if (v) setQuery("");
      return !v;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <h3 className="ui-section-title">1. Select strategy</h3>
        <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[10px] font-semibold text-brand-dark">
          {allPresets.length} strategies
        </span>
      </div>

      <label className="ui-field-label mt-4 block">Strategy</label>
      <div ref={rootRef} className="relative mt-1.5">
        <button
          type="button"
          onClick={toggleOpen}
          className="ui-input flex items-center justify-between gap-2 py-2.5 text-left transition hover:border-brand/50"
        >
          <span className="truncate font-medium text-ink">
            {selected ? (
              <>
                {selected.pattern.name}
                {modifiedPresetIds.includes(selected.id) ? " *" : ""}
              </>
            ) : (
              <span className="text-muted">Choose a strategy…</span>
            )}
          </span>
          <ChevronIcon open={open} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-border bg-surface">
            <div className="border-b border-border p-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search strategies…"
                className="ui-input"
                autoFocus
              />
            </div>

            <div className="max-h-[11.5rem] overflow-y-auto p-1">
              {searching ? (
                <>
                  {flatResults.map((preset) => (
                    <StrategyOption
                      key={preset.id}
                      preset={preset}
                      selected={preset.id === selectedId}
                      modified={modifiedPresetIds.includes(preset.id)}
                      onSelect={() => handleSelect(preset)}
                    />
                  ))}
                  {flatResults.length === 0 && (
                    <p className="px-3 py-4 text-center text-sm text-muted">
                      No strategies match your search.
                    </p>
                  )}
                </>
              ) : (
                <>
                  {filteredBuiltIn.map((preset) => (
                    <StrategyOption
                      key={preset.id}
                      preset={preset}
                      selected={preset.id === selectedId}
                      modified={modifiedPresetIds.includes(preset.id)}
                      onSelect={() => handleSelect(preset)}
                    />
                  ))}
                  {filteredCustom.length > 0 && (
                    <>
                      <p className="ui-field-label sticky top-0 bg-surface px-2 py-1.5">
                        Custom strategies
                      </p>
                      {filteredCustom.map((preset) => (
                        <StrategyOption
                          key={preset.id}
                          preset={preset}
                          selected={preset.id === selectedId}
                          modified={modifiedPresetIds.includes(preset.id)}
                          onSelect={() => handleSelect(preset)}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="ui-field-label">Popular strategies</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {popularPresets.map((preset) => {
            const isActive = preset.id === selectedId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelect(preset)}
                className={`ui-stat text-left transition ${
                  isActive
                    ? "border-brand bg-brand/5"
                    : "hover:border-brand/40"
                }`}
              >
                <div className="ui-field-label">{preset.category}</div>
                <div
                  className={`mt-1 text-sm font-semibold leading-tight ${
                    isActive ? "text-brand-dark" : "text-ink"
                  }`}
                >
                  {preset.pattern.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setLibraryOpen(true)}
        className="ui-btn-primary mt-4 w-full py-3"
      >
        View all strategies
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

function StrategyOption({
  preset,
  selected,
  modified,
  onSelect,
}: {
  preset: StrategyPreset;
  selected: boolean;
  modified: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg px-2 py-2 text-left text-sm transition ${
        selected
          ? "bg-brand/10 font-medium text-ink"
          : "text-ink hover:bg-bg"
      }`}
    >
      <span className="block truncate">
        {preset.pattern.name}
        {modified ? " *" : ""}
      </span>
    </button>
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
