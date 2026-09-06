"use client";

import { useMemo, useState } from "react";
import type {
  IndicatorScanResultRow,
  IndicatorScanRun,
} from "@/lib/explore/exploration-models";
import {
  downloadExplorationSnapshot,
  renderExplorationSnapshotPng,
} from "@/lib/explore/exploration-snapshot-image";
import {
  filterSnapshotRows,
  SNAPSHOT_HORIZON_COLUMNS,
  type SnapshotColumnFilter,
} from "@/lib/explore/exploration-snapshot";

interface ExplorationSnapshotSettingsProps {
  scan: IndicatorScanRun;
  rows: IndicatorScanResultRow[];
}

export function ExplorationSnapshotSettings({
  scan,
  rows,
}: ExplorationSnapshotSettingsProps) {
  const [columns, setColumns] = useState<SnapshotColumnFilter[]>(() =>
    SNAPSHOT_HORIZON_COLUMNS.map((column) => ({ ...column })),
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredRows = useMemo(
    () => filterSnapshotRows(rows, columns),
    [rows, columns],
  );

  const updateColumn = (
    key: SnapshotColumnFilter["key"],
    patch: Partial<SnapshotColumnFilter>,
  ) => {
    setColumns((prev) =>
      prev.map((column) =>
        column.key === key ? { ...column, ...patch } : column,
      ),
    );
  };

  const handleGenerate = async () => {
    if (filteredRows.length === 0) {
      setError("No symbols match your snapshot filters.");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const blob = await renderExplorationSnapshotPng({
        scan,
        rows: filteredRows,
        columns,
      });
      downloadExplorationSnapshot(blob, scan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate image");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-border bg-bg/60 p-5">
      <p className="text-sm font-semibold text-ink">Snapshot settings</p>
      <p className="mt-1 text-sm text-muted">
        Filter by win rate or return on each horizon column, then download a PNG
        table for Twitter or social media.
      </p>

      <div className="mt-4 space-y-3">
        {columns.map((column) => (
          <div
            key={column.key}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5"
          >
            <label className="flex min-w-[7rem] items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={column.enabled}
                onChange={(e) =>
                  updateColumn(column.key, { enabled: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              {column.label}
            </label>
            <label className="flex items-center gap-2 text-sm text-body">
              <span className="text-muted">Win %</span>
              <input
                type="text"
                value={column.minWinRate}
                onChange={(e) =>
                  updateColumn(column.key, { minWinRate: e.target.value })
                }
                placeholder=">70"
                className="ui-input w-20 py-1.5 text-sm"
                disabled={!column.enabled}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-body">
              <span className="text-muted">Return %</span>
              <input
                type="text"
                value={column.minReturnPct}
                onChange={(e) =>
                  updateColumn(column.key, { minReturnPct: e.target.value })
                }
                placeholder=">5"
                className="ui-input w-20 py-1.5 text-sm"
                disabled={!column.enabled}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={generating || filteredRows.length === 0}
          onClick={() => void handleGenerate()}
          className="ui-btn-primary disabled:opacity-50"
        >
          {generating ? "Generating…" : "Download snapshot PNG"}
        </button>
        <p className="text-sm text-muted">
          {filteredRows.length} of {rows.length} symbol
          {rows.length === 1 ? "" : "s"} will appear in the image
        </p>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
