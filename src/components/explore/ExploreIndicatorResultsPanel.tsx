"use client";

import Link from "next/link";
import { formatTimeframeModeLabel } from "@/lib/patterns/mtf-combine";
import type { IndicatorScanRun } from "@/lib/explore/exploration-models";

interface ExploreIndicatorResultsPanelProps {
  scan: IndicatorScanRun;
  onOpenHistory?: () => void;
}

export function ExploreIndicatorResultsPanel({
  scan,
  onOpenHistory,
}: ExploreIndicatorResultsPanelProps) {
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
            <table className="ui-table min-w-[480px]">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Signal</th>
                  <th>Last close</th>
                </tr>
              </thead>
              <tbody>
                {scan.results.map((row) => (
                  <tr key={row.symbol}>
                    <td className="px-4">
                      <Link
                        href={`/symbol/${row.symbol}`}
                        className="font-mono text-sm font-semibold text-brand-text hover:underline"
                      >
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="px-4">
                      <span className="ui-badge bg-brand-light text-brand-text">
                        Today
                      </span>
                    </td>
                    <td className="px-4 tabular-nums">
                      {row.lastClose.toFixed(2)}
                    </td>
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
