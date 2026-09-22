"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSessionTokens } from "@/lib/upstox/client-tokens";
import {
  currentRowsToCsv,
  downloadTextFile,
  failuresToCsv,
  historicalRowsToCsv,
} from "@/lib/upstox/csv";
import {
  type HistoricalPreset,
  rangeFromPreset,
  todayYmd,
} from "@/lib/upstox/date-ranges";
import {
  collectJobErrors,
  createHistoricalJob,
  runHistoricalJob,
  type JobProgress,
} from "@/lib/upstox/historical-job-runner";
import { parseSymbolList } from "@/lib/upstox/parse";
import type {
  CurrentPriceRow,
  HistoricalJob,
  HistoricalPriceRow,
  UpstoxDataError,
} from "@/lib/upstox/types";
import { syncCurrentRowsToPrices } from "@/lib/upstox/sync-to-prices";
import {
  countHistoricalStats,
  deleteHistoricalDatabase,
  deleteHistoricalSymbol,
  listAllHistoricalRows,
  listIncompleteHistoricalJobs,
  saveHistoricalJob,
  syncAllUpstoxHistoricalToPrices,
} from "@/lib/storage/upstox-historical";

type Tab = "current" | "historical";
type SymbolMode = "manual" | "top1000";

const PAGE_SIZE = 50;

async function postUpstox<T>(
  body: Record<string, unknown>,
): Promise<{ rows: T[]; errors: UpstoxDataError[]; activeLanes?: number; requestCount: number }> {
  const accessTokens = loadSessionTokens();
  const res = await fetch("/api/upstox/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      accessTokens: accessTokens.length > 0 ? accessTokens : undefined,
    }),
  });
  return res.json();
}

export function UpstoxDataManager() {
  const [tab, setTab] = useState<Tab>("current");
  const [symbolMode, setSymbolMode] = useState<SymbolMode>("manual");
  const [manualSymbols, setManualSymbols] = useState("RELIANCE, TCS, INFY, M&M");
  const [top1000, setTop1000] = useState<string[]>([]);

  const [currentRows, setCurrentRows] = useState<CurrentPriceRow[]>([]);
  const [currentErrors, setCurrentErrors] = useState<UpstoxDataError[]>([]);
  const [currentTradingDate, setCurrentTradingDate] = useState(todayYmd());
  const [currentLoading, setCurrentLoading] = useState(false);
  const [currentSearch, setCurrentSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);

  const [historicalRows, setHistoricalRows] = useState<HistoricalPriceRow[]>([]);
  const [dbStats, setDbStats] = useState({ rowCount: 0, symbolCount: 0 });
  const [histPreset, setHistPreset] = useState<HistoricalPreset>("1y");
  const [histFrom, setHistFrom] = useState("");
  const [histTo, setHistTo] = useState(todayYmd());
  const [histSearch, setHistSearch] = useState("");
  const [histPage, setHistPage] = useState(0);
  const [histJob, setHistJob] = useState<HistoricalJob | null>(null);
  const [histProgress, setHistProgress] = useState<JobProgress | null>(null);
  const [histErrors, setHistErrors] = useState<UpstoxDataError[]>([]);
  const [histRunning, setHistRunning] = useState(false);
  const stopRef = useRef(false);

  const refreshHistoricalStore = useCallback(async () => {
    const [rows, stats] = await Promise.all([
      listAllHistoricalRows(),
      countHistoricalStats(),
    ]);
    setHistoricalRows(rows);
    setDbStats(stats);
  }, []);

  useEffect(() => {
    void refreshHistoricalStore();
    void (async () => {
      const incomplete = await listIncompleteHistoricalJobs();
      if (incomplete.length > 0) {
        setHistJob(incomplete.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]);
      }
    })();
    void fetch("/top1000.json")
      .then((r) => r.json())
      .then((data: { symbols?: string[] }) => {
        if (Array.isArray(data.symbols)) setTop1000(data.symbols);
      })
      .catch(() => undefined);
  }, [refreshHistoricalStore]);

  const resolvedSymbols = useMemo(() => {
    if (symbolMode === "top1000") return top1000;
    return parseSymbolList(manualSymbols);
  }, [symbolMode, manualSymbols, top1000]);

  const fetchCurrent = useCallback(async () => {
    if (currentLoading || resolvedSymbols.length === 0) return;
    setCurrentLoading(true);
    setCurrentErrors([]);
    try {
      const data = await postUpstox<CurrentPriceRow>({
        mode: "current",
        symbols: resolvedSymbols,
      });
      const tradingDate = todayYmd();
      setCurrentRows(data.rows);
      setCurrentErrors(data.errors);
      setCurrentTradingDate(tradingDate);
      await syncCurrentRowsToPrices(data.rows, tradingDate);
    } catch {
      setCurrentErrors([
        {
          symbol: "*",
          stage: "quote",
          message: "Failed to reach Upstox API route.",
          retryable: true,
        },
      ]);
    } finally {
      setCurrentLoading(false);
    }
  }, [currentLoading, resolvedSymbols]);

  const startHistoricalJob = useCallback(async () => {
    if (histRunning || resolvedSymbols.length === 0) return;
    const range = rangeFromPreset(
      histPreset,
      histPreset === "custom" ? histFrom : undefined,
      histPreset === "custom" ? histTo : histTo,
    );
    if (range.error || !range.fromDate) {
      window.alert(range.error ?? "Invalid date range");
      return;
    }

    const job = createHistoricalJob(resolvedSymbols, range.fromDate, range.toDate);
    await saveHistoricalJob(job);
    setHistJob(job);
    setHistErrors([]);
    setHistRunning(true);
    stopRef.current = false;

    const finished = await runHistoricalJob(job, {
      shouldStop: () => stopRef.current,
      onProgress: (progress, updated) => {
        setHistProgress(progress);
        setHistJob({ ...updated });
      },
    });
    setHistJob(finished);
    setHistErrors(collectJobErrors(finished));
    setHistRunning(false);
    await refreshHistoricalStore();
  }, [
    histRunning,
    resolvedSymbols,
    histPreset,
    histFrom,
    histTo,
    refreshHistoricalStore,
  ]);

  const resumeHistoricalJob = useCallback(async () => {
    if (!histJob || histRunning) return;
    setHistRunning(true);
    stopRef.current = false;
    const finished = await runHistoricalJob(histJob, {
      shouldStop: () => stopRef.current,
      onProgress: (progress, updated) => {
        setHistProgress(progress);
        setHistJob({ ...updated });
      },
    });
    setHistJob(finished);
    setHistErrors(collectJobErrors(finished));
    setHistRunning(false);
    await refreshHistoricalStore();
  }, [histJob, histRunning, refreshHistoricalStore]);

  const retryFailedHistorical = useCallback(async () => {
    if (!histJob || histRunning) return;
    const failed = histJob.failedSymbols.filter((f) => f.retryable).map((f) => f.symbol);
    if (failed.length === 0) return;
    setHistRunning(true);
    stopRef.current = false;
    const finished = await runHistoricalJob(histJob, {
      symbols: failed,
      shouldStop: () => stopRef.current,
      onProgress: (progress, updated) => {
        setHistProgress(progress);
        setHistJob({ ...updated });
      },
    });
    setHistJob(finished);
    setHistErrors(collectJobErrors(finished));
    setHistRunning(false);
    await refreshHistoricalStore();
  }, [histJob, histRunning, refreshHistoricalStore]);

  const stopHistorical = () => {
    stopRef.current = true;
  };

  const filteredCurrent = useMemo(() => {
    const q = currentSearch.trim().toUpperCase();
    const rows = q
      ? currentRows.filter((r) => r.symbol.includes(q))
      : currentRows;
    return rows;
  }, [currentRows, currentSearch]);

  const filteredHistorical = useMemo(() => {
    const q = histSearch.trim().toUpperCase();
    return q
      ? historicalRows.filter((r) => r.symbol.includes(q))
      : historicalRows;
  }, [historicalRows, histSearch]);

  const currentPageRows = filteredCurrent.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const histPageRows = filteredHistorical.slice(
    histPage * PAGE_SIZE,
    (histPage + 1) * PAGE_SIZE,
  );

  const estCompletionNote =
    histProgress && histProgress.remaining > 0
      ? `~${Math.ceil(histProgress.remaining / Math.max(1, histProgress.activeLanes))} symbol batches remaining (estimate varies with throttling).`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <button
          type="button"
          className={`ui-btn-secondary${tab === "current" ? " ring-2 ring-brand" : ""}`}
          onClick={() => setTab("current")}
        >
          Current Day
        </button>
        <button
          type="button"
          className={`ui-btn-secondary${tab === "historical" ? " ring-2 ring-brand" : ""}`}
          onClick={() => setTab("historical")}
        >
          Upstox EOD Historical
        </button>
      </div>

      <section className="ui-panel p-6">
        <p className="ui-eyebrow">Universe</p>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={symbolMode === "manual"}
              onChange={() => setSymbolMode("manual")}
            />
            Manual symbols
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={symbolMode === "top1000"}
              onChange={() => setSymbolMode("top1000")}
            />
            Fixed Top 1,000 ({top1000.length} loaded)
          </label>
        </div>
        {symbolMode === "manual" && (
          <textarea
            className="ui-input mt-4 font-mono text-sm"
            rows={4}
            value={manualSymbols}
            onChange={(e) => setManualSymbols(e.target.value)}
            placeholder="RELIANCE, M&M, M&MFIN"
          />
        )}
        <p className="ui-helper mt-2">
          {resolvedSymbols.length} symbol{resolvedSymbols.length === 1 ? "" : "s"} selected.
          Special characters such as &amp; are preserved via JSON request bodies.
        </p>
      </section>

      {tab === "current" && (
        <>
          <section className="ui-panel p-6">
            <h2 className="ui-section-title">Current Day (latest snapshot)</h2>
            <p className="ui-helper mt-2">
              Live OHLC from Upstox `live_ohlc` (not tick-by-tick). Trading date:{" "}
              {currentTradingDate}. Successful fetches also update today&apos;s bar
              in the backtest price database.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="ui-btn-primary"
                disabled={currentLoading || resolvedSymbols.length === 0}
                onClick={() => void fetchCurrent()}
              >
                {currentLoading ? "Fetching…" : "Fetch current day"}
              </button>
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={currentRows.length === 0}
                onClick={() =>
                  downloadTextFile(
                    `upstox-current-${todayYmd()}.csv`,
                    currentRowsToCsv(currentRows),
                  )
                }
              >
                Download CSV
              </button>
            </div>
            <label className="mt-4 block">
              <span className="ui-field-label">Search symbol</span>
              <input
                className="ui-input mt-1 max-w-xs"
                value={currentSearch}
                onChange={(e) => {
                  setCurrentSearch(e.target.value);
                  setCurrentPage(0);
                }}
              />
            </label>
            <PriceTable
              mode="current"
              rows={currentPageRows as CurrentPriceRow[]}
              emptyLabel={currentLoading ? "Loading…" : "No current-day rows yet."}
            />
            <Pagination
              page={currentPage}
              total={filteredCurrent.length}
              pageSize={PAGE_SIZE}
              onChange={setCurrentPage}
            />
            <ErrorsPanel errors={currentErrors} />
          </section>
        </>
      )}

      {tab === "historical" && (
        <>
          <section className="ui-panel p-6">
            <h2 className="ui-section-title">Upstox EOD Historical</h2>
            <p className="ui-helper mt-2">
              Database: {dbStats.rowCount.toLocaleString()} rows across{" "}
              {dbStats.symbolCount} symbols (IndexedDB, survives refresh). Each
              download also merges into the shared price database used by
              Explore and Backtest.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {(["1m", "1y", "5y", "10y", "custom"] as HistoricalPreset[]).map((p) => (
                <label key={p} className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    checked={histPreset === p}
                    onChange={() => setHistPreset(p)}
                  />
                  {p === "1m"
                    ? "Last 1 month"
                    : p === "1y"
                      ? "Last 1 year"
                      : p === "5y"
                        ? "Last 5 years"
                        : p === "10y"
                          ? "Last 10 years"
                          : "Custom"}
                </label>
              ))}
            </div>
            {histPreset === "custom" && (
              <div className="mt-4 flex flex-wrap gap-4">
                <label>
                  <span className="ui-field-label">From</span>
                  <input
                    type="date"
                    className="ui-input mt-1"
                    value={histFrom}
                    onChange={(e) => setHistFrom(e.target.value)}
                  />
                </label>
                <label>
                  <span className="ui-field-label">To</span>
                  <input
                    type="date"
                    className="ui-input mt-1"
                    value={histTo}
                    onChange={(e) => setHistTo(e.target.value)}
                  />
                </label>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="ui-btn-primary"
                disabled={histRunning || resolvedSymbols.length === 0}
                onClick={() => void startHistoricalJob()}
              >
                {histRunning ? "Running job…" : "Fetch historical EOD"}
              </button>
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={!histRunning}
                onClick={stopHistorical}
              >
                Stop
              </button>
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={!histJob || histRunning || histJob.complete}
                onClick={() => void resumeHistoricalJob()}
              >
                Resume
              </button>
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={!histJob || histRunning}
                onClick={() => void retryFailedHistorical()}
              >
                Retry failed symbols
              </button>
            </div>
            {histProgress && (
              <div className="mt-4 text-sm text-muted">
                <p>
                  Progress: {histProgress.percent}% — {histProgress.completed} /{" "}
                  {histProgress.total} symbols ({histProgress.failed} failed,{" "}
                  {histProgress.activeLanes} worker lane
                  {histProgress.activeLanes === 1 ? "" : "s"})
                </p>
                {estCompletionNote && <p className="mt-1">{estCompletionNote}</p>}
                {histProgress.stopped && (
                  <p className="mt-1 text-muted">Job stopped by user.</p>
                )}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="ui-btn-secondary"
                onClick={() =>
                  void syncAllUpstoxHistoricalToPrices().then(({ symbols, bars }) => {
                    window.alert(
                      `Synced ${bars} bar(s) for ${symbols} symbol(s) into the backtest price database.`,
                    );
                  })
                }
              >
                Sync all EOD → backtest DB
              </button>
              <button
                type="button"
                className="ui-btn-secondary"
                onClick={() =>
                  downloadTextFile(
                    `upstox-eod-all-${todayYmd()}.csv`,
                    historicalRowsToCsv(historicalRows),
                  )
                }
              >
                Download full EOD database CSV
              </button>
              <button
                type="button"
                className="ui-btn-secondary"
                onClick={() =>
                  downloadTextFile(
                    `upstox-eod-filtered-${todayYmd()}.csv`,
                    historicalRowsToCsv(filteredHistorical),
                  )
                }
              >
                Download filtered view CSV
              </button>
              {histErrors.length > 0 && (
                <button
                  type="button"
                  className="ui-btn-secondary"
                  onClick={() =>
                    downloadTextFile(
                      `upstox-failures-${todayYmd()}.csv`,
                      failuresToCsv(histErrors),
                    )
                  }
                >
                  Download failure report
                </button>
              )}
              <button
                type="button"
                className="ui-btn-secondary"
                onClick={() => {
                  const sym = window.prompt("Delete EOD rows for symbol (e.g. RELIANCE)");
                  if (!sym) return;
                  void deleteHistoricalSymbol(sym.trim().toUpperCase()).then(refreshHistoricalStore);
                }}
              >
                Delete selected symbol
              </button>
              <button
                type="button"
                className="ui-btn-secondary text-danger"
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete the entire Upstox EOD historical database in this browser?",
                    )
                  ) {
                    void deleteHistoricalDatabase().then(refreshHistoricalStore);
                    setHistJob(null);
                    setHistProgress(null);
                  }
                }}
              >
                Delete historical database
              </button>
            </div>
            <label className="mt-4 block">
              <span className="ui-field-label">Search symbol</span>
              <input
                className="ui-input mt-1 max-w-xs"
                value={histSearch}
                onChange={(e) => {
                  setHistSearch(e.target.value);
                  setHistPage(0);
                }}
              />
            </label>
            <PriceTable
              mode="historical"
              rows={histPageRows}
              emptyLabel="No stored EOD rows yet."
            />
            <Pagination
              page={histPage}
              total={filteredHistorical.length}
              pageSize={PAGE_SIZE}
              onChange={setHistPage}
            />
            <ErrorsPanel errors={histErrors} />
          </section>
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="mt-3 flex items-center gap-3 text-sm">
      <button
        type="button"
        className="ui-btn-secondary"
        disabled={page <= 0}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page + 1} / {pages}
      </span>
      <button
        type="button"
        className="ui-btn-secondary"
        disabled={page >= pages - 1}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

function PriceTable({
  mode,
  rows,
  emptyLabel,
}: {
  mode: "current" | "historical";
  rows: (CurrentPriceRow | HistoricalPriceRow)[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="ui-helper mt-4">{emptyLabel}</p>;
  }
  return (
    <div className="mt-4 max-h-96 overflow-auto">
      <table className="ui-table w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">Symbol</th>
            {mode === "historical" && <th className="py-2">Date</th>}
            <th className="py-2">Open</th>
            <th className="py-2">High</th>
            <th className="py-2">Low</th>
            <th className="py-2">Close</th>
            <th className="py-2">Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={mode === "historical" ? `${row.symbol}-${(row as HistoricalPriceRow).date}` : row.symbol}>
              <td className="font-mono font-semibold">{row.symbol}</td>
              {mode === "historical" && (
                <td className="font-mono">{(row as HistoricalPriceRow).date}</td>
              )}
              <td>{row.open ?? "—"}</td>
              <td>{row.high ?? "—"}</td>
              <td>{row.low ?? "—"}</td>
              <td>{row.close ?? "—"}</td>
              <td>{row.volume ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorsPanel({ errors }: { errors: UpstoxDataError[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="mt-4 rounded-md border border-danger/30 bg-danger/5 p-4">
      <h3 className="text-sm font-semibold text-danger">Failures</h3>
      <ul className="mt-2 max-h-40 overflow-auto text-sm">
        {errors.map((e, i) => (
          <li key={`${e.symbol}-${i}`} className="font-mono">
            {e.symbol} ({e.stage}): {e.message}
            {e.retryable ? " — retryable" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
