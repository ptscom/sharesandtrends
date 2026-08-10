"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  countBarsInRange,
  deletePriceBarsInRange,
  deleteSymbol,
  listSymbolInventory,
  type SymbolInventoryRow,
} from "@/lib/storage/prices";

interface StoredDataInventoryProps {
  refreshKey: number;
  onChanged?: () => void;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return value;
}

function formatUpdated(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function StoredDataInventory({
  refreshKey,
  onChanged,
}: StoredDataInventoryProps) {
  const [rows, setRows] = useState<SymbolInventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeTarget, setRangeTarget] = useState<SymbolInventoryRow | null>(
    null,
  );
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeCount, setRangeCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inventory = await listSymbolInventory();
      setRows(inventory);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stored data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory, refreshKey]);

  const summary = useMemo(() => {
    const totalBars = rows.reduce((sum, row) => sum + row.barCount, 0);
    const fromDates = rows
      .map((row) => row.fromDate)
      .filter((d): d is string => Boolean(d));
    const toDates = rows
      .map((row) => row.toDate)
      .filter((d): d is string => Boolean(d));
    return {
      symbolCount: rows.length,
      totalBars,
      earliest:
        fromDates.length > 0
          ? fromDates.reduce((a, b) => (a < b ? a : b))
          : null,
      latest:
        toDates.length > 0 ? toDates.reduce((a, b) => (a > b ? a : b)) : null,
    };
  }, [rows]);

  const openRangeDelete = (row: SymbolInventoryRow) => {
    setRangeTarget(row);
    setRangeFrom(row.fromDate ?? "");
    setRangeTo(row.toDate ?? "");
    setRangeCount(null);
  };

  const closeRangeDelete = () => {
    setRangeTarget(null);
    setRangeFrom("");
    setRangeTo("");
    setRangeCount(null);
  };

  useEffect(() => {
    if (!rangeTarget || !rangeFrom || !rangeTo || rangeFrom > rangeTo) {
      setRangeCount(null);
      return;
    }

    let cancelled = false;
    void countBarsInRange(rangeTarget.symbol, rangeFrom, rangeTo).then(
      (count) => {
        if (!cancelled) setRangeCount(count);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [rangeTarget, rangeFrom, rangeTo]);

  const handleDeleteSymbol = async (symbol: string) => {
    if (
      !window.confirm(
        `Delete all stored data for ${symbol}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusy(symbol);
    try {
      await deleteSymbol(symbol);
      closeRangeDelete();
      await loadInventory();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete symbol");
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteRange = async () => {
    if (!rangeTarget || !rangeFrom || !rangeTo) return;

    if (rangeFrom > rangeTo) {
      setError("Start date must be on or before end date.");
      return;
    }

    const count =
      rangeCount ??
      (await countBarsInRange(rangeTarget.symbol, rangeFrom, rangeTo));

    if (count === 0) {
      setError("No bars found in that date range.");
      return;
    }

    if (
      !window.confirm(
        `Delete ${count.toLocaleString()} bar(s) for ${rangeTarget.symbol} from ${rangeFrom} to ${rangeTo}?`,
      )
    ) {
      return;
    }

    setBusy(rangeTarget.symbol);
    try {
      await deletePriceBarsInRange(rangeTarget.symbol, rangeFrom, rangeTo);
      closeRangeDelete();
      await loadInventory();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete date range");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="ui-panel p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="ui-page-title">Stored data</h2>
          <p className="ui-helper mt-2">
            Symbols and date ranges saved in your browser. Delete a range or
            remove a symbol entirely.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadInventory()}
          disabled={loading}
          className="ui-btn-secondary disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat label="Symbols" value={summary.symbolCount.toString()} />
        <SummaryStat
          label="Total bars"
          value={summary.totalBars.toLocaleString()}
        />
        <SummaryStat label="Earliest" value={formatDate(summary.earliest)} />
        <SummaryStat label="Latest" value={formatDate(summary.latest)} />
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="ui-helper mt-6">Loading stored data…</p>
      ) : rows.length === 0 ? (
        <p className="ui-helper mt-6">
          No price data stored yet. Download symbols below to populate your
          local database.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4">Symbol</th>
                <th className="py-2 pr-4">Bars</th>
                <th className="py-2 pr-4">From</th>
                <th className="py-2 pr-4">To</th>
                <th className="py-2 pr-4">Last updated</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.symbol}>
                  <tr className="border-b border-border/40">
                    <td className="py-3 pr-4 font-mono font-semibold">
                      {row.symbol}
                    </td>
                    <td className="py-3 pr-4">{row.barCount.toLocaleString()}</td>
                    <td className="py-3 pr-4">{formatDate(row.fromDate)}</td>
                    <td className="py-3 pr-4">{formatDate(row.toDate)}</td>
                    <td className="py-3 pr-4 text-muted">
                      {formatUpdated(row.lastUpdated)}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy === row.symbol}
                          onClick={() => openRangeDelete(row)}
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:text-ink disabled:opacity-50"
                        >
                          Delete range
                        </button>
                        <button
                          type="button"
                          disabled={busy === row.symbol}
                          onClick={() => void handleDeleteSymbol(row.symbol)}
                          className="rounded-full border border-danger/40 px-3 py-1 text-xs text-danger disabled:opacity-50"
                        >
                          Delete all
                        </button>
                      </div>
                    </td>
                  </tr>
                  {rangeTarget?.symbol === row.symbol && (
                    <tr className="border-b border-border/40 bg-bg/60">
                      <td colSpan={6} className="px-2 py-4">
                        <div className="rounded-xl border border-border bg-surface p-4">
                          <p className="ui-section-title">
                            Delete date range for {row.symbol}
                          </p>
                          <p className="ui-helper mt-1">
                            Stored range: {formatDate(row.fromDate)} →{" "}
                            {formatDate(row.toDate)}
                          </p>
                          <div className="mt-4 flex flex-wrap items-end gap-4">
                            <label className="block">
                              <span className="ui-field-label">From</span>
                              <input
                                type="date"
                                value={rangeFrom}
                                min={row.fromDate ?? undefined}
                                max={row.toDate ?? undefined}
                                onChange={(e) => setRangeFrom(e.target.value)}
                                className="ui-input mt-1 w-auto min-w-[10rem]"
                              />
                            </label>
                            <label className="block">
                              <span className="ui-field-label">To</span>
                              <input
                                type="date"
                                value={rangeTo}
                                min={row.fromDate ?? undefined}
                                max={row.toDate ?? undefined}
                                onChange={(e) => setRangeTo(e.target.value)}
                                className="ui-input mt-1 w-auto min-w-[10rem]"
                              />
                            </label>
                            <p className="ui-helper pb-2">
                              {rangeCount === null
                                ? "Select a valid range"
                                : `${rangeCount.toLocaleString()} bar(s) in range`}
                            </p>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={
                                busy === row.symbol ||
                                !rangeFrom ||
                                !rangeTo ||
                                rangeFrom > rangeTo ||
                                rangeCount === 0
                              }
                              onClick={() => void handleDeleteRange()}
                              className="rounded-full border border-danger/40 px-4 py-2 text-sm text-danger disabled:opacity-50"
                            >
                              Delete selected range
                            </button>
                            <button
                              type="button"
                              onClick={closeRangeDelete}
                              className="ui-btn-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-stat">
      <div className="ui-field-label">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
