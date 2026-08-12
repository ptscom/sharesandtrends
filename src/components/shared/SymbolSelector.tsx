"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_WATCHLIST,
  SYMBOL_WATCHLISTS,
} from "@/lib/data/default-universe";

const BROWSE_PAGE_SIZE = 72;
const SELECTED_PREVIEW_LIMIT = 48;

interface SymbolSelectorProps {
  selected: string[];
  storedSymbols: string[];
  useAllStored: boolean;
  onUseAllStoredChange: (value: boolean) => void;
  onChange: (symbols: string[]) => void;
  maxSymbols?: number | null;
  stepLabel?: string;
  description?: string;
}

export const SymbolSelector = memo(function SymbolSelector({
  selected,
  storedSymbols,
  useAllStored,
  onUseAllStoredChange,
  onChange,
  maxSymbols = null,
  stepLabel = "Step 1",
  description = "Choose symbols to include in the scan.",
}: SymbolSelectorProps) {
  const [search, setSearch] = useState("");
  const [browseLimit, setBrowseLimit] = useState(BROWSE_PAGE_SIZE);

  const isAllMode = useAllStored && storedSymbols.length > 0;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const limitLabel =
    maxSymbols != null
      ? `Up to ${maxSymbols} symbols.`
      : "No limit — select as many stored symbols as you need.";

  const browseSymbols = useMemo(() => {
    const q = search.trim().toUpperCase();
    const primary =
      storedSymbols.length > 0 ? storedSymbols : [...DEFAULT_WATCHLIST];
    if (!q) return primary;
    return primary.filter((symbol) => symbol.includes(q));
  }, [search, storedSymbols]);

  const visibleBrowse = useMemo(
    () => browseSymbols.slice(0, browseLimit),
    [browseSymbols, browseLimit],
  );

  const suggestions = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return [];
    const pool = [...new Set([...DEFAULT_WATCHLIST, ...storedSymbols])];
    return pool.filter((s) => s.includes(q)).slice(0, 16);
  }, [search, storedSymbols]);

  useEffect(() => {
    setBrowseLimit(BROWSE_PAGE_SIZE);
  }, [search]);

  const addSymbol = (symbol: string) => {
    const upper = symbol.trim().toUpperCase();
    if (!upper) return;
    if (isAllMode) {
      onUseAllStoredChange(false);
      onChange([upper]);
      setSearch("");
      return;
    }
    if (selectedSet.has(upper)) return;
    if (maxSymbols != null && selected.length >= maxSymbols) return;
    onChange([...selected, upper]);
    setSearch("");
  };

  const removeSymbol = (symbol: string) => {
    if (isAllMode) {
      onUseAllStoredChange(false);
      onChange(storedSymbols.filter((s) => s !== symbol));
      return;
    }
    onChange(selected.filter((s) => s !== symbol));
  };

  const applyWatchlist = (symbols: readonly string[]) => {
    onUseAllStoredChange(false);
    const merged = [...new Set([...selected, ...symbols])];
    onChange(maxSymbols != null ? merged.slice(0, maxSymbols) : merged);
  };

  const addAllStored = () => {
    onUseAllStoredChange(true);
    onChange([]);
  };

  const clearSelected = () => {
    onUseAllStoredChange(false);
    onChange([]);
  };

  const switchToCustom = () => onUseAllStoredChange(false);

  const atLimit =
    !isAllMode && maxSymbols != null && selected.length >= maxSymbols;
  const selectedCount = isAllMode ? storedSymbols.length : selected.length;
  const previewSelected = isAllMode
    ? storedSymbols.slice(0, SELECTED_PREVIEW_LIMIT)
    : selected.slice(0, SELECTED_PREVIEW_LIMIT);
  const hiddenSelectedCount = Math.max(0, selectedCount - previewSelected.length);

  return (
    <section className="ui-panel p-6">
      <p className="ui-eyebrow">{stepLabel}</p>
      <h2 className="ui-section-title mt-2">Select symbols</h2>
      <p className="ui-helper mt-1">
        {description} {limitLabel}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_minmax(14rem,18rem)]">
        <div className="min-w-0 space-y-4">
          <div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSymbol(search);
                }
              }}
              placeholder="Search downloaded symbols…"
              className="ui-input"
            />
            {search.trim() && (
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => addSymbol(symbol)}
                    disabled={!isAllMode && (selectedSet.has(symbol) || atLimit)}
                    className="rounded-lg border border-border px-2.5 py-1 font-mono text-xs hover:border-brand disabled:opacity-40"
                  >
                    {symbol}
                  </button>
                ))}
                {!suggestions.includes(search.trim().toUpperCase()) &&
                  search.trim() && (
                    <button
                      type="button"
                      onClick={() => addSymbol(search)}
                      disabled={atLimit}
                      className="rounded-lg border border-brand bg-brand-light/40 px-2.5 py-1 text-xs font-medium text-brand-text disabled:opacity-40"
                    >
                      Add {search.trim().toUpperCase()}
                    </button>
                  )}
              </div>
            )}
          </div>

          <div>
            <p className="ui-field-label">Quick add</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SYMBOL_WATCHLISTS.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => applyWatchlist(list.symbols)}
                  disabled={atLimit}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-body transition hover:border-brand hover:text-ink disabled:opacity-40"
                >
                  {list.label}
                </button>
              ))}
              {storedSymbols.length > 0 && (
                <button
                  type="button"
                  onClick={addAllStored}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    isAllMode
                      ? "border-brand bg-brand-light/60 text-brand-text"
                      : "border-brand/40 bg-brand-light/50 text-brand-text hover:border-brand"
                  }`}
                >
                  All downloaded ({storedSymbols.length})
                </button>
              )}
            </div>
          </div>

          {isAllMode ? (
            <div className="rounded-xl border border-brand/30 bg-brand-light/30 p-5">
              <p className="text-sm font-medium text-ink">
                All {storedSymbols.length} downloaded symbols are selected.
              </p>
              <p className="ui-helper mt-1">
                Scans and backtests will use your full downloaded universe without
                loading thousands of rows into this panel.
              </p>
              <button
                type="button"
                onClick={switchToCustom}
                className="ui-btn-secondary mt-4"
              >
                Pick specific symbols
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="ui-field-label">
                  {storedSymbols.length > 0
                    ? `Downloaded symbols (${browseSymbols.length})`
                    : `Suggested symbols (${browseSymbols.length})`}
                </p>
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelected}
                    className="text-xs font-medium text-muted hover:text-danger"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-border-subtle bg-input/40 p-2">
                {browseSymbols.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted">
                    No symbols match your search.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
                      {visibleBrowse.map((symbol) => {
                        const isSelected = selectedSet.has(symbol);
                        return (
                          <button
                            key={symbol}
                            type="button"
                            onClick={() =>
                              isSelected ? removeSymbol(symbol) : addSymbol(symbol)
                            }
                            disabled={!isSelected && atLimit}
                            className={`rounded-lg px-2 py-1.5 text-left font-mono text-xs transition ${
                              isSelected
                                ? "border border-brand/40 bg-brand-light/60 font-semibold text-ink"
                                : "border border-transparent text-body hover:border-border hover:bg-surface"
                            } disabled:opacity-40`}
                          >
                            {symbol}
                          </button>
                        );
                      })}
                    </div>
                    {browseLimit < browseSymbols.length && (
                      <button
                        type="button"
                        onClick={() =>
                          setBrowseLimit((limit) => limit + BROWSE_PAGE_SIZE)
                        }
                        className="mt-2 w-full rounded-lg border border-border-subtle py-2 text-xs font-medium text-body hover:border-brand hover:text-ink"
                      >
                        Show more ({browseSymbols.length - browseLimit} remaining)
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border-subtle bg-input/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Selected symbols
          </p>
          <p className="mt-1 text-sm font-medium text-ink">
            {selectedCount}
            {maxSymbols != null ? ` / ${maxSymbols}` : ""}
          </p>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {selectedCount === 0 ? (
              <li className="text-xs text-muted">No symbols selected yet.</li>
            ) : isAllMode ? (
              <li className="rounded-lg border border-brand/30 bg-brand-light/40 px-3 py-2 text-xs text-body">
                Using all {storedSymbols.length} downloaded symbols.
              </li>
            ) : (
              <>
                {previewSelected.map((symbol) => (
                  <li
                    key={symbol}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2"
                  >
                    <span className="font-mono text-sm font-semibold text-ink">
                      {symbol}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSymbol(symbol)}
                      className="text-muted hover:text-danger"
                      aria-label={`Remove ${symbol}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
                {hiddenSelectedCount > 0 && (
                  <li className="px-3 py-2 text-xs text-muted">
                    and {hiddenSelectedCount} more…
                  </li>
                )}
              </>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
});
