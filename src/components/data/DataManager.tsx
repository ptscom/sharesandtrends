"use client";

import { useCallback, useState } from "react";
import { DEFAULT_WATCHLIST } from "@/lib/data/default-universe";
import { fetchPriceBars } from "@/lib/data/fetch-prices-client";
import { findStaleSymbols, type StaleSymbolJob } from "@/lib/data/stale-symbols";
import { listSymbolInventory, mergePriceBars } from "@/lib/storage/prices";
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
  const [fixing, setFixing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<FetchResult[]>([]);
  const [customSymbol, setCustomSymbol] = useState("");
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);

  const refreshInventory = useCallback(() => {
    setInventoryRefreshKey((key) => key + 1);
  }, []);

  const runFetchJob = useCallback(
    async (
      jobs: Array<{
        symbol: string;
        options: { range?: string; from?: string; to?: string };
      }>,
    ) => {
      setLoading(true);
      setResults([]);
      setProgress({ done: 0, total: jobs.length });
      const out: FetchResult[] = [];

      for (let i = 0; i < jobs.length; i++) {
        const { symbol, options } = jobs[i]!;
        const fetched = await fetchPriceBars(symbol, options);
        if (fetched.error) {
          out.push({ symbol, count: 0, error: fetched.error });
        } else {
          await mergePriceBars(symbol, fetched.bars);
          out.push({ symbol, count: fetched.count });
        }

        setResults([...out]);
        setProgress({ done: i + 1, total: jobs.length });
        if (i < jobs.length - 1) {
          await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
        }
      }

      setLoading(false);
      refreshInventory();
    },
    [refreshInventory],
  );

  const runDownload = useCallback(
    (list: string[]) =>
      runFetchJob(
        list.map((symbol) => ({
          symbol: symbol.trim().toUpperCase(),
          options: { range: "10y" },
        })),
      ),
    [runFetchJob],
  );

  const runFixData = useCallback(async () => {
    const inventory = await listSymbolInventory();
    const analysis = findStaleSymbols(inventory);

    if (analysis.stale.length === 0) {
      window.alert("All symbols are up to date with the latest date in your list.");
      return;
    }

    const preview = analysis.stale
      .slice(0, 5)
      .map((job) => job.symbol)
      .join(", ");
    const suffix =
      analysis.stale.length > 5
        ? ` and ${analysis.stale.length - 5} more`
        : "";

    if (
      !window.confirm(
        `${analysis.stale.length} symbol(s) are behind the latest date (${analysis.referenceLatest}). Re-download missing data for: ${preview}${suffix}?`,
      )
    ) {
      return;
    }

    setFixing(true);
    setLoading(true);
    setResults([]);
    setProgress({ done: 0, total: analysis.stale.length });
    const out: FetchResult[] = [];

    const fetchJob = async (job: StaleSymbolJob): Promise<FetchResult> => {
      const fetched = job.fullDownload
        ? await fetchPriceBars(job.symbol, { range: "10y" })
        : await fetchPriceBars(job.symbol, {
            from: job.fetchFrom,
            to: job.fetchTo,
          });

      if (fetched.error) {
        return { symbol: job.symbol, count: 0, error: fetched.error };
      }

      await mergePriceBars(job.symbol, fetched.bars);
      return { symbol: job.symbol, count: fetched.count };
    };

    for (let i = 0; i < analysis.stale.length; i++) {
      const job = analysis.stale[i]!;
      const result = await fetchJob(job);
      out.push(result);
      setResults([...out]);
      setProgress({ done: i + 1, total: analysis.stale.length });

      if (i < analysis.stale.length - 1) {
        await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
      }
    }

    const failed = out.filter((row) => row.error);
    if (failed.length > 0) {
      setProgress({ done: 0, total: failed.length });
      for (let i = 0; i < failed.length; i++) {
        const job = analysis.stale.find((item) => item.symbol === failed[i]!.symbol);
        if (!job) continue;
        const retry = await fetchJob(job);
        const index = out.findIndex((row) => row.symbol === retry.symbol);
        if (index >= 0) out[index] = retry;
        setResults([...out]);
        setProgress({ done: i + 1, total: failed.length });
        if (i < failed.length - 1) {
          await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
        }
      }
    }

    setLoading(false);
    setFixing(false);
    refreshInventory();
  }, [refreshInventory]);

  const busy = loading || fixing;

  return (
    <div className="space-y-8">
      <StoredDataInventory
        refreshKey={inventoryRefreshKey}
        onChanged={refreshInventory}
        onFixData={() => void runFixData()}
        fixing={fixing}
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
            disabled={busy}
            onClick={() =>
              runDownload(symbols.split(",").map((s) => s.trim()).filter(Boolean))
            }
            className="ui-btn-primary disabled:opacity-50"
          >
            {loading && !fixing ? "Downloading…" : "Download to browser"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runDownload(DEFAULT_WATCHLIST)}
            className="ui-btn-secondary disabled:opacity-50"
          >
            Quick: default watchlist ({DEFAULT_WATCHLIST.length})
          </button>
        </div>

        {loading && (
          <p className="ui-helper mt-4">
            {fixing ? "Fixing data" : "Progress"}: {progress.done} /{" "}
            {progress.total}
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
            disabled={busy || !customSymbol}
            onClick={() => runDownload([customSymbol])}
            className="ui-btn-primary disabled:opacity-50"
          >
            Fetch
          </button>
        </div>
      </section>

      {results.length > 0 && (
        <section className="ui-panel p-6">
          <h2 className="ui-section-title">
            {fixing ? "Fix data results" : "Download results"}
          </h2>
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
                    <td className="py-2 pr-4 font-mono font-semibold">{r.symbol}</td>
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
