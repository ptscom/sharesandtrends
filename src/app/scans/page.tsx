"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listScanRuns } from "@/lib/storage/patterns";
import type { ScanRun } from "@/lib/types";

export default function ScansPage() {
  const [scans, setScans] = useState<ScanRun[]>([]);

  useEffect(() => {
    void listScanRuns(50).then(setScans);
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <p className="ui-field-label">History</p>
      <h1 className="ui-page-title mt-2 text-3xl">Saved scans</h1>
      <p className="ui-helper mt-2">
        Scan results live in your browser (IndexedDB). Export JSON from a scan
        page to move results between devices.
      </p>

      <div className="mt-8 space-y-4">
        {scans.map((scan) => (
          <Link
            key={scan.id}
            href={`/scans/${scan.id}`}
            className="ui-card block p-6 transition hover:border-brand/40"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {scan.patternName}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {scan.results.length} matches ·{" "}
                  {new Date(scan.runAt).toLocaleString()}
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-brand">
                Open
              </span>
            </div>
          </Link>
        ))}
        {scans.length === 0 && (
          <p className="ui-card p-8 text-center text-muted">
            No scans yet.{" "}
            <Link href="/explore" className="text-brand underline">
              Run your first scan
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
