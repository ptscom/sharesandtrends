"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTimeframeModeLabel } from "@/lib/patterns/mtf-combine";
import type { IndicatorScanRun } from "@/lib/explore/exploration-models";
import { listIndicatorScanRuns } from "@/lib/storage/indicator-scans";

interface ExplorationRunHistoryModalProps {
  open: boolean;
  filterKey: string;
  filterName: string;
  onClose: () => void;
  onSelectRun: (run: IndicatorScanRun) => void;
}

export function ExplorationRunHistoryModal({
  open,
  filterKey,
  filterName,
  onClose,
  onSelectRun,
}: ExplorationRunHistoryModalProps) {
  const [runs, setRuns] = useState<IndicatorScanRun[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void listIndicatorScanRuns(filterKey)
      .then(setRuns)
      .finally(() => setLoading(false));
  }, [open, filterKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const grouped = useMemo(() => groupRunsByDate(runs), [runs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        aria-label="Close run history"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[85vh] w-[min(96vw,520px)] flex-col rounded-[18px] border border-border bg-surface"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="ui-page-title text-base">Past runs</h2>
          <p className="ui-helper mt-0.5 text-xs">{filterName}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="ui-helper text-center py-8">Loading history…</p>
          ) : runs.length === 0 ? (
            <p className="ui-helper rounded-xl border border-border-subtle px-4 py-8 text-center">
              No past runs for this exploration yet. Run a scan to build
              history.
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map((group) => (
                <section key={group.dateKey}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    {group.dateLabel}
                  </p>
                  <ul className="space-y-2">
                    {group.runs.map((run) => (
                      <li key={run.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectRun(run);
                            onClose();
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition hover:border-brand/40 hover:bg-bg"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">
                              {formatTime(run.runAt)}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted">
                              {run.results.length} match
                              {run.results.length === 1 ? "" : "es"} ·{" "}
                              {run.universe.length} symbols ·{" "}
                              {formatTimeframeModeLabel(run.timeframeMode)}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-brand-text">
                            View →
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="ui-btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function groupRunsByDate(runs: IndicatorScanRun[]) {
  const groups = new Map<
    string,
    { dateKey: string; dateLabel: string; runs: IndicatorScanRun[] }
  >();

  for (const run of runs) {
    const date = new Date(run.runAt);
    const dateKey = date.toISOString().slice(0, 10);
    const dateLabel = date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const existing = groups.get(dateKey);
    if (existing) {
      existing.runs.push(run);
    } else {
      groups.set(dateKey, { dateKey, dateLabel, runs: [run] });
    }
  }

  return Array.from(groups.values());
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ExplorationHistoryIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
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
