"use client";

import Link from "next/link";
import { formatTimeframeModeLabel } from "@/lib/patterns/mtf-combine";
import type { IndicatorScanRun } from "@/lib/explore/indicator-models";

interface ExploreIndicatorResultsPanelProps {
  scan: IndicatorScanRun;
}

export function ExploreIndicatorResultsPanel({
  scan,
}: ExploreIndicatorResultsPanelProps) {
  const totalMatches = scan.groups.reduce(
    (sum, group) => sum + group.results.length,
    0,
  );

  return (
    <section className="space-y-6">
      <div className="ui-panel p-6">
        <p className="ui-eyebrow">Results</p>
        <h2 className="ui-section-title mt-2">Indicator scan results</h2>
        <p className="ui-helper mt-1">
          {scan.groups.length} indicator
          {scan.groups.length === 1 ? "" : "s"} scanned · {scan.universe.length}{" "}
          symbols · {totalMatches} total matches · {formatRunAt(scan.runAt)}
        </p>
      </div>

      {scan.groups.map((group) => (
        <div key={group.itemId} className="ui-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-ink">{group.itemName}</h3>
              <p className="text-sm text-muted">
                {formatTimeframeModeLabel(group.timeframeMode)} ·{" "}
                {group.results.length} match
                {group.results.length === 1 ? "" : "es"}
              </p>
            </div>
          </div>

          {group.results.length === 0 ? (
            <p className="ui-helper mt-4 rounded-xl border border-border-subtle px-4 py-8 text-center">
              No symbols matched this indicator today.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle">
              <table className="ui-table min-w-[480px]">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Signal</th>
                    <th>Last close</th>
                  </tr>
                </thead>
                <tbody>
                  {group.results.map((row) => (
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
      ))}
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
