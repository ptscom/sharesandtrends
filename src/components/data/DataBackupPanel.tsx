"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createManualBackup,
  deleteManualBackup,
  listManualBackups,
  restoreManualBackup,
  type BackupSummary,
} from "@/lib/storage/backup";

interface DataBackupPanelProps {
  refreshKey: number;
  onRestored?: () => void;
}

export function DataBackupPanel({
  refreshKey,
  onRestored,
}: DataBackupPanelProps) {
  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  const loadBackups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listManualBackups();
      setBackups(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load backups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups, refreshKey]);

  const handleCreate = async () => {
    setBusy("create");
    setError(null);
    try {
      await createManualBackup(label);
      setLabel("");
      await loadBackups();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create backup");
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async (backup: BackupSummary) => {
    if (
      !window.confirm(
        `Restore backup "${backup.label}"? This replaces all current price data, patterns, and scans in your browser with this snapshot.`,
      )
    ) {
      return;
    }

    setBusy(backup.id);
    setError(null);
    try {
      await restoreManualBackup(backup.id);
      onRestored?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore backup");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (backup: BackupSummary) => {
    if (
      !window.confirm(
        `Delete backup "${backup.label}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusy(backup.id);
    setError(null);
    try {
      await deleteManualBackup(backup.id);
      await loadBackups();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete backup");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="ui-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Backup</p>
          <h2 className="ui-section-title mt-2">Local backups</h2>
          <p className="ui-helper mt-2">
            Save a snapshot of your browser data (prices, symbols, strategies,
            scans). Backups are stored separately and are not removed when you
            delete price data in the inventory above. Clearing all site data in
            the browser still removes backups.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBackups()}
          disabled={loading || busy !== null}
          className="ui-btn-secondary disabled:opacity-50"
        >
          Refresh list
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block min-w-[12rem] flex-1">
          <span className="ui-field-label">Backup label (optional)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Before watchlist update"
            className="ui-input mt-1"
            disabled={busy !== null}
          />
        </label>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={busy !== null}
          className="ui-btn-primary disabled:opacity-50"
        >
          {busy === "create" ? "Saving…" : "Create backup"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <p className="ui-helper mt-6">Loading backups…</p>
      ) : backups.length === 0 ? (
        <p className="ui-helper mt-6">
          No backups yet. Create one before clearing browser data or deleting
          large chunks of history.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="ui-table min-w-[40rem]">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 text-left">Created</th>
                <th className="py-2 pr-4 text-left">Label</th>
                <th className="py-2 pr-4 text-left">Symbols</th>
                <th className="py-2 pr-4 text-left">Bars</th>
                <th className="py-2 pr-4 text-left">Patterns</th>
                <th className="py-2 pr-4 text-left">Scans</th>
                <th className="py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.id} className="border-b border-border/40">
                  <td className="py-3 pr-4 text-muted">
                    {formatCreatedAt(backup.createdAt)}
                  </td>
                  <td className="py-3 pr-4 font-medium">{backup.label}</td>
                  <td className="py-3 pr-4">{backup.symbolCount}</td>
                  <td className="py-3 pr-4">
                    {backup.totalBars.toLocaleString()}
                  </td>
                  <td className="py-3 pr-4">{backup.patternCount}</td>
                  <td className="py-3 pr-4">{backup.scanCount}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void handleRestore(backup)}
                        className="rounded-full border border-border px-3 py-1 text-xs font-medium text-ink hover:bg-input disabled:opacity-50"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void handleDelete(backup)}
                        className="rounded-full border border-danger/40 px-3 py-1 text-xs text-danger disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
