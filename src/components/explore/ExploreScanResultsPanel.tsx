"use client";

import { useState } from "react";
import Link from "next/link";
import { ScanResultsTable } from "@/components/shared/ScanResultsTable";
import type { ScanRun } from "@/lib/types";

interface ExploreScanResultsPanelProps {
  scan: ScanRun;
}

export function ExploreScanResultsPanel({ scan }: ExploreScanResultsPanelProps) {
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);

  const copyCaption = (symbol: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedSymbol(symbol);
      setTimeout(() => setCopiedSymbol(null), 2000);
    });
  };

  return (
    <section className="ui-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Results</p>
          <h2 className="ui-section-title mt-2">
            Scan results ({scan.results.length})
          </h2>
          <p className="ui-helper mt-1">
            {scan.patternName} · {scan.universe.length} symbols scanned ·{" "}
            {formatRunAt(scan.runAt)}
          </p>
        </div>
        <Link href={`/scans/${scan.id}`} className="ui-btn-secondary">
          Open full scan
        </Link>
      </div>

      <div className="mt-6">
        <ScanResultsTable
          scan={scan}
          onCopyCaption={copyCaption}
          copiedSymbol={copiedSymbol}
        />
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
