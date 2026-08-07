"use client";

import type { ScanResultRow, ScanRun } from "@/lib/types";

export function formatShareCaption(
  patternName: string,
  row: ScanResultRow,
): string {
  const signal = row.signalToday ? "Signal: today" : "Signal: recent setup";
  return [
    `$${row.symbol} — ${patternName}`,
    `Win rate: ${row.stats.winRate.toFixed(1)}% (${row.stats.trades} trades)`,
    `Avg return: ${row.stats.avgReturnPct.toFixed(2)}%`,
    signal,
    "#stocks #technicalanalysis",
  ].join("\n");
}

export function formatScanSummary(scan: ScanRun): string {
  const top = scan.results.slice(0, 5);
  const lines = [
    `Scan: ${scan.patternName}`,
    `${scan.results.length} matches · min win rate ${scan.filters.minWinRate ?? 0}%`,
    "",
    ...top.map(
      (r) =>
        `$${r.symbol} — ${r.stats.winRate.toFixed(0)}% win (${r.stats.trades} trades)${r.signalToday ? " · TODAY" : ""}`,
    ),
    "",
    "#stocks #screener",
  ];
  return lines.join("\n");
}

interface ShareCaptionProps {
  scan: ScanRun;
}

export function ShareCaption({ scan }: ShareCaptionProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <CopyCaptionButton label="Copy scan summary" text={formatScanSummary(scan)} />
      <ExportScanButton scan={scan} />
    </div>
  );
}

function CopyCaptionButton({ label, text }: { label: string; text: string }) {
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard.writeText(text)}
      className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.15em] text-muted hover:text-ink"
    >
      {label}
    </button>
  );
}

function ExportScanButton({ scan }: { scan: ScanRun }) {
  return (
    <button
      type="button"
      onClick={() => {
        const blob = new Blob([JSON.stringify(scan, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `scan-${scan.id.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }}
      className="rounded-full bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-bg"
    >
      Export JSON
    </button>
  );
}
