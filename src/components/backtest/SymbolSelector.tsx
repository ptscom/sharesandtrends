"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_WATCHLIST,
  SYMBOL_WATCHLISTS,
} from "@/lib/data/default-universe";
import { MAX_BACKTEST_SYMBOLS } from "@/lib/engine/param-sweep";

interface SymbolSelectorProps {
  selected: string[];
  storedSymbols: string[];
  onChange: (symbols: string[]) => void;
}

export function SymbolSelector({
  selected,
  storedSymbols,
  onChange,
}: SymbolSelectorProps) {
  const [search, setSearch] = useState("");

  const suggestions = useMemo(() => {
    const q = search.trim().toUpperCase();
    const pool = [...new Set([...DEFAULT_WATCHLIST, ...storedSymbols])];
    if (!q) return pool.slice(0, 12);
    return pool.filter((s) => s.includes(q)).slice(0, 12);
  }, [search, storedSymbols]);

  const addSymbol = (symbol: string) => {
    const upper = symbol.trim().toUpperCase();
    if (!upper || selected.includes(upper)) return;
    if (selected.length >= MAX_BACKTEST_SYMBOLS) return;
    onChange([...selected, upper]);
    setSearch("");
  };

  const removeSymbol = (symbol: string) => {
    onChange(selected.filter((s) => s !== symbol));
  };

  const applyWatchlist = (symbols: readonly string[]) => {
    const merged = [...new Set([...selected, ...symbols])].slice(
      0,
      MAX_BACKTEST_SYMBOLS,
    );
    onChange(merged);
  };

  const addAllStored = () => {
    onChange(storedSymbols.slice(0, MAX_BACKTEST_SYMBOLS));
  };

  return (
    <section className="ui-panel p-6">
      <p className="ui-eyebrow">Step 1</p>
      <h2 className="ui-section-title mt-2">Select symbols</h2>
      <p className="ui-helper mt-1">
        Up to {MAX_BACKTEST_SYMBOLS} symbols per run.
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
              placeholder="Search symbols…"
              className="ui-input"
            />
            {search.trim() && (
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => addSymbol(symbol)}
                    disabled={selected.includes(symbol)}
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
                      className="rounded-lg border border-brand bg-brand-light/40 px-2.5 py-1 text-xs font-medium text-brand-text"
                    >
                      Add {search.trim().toUpperCase()}
                    </button>
                  )}
              </div>
            )}
          </div>

          <div>
            <p className="ui-field-label">Popular watchlists</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SYMBOL_WATCHLISTS.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => applyWatchlist(list.symbols)}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-body transition hover:border-brand hover:text-ink"
                >
                  {list.label}
                </button>
              ))}
              {storedSymbols.length > 0 && (
                <button
                  type="button"
                  onClick={addAllStored}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-body transition hover:border-brand hover:text-ink"
                >
                  All stored ({storedSymbols.length})
                </button>
              )}
            </div>
          </div>

          {selected.length > 0 && (
            <div>
              <p className="ui-field-label">Selected</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.map((symbol) => (
                  <span
                    key={symbol}
                    className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-light/50 px-2.5 py-1 font-mono text-xs font-medium text-ink"
                  >
                    {symbol}
                    <button
                      type="button"
                      onClick={() => removeSymbol(symbol)}
                      className="text-muted hover:text-danger"
                      aria-label={`Remove ${symbol}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border-subtle bg-input/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Selected symbols
          </p>
          <p className="mt-1 text-sm font-medium text-ink">
            {selected.length} / {MAX_BACKTEST_SYMBOLS}
          </p>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {selected.length === 0 ? (
              <li className="text-xs text-muted">No symbols selected yet.</li>
            ) : (
              selected.map((symbol) => (
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
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
