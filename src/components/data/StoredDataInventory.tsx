"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  countBarsInRange,
  deleteAllPriceData,
  deletePriceBarsInRange,
  deleteSymbol,
  deleteSymbols,
  listSymbolInventory,
  repairSymbolMetadata,
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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await repairSymbolMetadata();
      const inventory = await listSymbolInventory();
      setRows(inventory);
      setSelected((prev) => {
        const symbols = new Set(inventory.map((row) => row.symbol));
        return new Set([...prev].filter((symbol) => symbols.has(symbol)));
      });
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

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleSymbol = (symbol: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((row) => row.symbol)));
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;

    const symbols = [...selected].sort();
    const preview =
      symbols.length <= 5
        ? symbols.join(", ")
        : `${symbols.slice(0, 5).join(", ")} and ${symbols.length - 5} more`;

    if (
      !window.confirm(
        `Delete stored data for ${selected.size} symbol(s): ${preview}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusy("bulk");
    setError(null);
    try {
      await deleteSymbols(symbols);
      closeRangeDelete();
      setSelected(new Set());
      await loadInventory();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete selected symbols");
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteAll = async () => {
    if (rows.length === 0) return;

    if (
      !window.confirm(
        `Delete all stored price data (${rows.length} symbol(s), ${summary.totalBars.toLocaleString()} bars)? This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusy("all");
    setError(null);
    try {
      await deleteAllPriceData();
      closeRangeDelete();
      setSelected(new Set());
      await loadInventory();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete all data");
    } finally {
      setBusy(null);
    }
  };

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
    <section className="ui-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Inventory</p>
          <h2 className="ui-section-title mt-2">Stored data</h2>
          <p className="ui-helper mt-2">
            Symbols and date ranges saved in your browser. Delete a range or
            remove a symbol entirely.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadInventory()}
            disabled={loading || busy !== null}
            className="ui-btn-secondary disabled:opacity-50"
          >
            Refresh
          </button>
          {rows.length > 0 && (
            <>
              <button
                type="button"
                disabled={selected.size === 0 || busy !== null}
                onClick={() => void handleDeleteSelected()}
                className="rounded-full border border-danger/40 px-5 py-2.5 text-sm text-danger disabled:opacity-50"
              >
                Delete selected{selected.size > 0 ? ` (${selected.size})` : ""}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleDeleteAll()}
                className="rounded-full border border-danger/40 px-5 py-2.5 text-sm text-danger disabled:opacity-50"
              >
                Delete all data
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat label="Symbols" value={summary.symbolCount.toString()} tint="blue" />
        <SummaryStat
          label="Total bars"
          value={summary.totalBars.toLocaleString()}
          tint="orange"
        />
        <SummaryStat label="Earliest" value={formatDate(summary.earliest)} tint="purple" />
        <SummaryStat label="Latest" value={formatDate(summary.latest)} tint="green" />
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger">
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
          <table className="ui-table min-w-[48rem]">
            <thead>
              <tr>
                <th className="w-10 px-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleSelectAll}
                    disabled={busy !== null}
                    aria-label="Select all symbols"
                    className="h-4 w-4 rounded border-border"
                  />
                </th>
                <th>Symbol</th>
                <th>Bars</th>
                <th>From</th>
                <th>To</th>
                <th>Last updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.symbol}>
                  <tr>
                    <td className="px-2">
                      <input
                        type="checkbox"
                        checked={selected.has(row.symbol)}
                        onChange={() => toggleSymbol(row.symbol)}
                        disabled={busy !== null}
                        aria-label={`Select ${row.symbol}`}
                        className="h-4 w-4 rounded border-border"
                      />
                    </td>
                    <td className="font-mono font-semibold">
                      {row.symbol}
                    </td>
                    <td>{row.barCount.toLocaleString()}</td>
                    <td>{formatDate(row.fromDate)}</td>
                    <td>{formatDate(row.toDate)}</td>
                    <td className="text-body">
                      {formatUpdated(row.lastUpdated)}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => openRangeDelete(row)}
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:text-ink disabled:opacity-50"
                        >
                          Delete range
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
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
                      <td colSpan={7} className="px-2 py-4">
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

function SummaryStat({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: "orange" | "green" | "blue" | "purple";
}) {
  const tintClass =
    tint === "orange"
      ? "ui-stat-tint-orange"
      : tint === "green"
        ? "ui-stat-tint-green"
        : tint === "blue"
          ? "ui-stat-tint-blue"
          : "ui-stat-tint-purple";

  return (
    <div className={tintClass}>
      <div className="ui-field-label">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}
