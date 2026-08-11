"use client";

import { useCallback, useState } from "react";
import { DEFAULT_WATCHLIST } from "@/lib/data/default-universe";
import { mergePriceBars } from "@/lib/storage/prices";
import type { OhlcvBar } from "@/lib/types";
import { StoredDataInventory } from "./StoredDataInventory";

interface FetchResult {
  symbol: string;
  count: number;
  error?: string;
}

export function DataManager() {
  const [symbols, setSymbols] = useState(DEFAULT_WATCHLIST.join(", "));
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<FetchResult[]>([]);
  const [customSymbol, setCustomSymbol] = useState("");
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);

  const refreshInventory = useCallback(() => {
    setInventoryRefreshKey((key) => key + 1);
  }, []);

  const fetchSymbol = useCallback(async (symbol: string): Promise<FetchResult> => {
    try {
      const res = await fetch(`/api/prices/${symbol}?range=10y`);
      const data = await res.json();
      if (!res.ok) {
        return { symbol, count: 0, error: data.error ?? "Failed" };
      }
      await mergePriceBars(symbol, data.bars as OhlcvBar[]);
      return { symbol, count: data.count as number };
    } catch (e) {
      return {
        symbol,
        count: 0,
        error: e instanceof Error ? e.message : "Failed",
      };
    }
  }, []);

  const runFetch = useCallback(
    async (list: string[]) => {
      setLoading(true);
      setResults([]);
      setProgress({ done: 0, total: list.length });
      const out: FetchResult[] = [];

      for (let i = 0; i < list.length; i++) {
        const symbol = list[i]!.trim().toUpperCase();
        if (!symbol) continue;
        const result = await fetchSymbol(symbol);
        out.push(result);
        setResults([...out]);
        setProgress({ done: i + 1, total: list.length });
        await new Promise((r) => setTimeout(r, 300));
      }

      setLoading(false);
      refreshInventory();
    },
    [fetchSymbol, refreshInventory],
  );

  return (
    <div className="space-y-8">
      <StoredDataInventory
        refreshKey={inventoryRefreshKey}
        onChanged={refreshInventory}
      />

      <section className="ui-panel p-6">
        <p className="ui-eyebrow">Download</p>
        <h2 className="ui-section-title mt-2">Download price data</h2>
        <p className="ui-helper mt-2">
          Data is fetched via Yahoo Finance and stored in your browser
          (IndexedDB). No server database.
        </p>

        <div className="mt-6">
          <label className="ui-field-label">Symbols (comma-separated)</label>
          <textarea
            value={symbols}
            onChange={(e) => setSymbols(e.target.value)}
            rows={4}
            className="ui-input mt-2 font-mono"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              runFetch(symbols.split(",").map((s) => s.trim()).filter(Boolean))
            }
            className="ui-btn-primary disabled:opacity-50"
          >
            {loading ? "Downloading…" : "Download to browser"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => runFetch(DEFAULT_WATCHLIST)}
            className="ui-btn-secondary disabled:opacity-50"
          >
            Quick: default watchlist ({DEFAULT_WATCHLIST.length})
          </button>
        </div>

        {loading && (
          <p className="ui-helper mt-4">
            Progress: {progress.done} / {progress.total}
          </p>
        )}
      </section>

      <section className="ui-panel p-6">
        <p className="ui-eyebrow">Quick add</p>
        <h2 className="ui-section-title mt-2">Add single symbol</h2>
        <div className="mt-4 flex gap-3">
          <input
            value={customSymbol}
            onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="ui-input w-auto min-w-[8rem]"
          />
          <button
            type="button"
            disabled={loading || !customSymbol}
            onClick={() => runFetch([customSymbol])}
            className="ui-btn-primary disabled:opacity-50"
          >
            Fetch
          </button>
        </div>
      </section>

      {results.length > 0 && (
        <section className="ui-panel p-6">
          <h2 className="ui-section-title">Download results</h2>
          <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-border-subtle">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Bars</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.symbol}>
                    <td className="font-mono font-semibold">{r.symbol}</td>
                    <td>{r.count}</td>
                    <td>
                      {r.error ? (
                        <span className="text-danger">{r.error}</span>
                      ) : (
                        <span className="text-success">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
