"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

const CATEGORY_STYLES: Record<string, { bg: string; text: string; dot: string }> =
  {
    Trend: { bg: "bg-accent/15", text: "text-accent", dot: "bg-accent" },
    Momentum: { bg: "bg-info/15", text: "text-info", dot: "bg-info" },
    Breakout: { bg: "bg-brand/15", text: "text-brand-dark", dot: "bg-brand" },
    "Mean Reversion": {
      bg: "bg-success/15",
      text: "text-success",
      dot: "bg-success",
    },
    Candlestick: { bg: "bg-danger/15", text: "text-danger", dot: "bg-danger" },
    Custom: { bg: "bg-muted/15", text: "text-muted", dot: "bg-muted" },
  };

function categoryStyle(category: string) {
  return (
    CATEGORY_STYLES[category] ?? {
      bg: "bg-accent/15",
      text: "text-accent",
      dot: "bg-accent",
    }
  );
}

export function StrategyPicker({
  selectedId,
  customStrategies = [],
  modifiedPresetIds = [],
  onSelect,
}: StrategyPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showUnsupported, setShowUnsupported] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const allPresets = useMemo(
    () => [...STRATEGY_PRESETS, ...customStrategies],
    [customStrategies],
  );
  const selected = allPresets.find((s) => s.id === selectedId);

  const byCategory = useMemo(() => {
    const grouped = getStrategiesByCategory();
    if (customStrategies.length > 0) {
      grouped.Custom = customStrategies;
    }
    return grouped;
  }, [customStrategies]);

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

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
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

  const style = categoryStyle(selected?.category ?? "Trend");

  return (
    <div ref={rootRef} className="flex h-full flex-col">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
        1. Select strategy
      </p>

      <label className="mt-4 text-xs font-medium text-muted">Strategy</label>

      <div className="relative mt-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-bg px-3 py-2.5 text-left shadow-sm transition hover:border-brand/40"
        >
          {selected ? (
            <>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.bg}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {selected.pattern.name}
                  {modifiedPresetIds.includes(selected.id) ? " *" : ""}
                </span>
                <span className="block truncate text-xs text-muted">
                  {selected.category}
                </span>
              </span>
            </>
          ) : (
            <span className="text-sm text-muted">Choose a strategy…</span>
          )}
          <ChevronIcon open={open} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            <div className="border-b border-border p-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search strategies…"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm shadow-sm"
                autoFocus
              />
            </div>
            <div className="max-h-56 overflow-y-auto p-2">
              {Object.entries(filtered).map(([category, items]) => (
                <div key={category} className="mb-2 last:mb-0">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
                    {category}
                  </p>
                  {items.map((preset) => {
                    const itemStyle = categoryStyle(preset.category);
                    const isSelected = preset.id === selectedId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelect(preset)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${
                          isSelected
                            ? "bg-brand/10"
                            : "hover:bg-bg"
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${itemStyle.bg}`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${itemStyle.dot}`}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {preset.pattern.name}
                            {modifiedPresetIds.includes(preset.id) ? " *" : ""}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {preset.entryLogic}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {Object.keys(filtered).length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-muted">
                  No strategies match your search.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="mt-4 flex-1">
          <p className="text-sm leading-relaxed text-ink">
            {selected.entryLogic}
          </p>
          <p className="mt-2 text-xs text-muted">
            Params: {selected.defaultParams} · Exit: {selected.exitLogic}
          </p>
          <Link
            href={`/strategies${selected.id ? `?id=${selected.id}` : ""}`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-dark hover:underline"
          >
            View documentation
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowUnsupported((v) => !v)}
        className="mt-4 text-left text-xs text-muted underline"
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
