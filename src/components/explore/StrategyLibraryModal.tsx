"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LIBRARY_FILTERS,
  categoryStyle,
  type LibraryFilterId,
} from "@/lib/patterns/strategy-ui";
import type { StrategyPreset } from "@/lib/patterns/strategies";

interface StrategyLibraryModalProps {
  open: boolean;
  onClose: () => void;
  allPresets: StrategyPreset[];
  selectedId: string;
  modifiedPresetIds: string[];
  onSelect: (preset: StrategyPreset) => void;
}

export function StrategyLibraryModal({
  open,
  onClose,
  allPresets,
  selectedId,
  modifiedPresetIds,
  onSelect,
}: StrategyLibraryModalProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilterId>("all");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setFilter("all");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allPresets.filter((preset) => {
      if (filter !== "all" && preset.category !== filter) return false;
      if (!q) return true;
      return (
        preset.pattern.name.toLowerCase().includes(q) ||
        preset.category.toLowerCase().includes(q) ||
        preset.entryLogic.toLowerCase().includes(q)
      );
    });
  }, [allPresets, query, filter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        aria-label="Close strategy library"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="strategy-library-title"
        className="relative flex h-[80vh] max-h-[80vh] w-[90vw] max-w-[1200px] flex-col rounded-[18px] border border-border bg-surface"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="strategy-library-title" className="ui-page-title">
              Strategy library
            </h2>
            <p className="ui-helper mt-0.5">
              {allPresets.length} strategies available
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2.5 py-1.5 text-muted hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-border px-5 py-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search strategies…"
            className="ui-input"
            autoFocus
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {LIBRARY_FILTERS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  filter === chip.id
                    ? "border-brand bg-brand/10 text-brand-dark"
                    : "border-border text-muted hover:text-ink"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((preset) => {
              const style = categoryStyle(preset.category);
              const isSelected = preset.id === selectedId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onSelect(preset);
                    onClose();
                  }}
                  className={`rounded-xl border p-4 text-left transition ${
                    isSelected
                      ? "border-brand bg-brand/5"
                      : "border-border hover:border-brand/40 hover:bg-bg"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.bg}`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">
                        {preset.pattern.name}
                        {modifiedPresetIds.includes(preset.id) ? " *" : ""}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted line-clamp-2">
                        {preset.entryLogic}
                      </span>
                      <span
                        className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}
                      >
                        {preset.category}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="py-12 text-center text-sm text-muted">
              No strategies match your search.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <p className="ui-helper">
            Showing {filtered.length} of {allPresets.length} strategies
          </p>
          <button type="button" onClick={onClose} className="ui-btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
