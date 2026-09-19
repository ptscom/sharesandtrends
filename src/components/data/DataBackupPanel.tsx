"use client";

import { useRef, useState } from "react";
import {
  downloadAppDataBackup,
  restoreAppDataFromFile,
  type BackupFileSummary,
} from "@/lib/storage/backup";

interface DataBackupPanelProps {
  onRestored?: () => void;
}

export function DataBackupPanel({ onRestored }: DataBackupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<BackupFileSummary | null>(null);
  const [lastRestore, setLastRestore] = useState<BackupFileSummary | null>(null);

  const handleExport = async () => {
    setBusy("export");
    setError(null);
    try {
      const summary = await downloadAppDataBackup();
      setLastExport(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export backup");
    } finally {
      setBusy(null);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (
      !window.confirm(
        `Restore from "${file.name}"? This clears all current browser data for this app and replaces it with the backup.`,
      )
    ) {
      return;
    }

    setBusy("import");
    setError(null);
    try {
      const summary = await restoreAppDataFromFile(file);
      setLastRestore(summary);
      onRestored?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore backup");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="ui-panel p-6">
      <div>
        <p className="ui-eyebrow">Backup</p>
        <h2 className="ui-section-title mt-2">Export & restore</h2>
        <p className="ui-helper mt-2">
          Backups are saved as compressed JSON files on your computer (not in
          the browser). To recover after clearing site data, download a backup
          first, then use restore to wipe the local database and load the file.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={busy !== null}
          className="ui-btn-primary disabled:opacity-50"
        >
          {busy === "export" ? "Preparing…" : "Download backup file"}
        </button>
        <button
          type="button"
          onClick={handleImportClick}
          disabled={busy !== null}
          className="ui-btn-secondary disabled:opacity-50"
        >
          {busy === "import" ? "Restoring…" : "Restore from file"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.json.gz,.gz,application/json,application/gzip"
          className="hidden"
          onChange={(e) => void handleFileSelected(e)}
        />
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {lastExport && (
        <BackupSummaryCard
          title="Last export"
          summary={lastExport}
          hint="Keep this file somewhere safe (Downloads, cloud drive, etc.). Delete old copies in your file manager when you no longer need them."
        />
      )}

      {lastRestore && (
        <BackupSummaryCard
          title="Last restore"
          summary={lastRestore}
          hint="Local database was cleared and replaced with this backup."
        />
      )}
    </section>
  );
}

function BackupSummaryCard({
  title,
  summary,
  hint,
}: {
  title: string;
  summary: BackupFileSummary;
  hint: string;
}) {
  return (
    <div className="mt-6 rounded-xl border border-border-subtle bg-input/30 p-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">File</dt>
          <dd className="font-mono">{summary.fileName}</dd>
        </div>
        <div>
          <dt className="text-muted">Exported</dt>
          <dd>{formatWhen(summary.exportedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted">Symbols</dt>
          <dd>{summary.symbolCount}</dd>
        </div>
        <div>
          <dt className="text-muted">Bars</dt>
          <dd>{summary.totalBars.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted">Patterns</dt>
          <dd>{summary.patternCount}</dd>
        </div>
        <div>
          <dt className="text-muted">Scans</dt>
          <dd>{summary.scanCount}</dd>
        </div>
      </dl>
      <p className="ui-helper mt-3">{hint}</p>
    </div>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
