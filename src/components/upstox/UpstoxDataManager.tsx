"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSessionTokens } from "@/lib/upstox/client-tokens";
import {
  currentRowsToCsv,
  downloadTextFile,
  failuresToCsv,
  intradayRowsToCsv,
} from "@/lib/upstox/csv";
import { todayYmdIst } from "@/lib/upstox/current-day-schedule";
import {
  type HistoricalPreset,
  INTRADAY_INTERVAL_OPTIONS,
  type IntradayPreset,
  rangeFromIntradayPreset,
  rangeFromPreset,
  todayYmd,
} from "@/lib/upstox/date-ranges";
import { useUpstoxCurrentDayAutoRefresh } from "@/components/upstox/useUpstoxCurrentDayAutoRefresh";
import {
  downloadFilteredHistoricalCsv,
  downloadFullHistoricalCsv,
} from "@/lib/upstox/export-historical-csv";
import {
  collectJobErrors,
  computeProgress,
  createHistoricalJob,
  runHistoricalJob,
  type JobProgress,
} from "@/lib/upstox/historical-job-runner";
import {
  collectIntradayJobErrors,
  computeIntradayProgress,
  createIntradayJob,
  runIntradayJob,
} from "@/lib/upstox/intraday-job-runner";
import { parseSymbolList } from "@/lib/upstox/parse";
import type {
  CurrentPriceRow,
  HistoricalJob,
  HistoricalPriceRow,
  IntradayJob,
  IntradayPriceRow,
  UpstoxDataError,
} from "@/lib/upstox/types";
import { syncCurrentRowsToStores } from "@/lib/upstox/sync-to-prices";
import {
  countHistoricalStats,
  deleteHistoricalDatabase,
  deleteHistoricalSymbol,
  getLatestHistoricalJob,
  listIncompleteHistoricalJobs,
  queryHistoricalRows,
  saveHistoricalJob,
  syncAllUpstoxHistoricalToPrices,
} from "@/lib/storage/upstox-historical";
import {
  countIntradayStats,
  deleteIntradayDatabase,
  deleteIntradaySymbol,
  getLatestIntradayJob,
  listIncompleteIntradayJobs,
  queryIntradayRows,
  saveIntradayJob,
} from "@/lib/storage/upstox-intraday";

type Tab = "current" | "historical" | "intraday";
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
  const data = await res.json();
  return {
    rows: Array.isArray(data.rows) ? data.rows : [],
    errors: Array.isArray(data.errors) ? data.errors : [],
    activeLanes: data.activeLanes,
    requestCount: typeof data.requestCount === "number" ? data.requestCount : 0,
  };
}

export function UpstoxDataManager() {
  const [tab, setTab] = useState<Tab>("current");
  const [symbolMode, setSymbolMode] = useState<SymbolMode>("manual");
  const [manualSymbols, setManualSymbols] = useState("RELIANCE, TCS, INFY, M&M");
  const [top1000, setTop1000] = useState<string[]>([]);

  const [currentRows, setCurrentRows] = useState<CurrentPriceRow[]>([]);
  const [currentErrors, setCurrentErrors] = useState<UpstoxDataError[]>([]);
  const [currentTradingDate, setCurrentTradingDate] = useState(todayYmdIst());
  const [currentLoading, setCurrentLoading] = useState(false);
  const [autoRefreshToday, setAutoRefreshToday] = useState(true);
  const [lastCurrentFetchAt, setLastCurrentFetchAt] = useState<string | null>(
    null,
  );
  const [currentSearch, setCurrentSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);

  const [historicalPageRows, setHistoricalPageRows] = useState<HistoricalPriceRow[]>([]);
  const [historicalTotal, setHistoricalTotal] = useState(0);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [dbStats, setDbStats] = useState({ rowCount: 0, symbolCount: 0 });
  const [storeReady, setStoreReady] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
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
  const stopIntradayRef = useRef(false);
  const autoOpenedHistoricalRef = useRef(false);

  const [intradayPageRows, setIntradayPageRows] = useState<IntradayPriceRow[]>([]);
  const [intradayTotal, setIntradayTotal] = useState(0);
  const [intradayLoading, setIntradayLoading] = useState(false);
  const [intradayDbStats, setIntradayDbStats] = useState({ rowCount: 0, symbolCount: 0 });
  const [intradayPreset, setIntradayPreset] = useState<IntradayPreset>("5d");
  const [intradayFrom, setIntradayFrom] = useState("");
  const [intradayTo, setIntradayTo] = useState(todayYmd());
  const [intradayInterval, setIntradayInterval] = useState<number>(5);
  const [intradaySearch, setIntradaySearch] = useState("");
  const [intradayPage, setIntradayPage] = useState(0);
  const [intradayJob, setIntradayJob] = useState<IntradayJob | null>(null);
  const [intradayProgress, setIntradayProgress] = useState<JobProgress | null>(null);
  const [intradayErrors, setIntradayErrors] = useState<UpstoxDataError[]>([]);
  const [intradayRunning, setIntradayRunning] = useState(false);

  const loadHistoricalPage = useCallback(async () => {
    setHistoricalLoading(true);
    setStoreError(null);
    try {
      const { rows, total } = await queryHistoricalRows({
        page: histPage,
        pageSize: PAGE_SIZE,
        symbolQuery: histSearch,
      });
      setHistoricalPageRows(rows);
      setHistoricalTotal(total);
    } catch (e) {
      setStoreError(e instanceof Error ? e.message : "Failed to read stored data.");
      setHistoricalPageRows([]);
      setHistoricalTotal(0);
    } finally {
      setHistoricalLoading(false);
    }
  }, [histPage, histSearch]);

  const refreshHistoricalStore = useCallback(async () => {
    setStoreError(null);
    try {
      const stats = await countHistoricalStats();
      setDbStats(stats);
      const intradayStats = await countIntradayStats();
      setIntradayDbStats(intradayStats);
      if (stats.rowCount > 0 && !autoOpenedHistoricalRef.current) {
        autoOpenedHistoricalRef.current = true;
        setTab("historical");
      }
    } catch (e) {
      setStoreError(e instanceof Error ? e.message : "Failed to read IndexedDB.");
    } finally {
      setStoreReady(true);
    }
  }, []);

  const loadIntradayPage = useCallback(async () => {
    setIntradayLoading(true);
    setStoreError(null);
    try {
      const { rows, total } = await queryIntradayRows({
        page: intradayPage,
        pageSize: PAGE_SIZE,
        symbolQuery: intradaySearch,
        intervalMinutes: intradayInterval,
      });
      setIntradayPageRows(rows);
      setIntradayTotal(total);
    } catch (e) {
      setStoreError(e instanceof Error ? e.message : "Failed to read intraday data.");
      setIntradayPageRows([]);
      setIntradayTotal(0);
    } finally {
      setIntradayLoading(false);
    }
  }, [intradayPage, intradaySearch, intradayInterval]);

  useEffect(() => {
    void refreshHistoricalStore();
  }, [refreshHistoricalStore]);

  useEffect(() => {
    if (!storeReady) return;
    void loadHistoricalPage();
  }, [histPage, histSearch, storeReady, loadHistoricalPage]);

  useEffect(() => {
    if (!storeReady) return;
    void loadIntradayPage();
  }, [intradayPage, intradaySearch, intradayInterval, storeReady, loadIntradayPage]);

  useEffect(() => {
    void (async () => {
      const incomplete = await listIncompleteHistoricalJobs();
      const job =
        incomplete.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
        (await getLatestHistoricalJob());
      if (!job) return;
      setHistJob(job);
      setHistProgress(computeProgress(job, 1));
      setHistErrors(collectJobErrors(job));
    })();
    void fetch("/top1000.json")
      .then((r) => r.json())
      .then((data: { symbols?: string[] }) => {
        if (Array.isArray(data.symbols)) setTop1000(data.symbols);
      })
      .catch(() => undefined);
    void (async () => {
      const incomplete = await listIncompleteIntradayJobs();
      const job =
        incomplete.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
        (await getLatestIntradayJob());
      if (!job) return;
      setIntradayJob(job);
      setIntradayProgress(computeIntradayProgress(job, 1));
      setIntradayErrors(collectIntradayJobErrors(job));
    })();
  }, []);

  const resolvedSymbols = useMemo(() => {
    if (symbolMode === "top1000") return top1000;
    return parseSymbolList(manualSymbols);
  }, [symbolMode, manualSymbols, top1000]);

  const fetchCurrent = useCallback(
    async (options?: { background?: boolean }) => {
      if (resolvedSymbols.length === 0) return;
      if (currentLoading && !options?.background) return;
      if (!options?.background) setCurrentLoading(true);
      if (!options?.background) setCurrentErrors([]);
      try {
        const data = await postUpstox<CurrentPriceRow>({
          mode: "current",
          symbols: resolvedSymbols,
        });
        const tradingDate = todayYmdIst();
        setCurrentRows(data.rows);
        if (!options?.background) setCurrentErrors(data.errors);
        else if (data.errors.length > 0) setCurrentErrors(data.errors);
        setCurrentTradingDate(tradingDate);
        await syncCurrentRowsToStores(data.rows, tradingDate);
        setLastCurrentFetchAt(new Date().toISOString());
        await refreshHistoricalStore();
        await loadHistoricalPage();
      } catch {
        if (!options?.background) {
          setCurrentErrors([
            {
              symbol: "*",
              stage: "quote",
              message: "Failed to reach Upstox API route.",
              retryable: true,
            },
          ]);
        }
      } finally {
        if (!options?.background) setCurrentLoading(false);
      }
    },
    [currentLoading, resolvedSymbols, refreshHistoricalStore, loadHistoricalPage],
  );

  useUpstoxCurrentDayAutoRefresh({
    enabled: autoRefreshToday,
    symbolCount: resolvedSymbols.length,
    onTick: () => fetchCurrent({ background: true }),
  });

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
    setHistPage(0);
    await refreshHistoricalStore();
    await loadHistoricalPage();
  }, [
    histRunning,
    resolvedSymbols,
    histPreset,
    histFrom,
    histTo,
    refreshHistoricalStore,
    loadHistoricalPage,
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
    await loadHistoricalPage();
  }, [histJob, histRunning, refreshHistoricalStore, loadHistoricalPage]);

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
    await loadHistoricalPage();
  }, [histJob, histRunning, refreshHistoricalStore, loadHistoricalPage]);

  const stopHistorical = () => {
    stopRef.current = true;
  };

  const startIntradayJob = useCallback(async () => {
    if (intradayRunning || resolvedSymbols.length === 0) return;
    const range = rangeFromIntradayPreset(
      intradayPreset,
      intradayPreset === "custom" ? intradayFrom : undefined,
      intradayPreset === "custom" ? intradayTo : intradayTo,
    );
    if (range.error || !range.fromDate) {
      window.alert(range.error ?? "Invalid date range");
      return;
    }

    const job = createIntradayJob(
      resolvedSymbols,
      range.fromDate,
      range.toDate,
      intradayInterval,
    );
    await saveIntradayJob(job);
    setIntradayJob(job);
    setIntradayErrors([]);
    setIntradayRunning(true);
    stopIntradayRef.current = false;

    const finished = await runIntradayJob(job, {
      shouldStop: () => stopIntradayRef.current,
      onProgress: (progress, updated) => {
        setIntradayProgress(progress);
        setIntradayJob({ ...updated });
      },
    });
    setIntradayJob(finished);
    setIntradayErrors(collectIntradayJobErrors(finished));
    setIntradayRunning(false);
    setIntradayPage(0);
    await refreshHistoricalStore();
    await loadIntradayPage();
  }, [
    intradayRunning,
    resolvedSymbols,
    intradayPreset,
    intradayFrom,
    intradayTo,
    intradayInterval,
    refreshHistoricalStore,
    loadIntradayPage,
  ]);

  const resumeIntradayJob = useCallback(async () => {
    if (!intradayJob || intradayRunning) return;
    setIntradayRunning(true);
    stopIntradayRef.current = false;
    const finished = await runIntradayJob(intradayJob, {
      shouldStop: () => stopIntradayRef.current,
      onProgress: (progress, updated) => {
        setIntradayProgress(progress);
        setIntradayJob({ ...updated });
      },
    });
    setIntradayJob(finished);
    setIntradayErrors(collectIntradayJobErrors(finished));
    setIntradayRunning(false);
    await refreshHistoricalStore();
    await loadIntradayPage();
  }, [intradayJob, intradayRunning, refreshHistoricalStore, loadIntradayPage]);

  const retryFailedIntraday = useCallback(async () => {
    if (!intradayJob || intradayRunning) return;
    const failed = intradayJob.failedSymbols.filter((f) => f.retryable).map((f) => f.symbol);
    if (failed.length === 0) return;
    setIntradayRunning(true);
    stopIntradayRef.current = false;
    const finished = await runIntradayJob(intradayJob, {
      symbols: failed,
      shouldStop: () => stopIntradayRef.current,
      onProgress: (progress, updated) => {
        setIntradayProgress(progress);
        setIntradayJob({ ...updated });
      },
    });
    setIntradayJob(finished);
    setIntradayErrors(collectIntradayJobErrors(finished));
    setIntradayRunning(false);
    await refreshHistoricalStore();
    await loadIntradayPage();
  }, [intradayJob, intradayRunning, refreshHistoricalStore, loadIntradayPage]);

  const stopIntraday = () => {
    stopIntradayRef.current = true;
  };

  const filteredCurrent = useMemo(() => {
    const q = currentSearch.trim().toUpperCase();
    const rows = q
      ? currentRows.filter((r) => r.symbol.includes(q))
      : currentRows;
    return rows;
  }, [currentRows, currentSearch]);

  const currentPageRows = filteredCurrent.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const estCompletionNote =
    histProgress && histProgress.remaining > 0
      ? `~${Math.ceil(histProgress.remaining / Math.max(1, histProgress.activeLanes))} symbol batches remaining (estimate varies with throttling).`
      : null;
  const intradayEstNote =
    intradayProgress && intradayProgress.remaining > 0
      ? `~${Math.ceil(intradayProgress.remaining / Math.max(1, intradayProgress.activeLanes))} symbol batches remaining (estimate varies with throttling).`
      : null;

  return (
    <div className="space-y-6">
      <section className="ui-panel p-4">
        <p className="text-sm">
          <span className="font-semibold">Stored EOD:</span>{" "}
          {storeReady
            ? `EOD ${dbStats.rowCount.toLocaleString()} rows · ${dbStats.symbolCount} symbols · Intraday ${intradayDbStats.rowCount.toLocaleString()} rows · ${intradayDbStats.symbolCount} symbols`
            : "Loading…"}
          {dbStats.rowCount > 0 && tab === "current" && (
            <span className="text-muted">
              {" "}
              — data is on the <strong>Upstox EOD Historical</strong> tab (Current
              Day is not saved across refresh).
            </span>
          )}
        </p>
        {storeError && (
          <p className="mt-2 text-sm text-danger">{storeError}</p>
        )}
      </section>

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
        <button
          type="button"
          className={`ui-btn-secondary${tab === "intraday" ? " ring-2 ring-brand" : ""}`}
          onClick={() => setTab("intraday")}
        >
          Upstox Intraday Historical
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
            Fixed Top 1,000 ({top1000.length} loaded
            {top1000.length > 0 && top1000.length < 1000 ? " — list incomplete" : ""})
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
              Live OHLC from Upstox `live_ohlc` (not tick-by-tick). Trading date
              (IST): {currentTradingDate}. Each fetch writes today&apos;s bar to{" "}
              <span className="font-mono">upstoxHistorical</span> and{" "}
              <span className="font-mono">prices</span> in IndexedDB (not only this
              screen). Historical EOD later overwrites the same date. API keys stay
              in session storage only.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefreshToday}
                onChange={(e) => setAutoRefreshToday(e.target.checked)}
              />
              Auto-refresh today every 30 min from 9:45 AM IST (weekdays, while
              this page is open and visible)
            </label>
            {lastCurrentFetchAt && (
              <p className="ui-helper mt-2">
                Last current-day fetch:{" "}
                {new Date(lastCurrentFetchAt).toLocaleString(undefined, {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                IST
              </p>
            )}
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
                  void downloadFullHistoricalCsv(`upstox-eod-all-${todayYmd()}.csv`)
                }
              >
                Download full EOD database CSV
              </button>
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={historicalTotal === 0}
                onClick={() =>
                  void downloadFilteredHistoricalCsv(
                    `upstox-eod-filtered-${todayYmd()}.csv`,
                    histSearch,
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
              rows={historicalPageRows}
              emptyLabel={
                historicalLoading
                  ? "Loading stored rows…"
                  : dbStats.rowCount > 0
                    ? "No rows match this search."
                    : "No stored EOD rows yet."
              }
            />
            <Pagination
              page={histPage}
              total={historicalTotal}
              pageSize={PAGE_SIZE}
              onChange={setHistPage}
            />
            <ErrorsPanel errors={histErrors} />
          </section>
        </>
      )}

      {tab === "intraday" && (
        <>
          <section className="ui-panel p-6">
            <h2 className="ui-section-title">Upstox Intraday Historical</h2>
            <p className="ui-helper mt-2">
              Minute OHLC from Upstox V3{" "}
              <span className="font-mono">/historical-candle/…/minutes/{"{interval}"}</span>.
              Stored in IndexedDB (<span className="font-mono">upstoxIntradayHistorical</span>);
              not merged into the daily backtest <span className="font-mono">prices</span> store.
              Upstox limits: ≤15‑min bars ≈1 month per request; wider intervals ≈1 quarter.
            </p>
            <p className="ui-helper mt-2">
              Database: {intradayDbStats.rowCount.toLocaleString()} bars across{" "}
              {intradayDbStats.symbolCount} symbols.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="ui-field-label">Bar interval</span>
              {INTRADAY_INTERVAL_OPTIONS.map((m) => (
                <label key={m} className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    checked={intradayInterval === m}
                    onChange={() => {
                      setIntradayInterval(m);
                      setIntradayPage(0);
                    }}
                  />
                  {m} min
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {(["5d", "1m", "custom"] as IntradayPreset[]).map((p) => (
                <label key={p} className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    checked={intradayPreset === p}
                    onChange={() => setIntradayPreset(p)}
                  />
                  {p === "5d" ? "Last 5 days" : p === "1m" ? "Last 1 month" : "Custom"}
                </label>
              ))}
            </div>
            {intradayPreset === "custom" && (
              <div className="mt-4 flex flex-wrap gap-4">
                <label>
                  <span className="ui-field-label">From</span>
                  <input
                    type="date"
                    className="ui-input mt-1"
                    value={intradayFrom}
                    onChange={(e) => setIntradayFrom(e.target.value)}
                  />
                </label>
                <label>
                  <span className="ui-field-label">To</span>
                  <input
                    type="date"
                    className="ui-input mt-1"
                    value={intradayTo}
                    onChange={(e) => setIntradayTo(e.target.value)}
                  />
                </label>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="ui-btn-primary"
                disabled={intradayRunning || resolvedSymbols.length === 0}
                onClick={() => void startIntradayJob()}
              >
                {intradayRunning ? "Running job…" : "Fetch intraday historical"}
              </button>
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={!intradayRunning}
                onClick={stopIntraday}
              >
                Stop
              </button>
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={!intradayJob || intradayRunning || intradayJob.complete}
                onClick={() => void resumeIntradayJob()}
              >
                Resume
              </button>
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={!intradayJob || intradayRunning}
                onClick={() => void retryFailedIntraday()}
              >
                Retry failed symbols
              </button>
            </div>
            {intradayProgress && (
              <div className="mt-4 text-sm text-muted">
                <p>
                  Progress: {intradayProgress.percent}% — {intradayProgress.completed} /{" "}
                  {intradayProgress.total} symbols ({intradayProgress.failed} failed,{" "}
                  {intradayProgress.activeLanes} worker lane
                  {intradayProgress.activeLanes === 1 ? "" : "s"})
                </p>
                {intradayEstNote && <p className="mt-1">{intradayEstNote}</p>}
                {intradayProgress.stopped && (
                  <p className="mt-1 text-muted">Job stopped by user.</p>
                )}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="ui-btn-secondary"
                disabled={intradayPageRows.length === 0}
                onClick={() =>
                  downloadTextFile(
                    `upstox-intraday-${intradayInterval}m-${todayYmd()}.csv`,
                    intradayRowsToCsv(intradayPageRows),
                  )
                }
              >
                Download current page CSV
              </button>
              {intradayErrors.length > 0 && (
                <button
                  type="button"
                  className="ui-btn-secondary"
                  onClick={() =>
                    downloadTextFile(
                      `upstox-intraday-failures-${todayYmd()}.csv`,
                      failuresToCsv(intradayErrors),
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
                  const sym = window.prompt("Delete intraday rows for symbol (e.g. RELIANCE)");
                  if (!sym) return;
                  void deleteIntradaySymbol(sym.trim().toUpperCase()).then(() => {
                    void refreshHistoricalStore();
                    void loadIntradayPage();
                  });
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
                      "Delete the entire Upstox intraday historical database in this browser?",
                    )
                  ) {
                    void deleteIntradayDatabase().then(() => {
                      void refreshHistoricalStore();
                      void loadIntradayPage();
                    });
                    setIntradayJob(null);
                    setIntradayProgress(null);
                  }
                }}
              >
                Delete intraday database
              </button>
            </div>
            <label className="mt-4 block">
              <span className="ui-field-label">Search symbol</span>
              <input
                className="ui-input mt-1 max-w-xs"
                value={intradaySearch}
                onChange={(e) => {
                  setIntradaySearch(e.target.value);
                  setIntradayPage(0);
                }}
              />
            </label>
            <PriceTable
              mode="intraday"
              rows={intradayPageRows}
              emptyLabel={
                intradayLoading
                  ? "Loading stored bars…"
                  : intradayDbStats.rowCount > 0
                    ? "No bars match this search or interval."
                    : "No stored intraday bars yet."
              }
            />
            <Pagination
              page={intradayPage}
              total={intradayTotal}
              pageSize={PAGE_SIZE}
              onChange={setIntradayPage}
            />
            <ErrorsPanel errors={intradayErrors} />
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
  if (total === 0) return null;
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
  mode: "current" | "historical" | "intraday";
  rows: (CurrentPriceRow | HistoricalPriceRow | IntradayPriceRow)[];
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
            {mode === "intraday" && <th className="py-2">Timestamp</th>}
            <th className="py-2">Open</th>
            <th className="py-2">High</th>
            <th className="py-2">Low</th>
            <th className="py-2">Close</th>
            <th className="py-2">Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={
                mode === "historical"
                  ? `${row.symbol}-${(row as HistoricalPriceRow).date}`
                  : mode === "intraday"
                    ? `${row.symbol}-${(row as IntradayPriceRow).timestamp}`
                    : row.symbol
              }
            >
              <td className="font-mono font-semibold">{row.symbol}</td>
              {mode === "historical" && (
                <td className="font-mono">{(row as HistoricalPriceRow).date}</td>
              )}
              {mode === "intraday" && (
                <td className="font-mono text-xs">{(row as IntradayPriceRow).timestamp}</td>
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
