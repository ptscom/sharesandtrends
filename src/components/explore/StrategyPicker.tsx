"use client";

import { useMemo, useState } from "react";
import {
  STRATEGY_PRESETS,
  UNSUPPORTED_STRATEGIES,
  getStrategiesByCategory,
  type StrategyPreset,
} from "@/lib/patterns/strategies";

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
  const [query, setQuery] = useState("");
  const [showUnsupported, setShowUnsupported] = useState(false);

  const byCategory = useMemo(() => {
    const grouped = getStrategiesByCategory();
    if (customStrategies.length > 0) {
      grouped.Custom = customStrategies;
    }
    return grouped;
  }, [customStrategies]);

  const totalCount = STRATEGY_PRESETS.length + customStrategies.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byCategory;
    const out: Record<string, StrategyPreset[]> = {};
    for (const [cat, items] of Object.entries(byCategory)) {
      const hits = items.filter(
        (s) =>
          s.pattern.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.entryLogic.toLowerCase().includes(q),
      );
      if (hits.length > 0) out[cat] = hits;
    }
    return out;
  }, [byCategory, query]);

  return (
    <div>
      <label className="text-xs uppercase tracking-[0.2em] text-muted">
        Strategy library ({totalCount} available)
      </label>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search strategies…"
        className="mt-2 w-full rounded-2xl border border-border bg-bg px-4 py-2 text-sm"
      />

      <div className="mt-4 space-y-4 pr-1">
        {Object.entries(filtered).map(([category, items]) => (
          <div key={category}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              {category}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {items.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelect(preset)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    selectedId === preset.id
                      ? "border-brand bg-brand/10 text-ink shadow-sm"
                      : "border-border text-muted hover:border-brand/40 hover:bg-bg hover:text-ink"
                  }`}
                >
                  <span className="font-semibold">
                    {preset.pattern.name}
                    {modifiedPresetIds.includes(preset.id) ? " *" : ""}
                  </span>
                  <span className="mt-0.5 block text-xs opacity-80">
                    {preset.entryLogic}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowUnsupported((v) => !v)}
        className="mt-4 text-xs text-muted underline"
      >
        {showUnsupported ? "Hide" : "Show"} {UNSUPPORTED_STRATEGIES.length}{" "}
        strategies not yet supported
      </button>

      {showUnsupported && (
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {UNSUPPORTED_STRATEGIES.map((s) => (
            <li key={s.name}>
              <span className="text-ink/70">{s.name}</span> — {s.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
