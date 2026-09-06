"use client";

import { useMemo } from "react";
import { formatTimeframeModeLabel } from "@/lib/patterns/mtf-combine";
import type { IndicatorScanRun } from "@/lib/explore/exploration-models";
import { buildConsolidatedSummary } from "@/lib/explore/exploration-batch";

interface ExploreConsolidatedResultsPanelProps {
  runs: IndicatorScanRun[];
  onSelectRun: (scanId: string) => void;
}

export function ExploreConsolidatedResultsPanel({
  runs,
  onSelectRun,
}: ExploreConsolidatedResultsPanelProps) {
  const summary = useMemo(() => buildConsolidatedSummary(runs), [runs]);
  const runAt = runs[0]?.runAt;
  const universeCount = runs[0]?.universe.length ?? 0;
  const timeframeMode = runs[0]?.timeframeMode;

  return (
    <section className="space-y-6">
      <div className="ui-panel p-6">
        <p className="ui-eyebrow">Results</p>
        <h2 className="ui-section-title mt-2">Consolidated exploration report</h2>
        <p className="ui-helper mt-1">
          {summary.rows.length} exploration
          {summary.rows.length === 1 ? "" : "s"} ·{" "}
          {formatTimeframeModeLabel(timeframeMode ?? "1D")} · {universeCount}{" "}
          symbols · {summary.uniqueSymbolCount} unique match
          {summary.uniqueSymbolCount === 1 ? "" : "es"}
          {runAt ? ` · ${formatRunAt(runAt)}` : ""}
        </p>
        <p className="mt-2 text-sm text-muted">
          Review all explorations at a glance, then open any row for the full
          symbol table with 3d / 5d / 10d returns.
        </p>
      </div>

      <div className="ui-panel p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Explorations run"
            value={String(summary.rows.length)}
          />
          <StatCard
            label="Total matches"
            value={String(summary.totalMatches)}
          />
          <StatCard
            label="Unique symbols"
            value={String(summary.uniqueSymbolCount)}
          />
        </div>

        {summary.overlapCount > 0 && (
          <div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 p-4">
            <p className="text-sm font-medium text-ink">
              {summary.overlapCount} symbol
              {summary.overlapCount === 1 ? "" : "s"} matched multiple
              explorations
            </p>
            <p className="mt-1 text-sm text-muted">
              {summary.overlapSymbols.slice(0, 12).join(", ")}
              {summary.overlapSymbols.length > 12
                ? ` +${summary.overlapSymbols.length - 12} more`
                : ""}
            </p>
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle">
          <table className="ui-table min-w-[640px]">
            <thead>
              <tr>
                <th className="text-left">Exploration</th>
                <th className="text-right">Matches</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.scanId}>
                  <td>
                    <p className="font-medium text-ink">{row.filterName}</p>
                    <p className="mt-0.5 text-xs text-muted line-clamp-2">
                      {row.filterDescription}
                    </p>
                  </td>
                  <td className="text-right tabular-nums">{row.matchCount}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => onSelectRun(row.scanId)}
                      className="ui-btn-secondary text-sm"
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
        {value}
      </p>
    </div>
  );
}

function formatRunAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
