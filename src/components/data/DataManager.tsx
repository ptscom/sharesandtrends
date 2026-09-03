"use client";

import { useCallback, useState } from "react";
import { DEFAULT_WATCHLIST } from "@/lib/data/default-universe";
import {
  defaultUpdateFromDate,
  defaultUpdateToDate,
  runFetchJobs,
  type FetchJob,
  type FetchJobResult,
} from "@/lib/data/fetch-prices-client";
import { findStaleSymbols } from "@/lib/data/stale-symbols";
import { listSymbolInventory, listSymbols } from "@/lib/storage/prices";
import { StoredDataInventory } from "./StoredDataInventory";

export function DataManager() {
  const [symbols, setSymbols] = useState(DEFAULT_WATCHLIST.join(", "));
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<FetchJobResult[]>([]);
  const [customSymbol, setCustomSymbol] = useState("");
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);

  const [updateFrom, setUpdateFrom] = useState(defaultUpdateFromDate);
  const [updateTo, setUpdateTo] = useState(defaultUpdateToDate);
  const [updateScope, setUpdateScope] = useState<"all" | "custom">("all");
  const [updateSymbols, setUpdateSymbols] = useState("");
  const [lastJobMode, setLastJobMode] = useState<"download" | "update" | "fix">(
    "download",
  );

  const refreshInventory = useCallback(() => {
    setInventoryRefreshKey((key) => key + 1);
  }, []);

  const runJobBatch = useCallback(
    async (jobs: FetchJob[], mode: "download" | "update" | "fix") => {
      setLoading(true);
      setFixing(mode === "fix");
      setLastJobMode(mode);
      setResults([]);
      setProgress({ done: 0, total: jobs.length });

      const out = await runFetchJobs(jobs, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResults(out);

      const failed = out.filter((row) => row.error);
      if (failed.length > 0) {
        const retryJobs = jobs.filter((job) =>
          failed.some((row) => row.symbol === job.symbol),
        );
        setProgress({ done: 0, total: retryJobs.length });
        const retried = await runFetchJobs(retryJobs, {
          onProgress: (done, total) => setProgress({ done, total }),
        });
        const merged = [...out];
        for (const row of retried) {
          const index = merged.findIndex((item) => item.symbol === row.symbol);
          if (index >= 0) merged[index] = row;
        }
        setResults(merged);
      }

      setLoading(false);
      setFixing(false);
      refreshInventory();
    },
    [refreshInventory],
  );

  const runDownload = useCallback(
    (list: string[]) =>
      runJobBatch(
        list
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
          .map((symbol) => ({ symbol, options: { range: "10y" } })),
        "download",
      ),
    [runJobBatch],
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
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (list.length === 0) return;
    }

    await runJobBatch(
      list.map((symbol) => ({
        symbol,
        options: { from: updateFrom, to: updateTo },
      })),
      "update",
    );
  }, [updateFrom, updateTo, updateScope, updateSymbols, runJobBatch]);

  const runFixData = useCallback(async () => {
    const inventory = await listSymbolInventory();
    const analysis = findStaleSymbols(inventory);

    if (!analysis.plan) {
      window.alert("All symbols already end on the latest date in your list.");
      return;
    }

    const { plan } = analysis;
    const preview = [...plan.rangeSymbols, ...plan.fullDownloadSymbols]
      .slice(0, 5)
      .join(", ");
    const totalStale = plan.rangeSymbols.length + plan.fullDownloadSymbols.length;
    const suffix = totalStale > 5 ? ` and ${totalStale - 5} more` : "";

    const rangeNote =
      plan.rangeSymbols.length > 0
        ? `fetch ${plan.fetchFrom} → ${plan.fetchTo} for ${plan.rangeSymbols.length} symbol(s)`
        : "";
    const fullNote =
      plan.fullDownloadSymbols.length > 0
        ? `full download for ${plan.fullDownloadSymbols.length} empty symbol(s)`
        : "";
    const actionNote = [rangeNote, fullNote].filter(Boolean).join("; ");

    if (
      !window.confirm(
        `${totalStale} symbol(s) end before ${plan.referenceLatest}. ${actionNote}: ${preview}${suffix}?`,
      )
    ) {
      return;
    }

    const jobs: FetchJob[] = [
      ...plan.rangeSymbols.map((symbol) => ({
        symbol,
        options: { from: plan.fetchFrom, to: plan.fetchTo },
      })),
      ...plan.fullDownloadSymbols.map((symbol) => ({
        symbol,
        options: { range: "10y" },
      })),
    ];

    await runJobBatch(jobs, "fix");
  }, [runJobBatch]);

  const busy = loading || fixing;
  const resultsTitle =
    lastJobMode === "fix"
      ? "Fix data results"
      : lastJobMode === "update"
        ? "Update results"
        : "Download results";

  return (
    <div className="space-y-8">
      <StoredDataInventory
        refreshKey={inventoryRefreshKey}
        onChanged={refreshInventory}
        onFixData={() => void runFixData()}
        fixing={fixing}
      />

      <section className="ui-panel p-6">
        <p className="ui-eyebrow">Update</p>
        <h2 className="ui-section-title mt-2">Update existing data</h2>
        <p className="ui-helper mt-2">
          Fetch a date range and merge into stored symbols. Use this for daily
          updates. Overlapping dates are overwritten with the latest download.
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
              busy || !updateFrom || !updateTo || updateFrom > updateTo
            }
            onClick={() => void runUpdate()}
            className="ui-btn-primary disabled:opacity-50"
          >
            {loading && !fixing ? "Updating…" : "Update data"}
          </button>
        </div>
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

      {loading && (
        <p className="ui-helper">
          {fixing ? "Fixing data" : "Progress"}: {progress.done} / {progress.total}
        </p>
      )}

      {results.length > 0 && (
        <section className="ui-panel p-6">
          <h2 className="ui-section-title">{resultsTitle}</h2>
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
