"use client";

import { useCallback, useState } from "react";
import { DEFAULT_WATCHLIST } from "@/lib/data/default-universe";
import {
  defaultUpdateFromDate,
  defaultUpdateToDate,
  fetchPriceBars,
} from "@/lib/data/fetch-prices-client";
import { listSymbols, mergePriceBars } from "@/lib/storage/prices";
import { StoredDataInventory } from "./StoredDataInventory";

interface FetchResult {
  symbol: string;
  count: number;
  error?: string;
}

const FETCH_DELAY_MS = 250;

export function DataManager() {
  const [symbols, setSymbols] = useState(DEFAULT_WATCHLIST.join(", "));
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<FetchResult[]>([]);
  const [customSymbol, setCustomSymbol] = useState("");
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);

  const [updateFrom, setUpdateFrom] = useState(defaultUpdateFromDate);
  const [updateTo, setUpdateTo] = useState(defaultUpdateToDate);
  const [updateScope, setUpdateScope] = useState<"all" | "custom">("all");
  const [updateSymbols, setUpdateSymbols] = useState("");

  const refreshInventory = useCallback(() => {
    setInventoryRefreshKey((key) => key + 1);
  }, []);

  const runFetchJob = useCallback(
    async (
      list: string[],
      options: { range?: string; from?: string; to?: string },
    ) => {
      setLoading(true);
      setResults([]);
      setProgress({ done: 0, total: list.length });
      const out: FetchResult[] = [];

      for (let i = 0; i < list.length; i++) {
        const symbol = list[i]!.trim().toUpperCase();
        if (!symbol) continue;

        const fetched = await fetchPriceBars(symbol, options);
        if (fetched.error) {
          out.push({ symbol, count: 0, error: fetched.error });
        } else {
          await mergePriceBars(symbol, fetched.bars);
          out.push({ symbol, count: fetched.count });
        }

        setResults([...out]);
        setProgress({ done: i + 1, total: list.length });
        if (i < list.length - 1) {
          await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
        }
      }

      setLoading(false);
      refreshInventory();
    },
    [refreshInventory],
  );

  const runDownload = useCallback(
    (list: string[]) => runFetchJob(list, { range: "10y" }),
    [runFetchJob],
  );

  const runUpdate = useCallback(async () => {
    if (!updateFrom || !updateTo || updateFrom > updateTo) return;

    let list: string[];
    if (updateScope === "all") {
      const stored = await listSymbols();
      list = stored.map((s) => s.symbol);
      if (list.length === 0) return;
    } else {
      list = updateSymbols
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length === 0) return;
    }

    await runFetchJob(list, { from: updateFrom, to: updateTo });
  }, [updateFrom, updateTo, updateScope, updateSymbols, runFetchJob]);

  return (
    <div className="space-y-8">
      <StoredDataInventory
        refreshKey={inventoryRefreshKey}
        onChanged={refreshInventory}
      />

      <section className="ui-panel p-6">
        <p className="ui-eyebrow">Update</p>
        <h2 className="ui-section-title mt-2">Update existing data</h2>
        <p className="ui-helper mt-2">
          Fetch a date range and merge into stored symbols. Overlapping dates are
          overwritten with the latest download.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="ui-field-label">From</span>
            <input
              type="date"
              value={updateFrom}
              onChange={(e) => setUpdateFrom(e.target.value)}
              className="ui-input mt-1 w-auto min-w-[10rem]"
            />
          </label>
          <label className="block">
            <span className="ui-field-label">To</span>
            <input
              type="date"
              value={updateTo}
              onChange={(e) => setUpdateTo(e.target.value)}
              className="ui-input mt-1 w-auto min-w-[10rem]"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="updateScope"
              checked={updateScope === "all"}
              onChange={() => setUpdateScope("all")}
            />
            All stored symbols
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="updateScope"
              checked={updateScope === "custom"}
              onChange={() => setUpdateScope("custom")}
            />
            Custom list
          </label>
        </div>

        {updateScope === "custom" && (
          <div className="mt-4">
            <label className="ui-field-label">Symbols (comma-separated)</label>
            <textarea
              value={updateSymbols}
              onChange={(e) => setUpdateSymbols(e.target.value)}
              rows={3}
              className="ui-input mt-2 font-mono"
              placeholder="AAPL, MSFT, RELIANCE.NS"
            />
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            disabled={
              loading ||
              !updateFrom ||
              !updateTo ||
              updateFrom > updateTo
            }
            onClick={() => void runUpdate()}
            className="ui-btn-primary disabled:opacity-50"
          >
            {loading ? "Updating…" : "Update data"}
          </button>
        </div>

        {loading && (
          <p className="ui-helper mt-4">
            Progress: {progress.done} / {progress.total}
          </p>
        )}
      </section>

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
              runDownload(symbols.split(",").map((s) => s.trim()).filter(Boolean))
            }
            className="ui-btn-primary disabled:opacity-50"
          >
            {loading ? "Downloading…" : "Download to browser"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => runDownload(DEFAULT_WATCHLIST)}
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
            onClick={() => runDownload([customSymbol])}
            className="ui-btn-primary disabled:opacity-50"
          >
            Fetch
          </button>
        </div>
      </section>

      {results.length > 0 && (
        <section className="ui-panel p-6">
          <h2 className="ui-section-title">Job results</h2>
          <div className="mt-4 max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4">Symbol</th>
                  <th className="py-2 pr-4">Bars</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.symbol} className="border-b border-border/40">
                    <td className="py-2 pr-4 font-mono font-semibold">
                      {r.symbol}
                    </td>
                    <td className="py-2 pr-4">{r.count}</td>
                    <td className="py-2">
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
