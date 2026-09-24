"use client";

import { useRef, useState } from "react";
import {
  downloadExplorationBackup,
  restoreExplorationsFromFile,
  type ExplorationBackupSummary,
} from "@/lib/storage/exploration-backup";

interface ExplorationBackupPanelProps {
  explorationCount: number;
  onRestored?: () => void;
}

export function ExplorationBackupPanel({
  explorationCount,
  onRestored,
}: ExplorationBackupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingModeRef = useRef<"merge" | "replace">("merge");
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<ExplorationBackupSummary | null>(
    null,
  );
  const [lastRestore, setLastRestore] = useState<ExplorationBackupSummary | null>(
    null,
  );

  const handleExport = async () => {
    setBusy("export");
    setError(null);
    try {
      const summary = await downloadExplorationBackup();
      setLastExport(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export explorations");
    } finally {
      setBusy(null);
    }
  };

  const openFilePicker = (mode: "merge" | "replace") => {
    pendingModeRef.current = mode;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const mode = pendingModeRef.current;
    if (
      mode === "replace" &&
      !window.confirm(
        `Replace all custom explorations with "${file.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusy("import");
    setError(null);
    try {
      const summary = await restoreExplorationsFromFile(file, mode);
      setLastRestore(summary);
      onRestored?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore explorations");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="ui-panel-sm p-4">
      <p className="ui-eyebrow">Library backup</p>
      <h3 className="ui-card-title mt-1">Custom explorations</h3>
      <p className="ui-helper mt-2">
        Saved custom indicator explorations live in IndexedDB and can be lost after
        a rebuild or clearing site data. Download a backup file to your computer,
        then upload it here to restore. ({explorationCount} saved now.)
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={busy !== null}
          className="ui-btn-secondary text-sm disabled:opacity-50"
        >
          {busy === "export" ? "Preparing…" : "Download backup"}
        </button>
        <button
          type="button"
          onClick={() => openFilePicker("merge")}
          disabled={busy !== null}
          className="ui-btn-secondary text-sm disabled:opacity-50"
        >
          {busy === "import" ? "Restoring…" : "Upload (merge)"}
        </button>
        <button
          type="button"
          onClick={() => openFilePicker("replace")}
          disabled={busy !== null}
          className="ui-btn-secondary text-sm disabled:opacity-50"
        >
          Upload (replace all)
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
        <p className="mt-3 rounded-xl bg-danger-light px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {lastExport && (
        <p className="ui-helper mt-3">
          Exported {lastExport.explorationCount} exploration(s) to{" "}
          <span className="font-mono">{lastExport.fileName}</span>.
        </p>
      )}
      {lastRestore && (
        <p className="ui-helper mt-3">
          Restored {lastRestore.explorationCount} exploration(s) from{" "}
          <span className="font-mono">{lastRestore.fileName}</span>.
        </p>
      )}
    </section>
  );
}
