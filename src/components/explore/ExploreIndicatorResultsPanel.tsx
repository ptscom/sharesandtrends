"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatTimeframeModeLabel } from "@/lib/patterns/mtf-combine";
import type {
  HorizonStats,
  IndicatorScanResultRow,
  IndicatorScanRun,
} from "@/lib/explore/exploration-models";

type SortMode = "performance" | "symbol";

interface ExploreIndicatorResultsPanelProps {
  scan: IndicatorScanRun;
  onOpenHistory?: () => void;
}

export function ExploreIndicatorResultsPanel({
  scan,
  onOpenHistory,
}: ExploreIndicatorResultsPanelProps) {
  const [sortMode, setSortMode] = useState<SortMode>("performance");
  const [symbolAsc, setSymbolAsc] = useState(true);

  const sortedResults = useMemo(
    () => sortExplorationResults(scan.results, sortMode, symbolAsc),
    [scan.results, sortMode, symbolAsc],
  );

  const cycleSymbolSort = () => {
    if (sortMode === "performance") {
      setSortMode("symbol");
      setSymbolAsc(true);
      return;
    }
    if (symbolAsc) {
      setSymbolAsc(false);
      return;
    }
    setSortMode("performance");
    setSymbolAsc(true);
  };

  return (
    <section className="space-y-6">
      <div className="ui-panel p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ui-eyebrow">Results</p>
            <h2 className="ui-section-title mt-2">Exploration results</h2>
            <p className="ui-helper mt-1">
              {scan.filterName} · {formatTimeframeModeLabel(scan.timeframeMode)} ·{" "}
              {scan.universe.length} symbols · {scan.results.length} match
              {scan.results.length === 1 ? "" : "es"} · {formatRunAt(scan.runAt)}
            </p>
            <p className="mt-2 text-sm text-muted">{scan.filterDescription}</p>
          </div>
          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:border-brand hover:text-ink"
              aria-label="View past runs"
              title="Past runs"
            >
              <HistoryClockIcon />
            </button>
          )}
        </div>
      </div>

      <div className="ui-panel p-6">
        {scan.results.length === 0 ? (
          <p className="ui-helper rounded-xl border border-border-subtle px-4 py-8 text-center">
            No symbols matched this filter today.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="ui-table min-w-[720px]">
              <thead>
                <tr>
                  <th className="px-4">
                    <button
                      type="button"
                      onClick={cycleSymbolSort}
                      className={`inline-flex items-center gap-1 font-semibold transition hover:text-brand-text ${
                        sortMode === "symbol" ? "text-brand-text" : ""
                      }`}
                      aria-label={
                        sortMode === "performance"
                          ? "Sort by symbol A to Z"
                          : sortMode === "symbol" && symbolAsc
                            ? "Sort by symbol Z to A"
                            : "Sort by best 3d, 5d, 10d return"
                      }
                      title={
                        sortMode === "performance"
                          ? "Sort by symbol"
                          : sortMode === "symbol" && symbolAsc
                            ? "Symbol Z–A"
                            : "Best fit (3d → 5d → 10d)"
                      }
                    >
                      Symbol
                      <SortArrow
                        active={sortMode === "symbol"}
                        asc={symbolAsc}
                      />
                    </button>
                  </th>
                  <th>Signal</th>
                  <th>Last close</th>
                  <th>3d return</th>
                  <th>5d return</th>
                  <th>10d return</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((row) => (
                  <tr key={row.symbol}>
                    <td className="px-4 align-top">
                      <Link
                        href={`/symbol/${row.symbol}`}
                        className="font-mono text-sm font-semibold text-brand-text hover:underline"
                      >
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="px-4 align-top">
                      <span className="ui-badge bg-brand-light text-brand-text">
                        Today
                      </span>
                    </td>
                    <td className="px-4 align-top tabular-nums">
                      {row.lastClose.toFixed(2)}
                    </td>
                    <HorizonCell stats={row.horizons?.d3} />
                    <HorizonCell stats={row.horizons?.d5} />
                    <HorizonCell stats={row.horizons?.d10} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function sortExplorationResults(
  rows: IndicatorScanResultRow[],
  sortMode: SortMode,
  symbolAsc: boolean,
): IndicatorScanResultRow[] {
  const sorted = [...rows];

  if (sortMode === "symbol") {
    sorted.sort((a, b) => {
      const cmp = a.symbol.localeCompare(b.symbol);
      return symbolAsc ? cmp : -cmp;
    });
    return sorted;
  }

  sorted.sort((a, b) => {
    const d3 = compareHorizonReturn(b, a, "d3");
    if (d3 !== 0) return d3;
    const d5 = compareHorizonReturn(b, a, "d5");
    if (d5 !== 0) return d5;
    return compareHorizonReturn(b, a, "d10");
  });

  return sorted;
}

function compareHorizonReturn(
  a: IndicatorScanResultRow,
  b: IndicatorScanResultRow,
  key: "d3" | "d5" | "d10",
): number {
  const aReturn = a.horizons?.[key]?.avgReturnPct ?? Number.NEGATIVE_INFINITY;
  const bReturn = b.horizons?.[key]?.avgReturnPct ?? Number.NEGATIVE_INFINITY;
  return aReturn - bReturn;
}

function HorizonCell({ stats }: { stats?: HorizonStats }) {
  if (!stats || stats.trades === 0) {
    return (
      <td className="px-4 align-top tabular-nums text-muted">
        <span>—</span>
      </td>
    );
  }

  const positive = stats.avgReturnPct >= 0;

  return (
    <td className="px-4 align-top tabular-nums">
      <div
        className={`text-sm font-medium ${
          positive ? "text-success" : "text-danger"
        }`}
      >
        {positive ? "+" : ""}
        {stats.avgReturnPct.toFixed(2)}%
      </div>
      <div className="mt-0.5 text-[11px] text-muted">
        {stats.winRate.toFixed(0)}% ({stats.trades})
      </div>
    </td>
  );
}

function SortArrow({ active, asc }: { active: boolean; asc: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`shrink-0 ${active ? "text-brand-text" : "text-muted"}`}
      aria-hidden
    >
      {asc ? (
        <path
          d="M6 2.5v7M6 2.5L3.5 5M6 2.5L8.5 5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M6 9.5v-7M6 9.5L3.5 7M6 9.5L8.5 7"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function formatRunAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HistoryClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M8 5v3.25l2 1.25"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
