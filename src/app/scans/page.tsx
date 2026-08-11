"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { listScanRuns } from "@/lib/storage/patterns";
import type { ScanRun } from "@/lib/types";

export default function ScansPage() {
  const [scans, setScans] = useState<ScanRun[]>([]);

  useEffect(() => {
    void listScanRuns(50).then(setScans);
  }, []);

  return (
    <PageContainer>
      <p className="ui-eyebrow">History</p>
      <h1 className="ui-page-title mt-2">Saved scans</h1>
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
                <h2 className="ui-card-title text-lg">{scan.patternName}</h2>
                <p className="ui-helper mt-1">
                  {scan.results.length} matches ·{" "}
                  {new Date(scan.runAt).toLocaleString()}
                </p>
              </div>
              <span className="ui-eyebrow text-brand-text">Open</span>
            </div>
          </Link>
        ))}
        {scans.length === 0 && (
          <p className="ui-card p-8 text-center text-body">
            No scans yet.{" "}
            <Link href="/explore" className="text-brand-text underline">
              Run your first scan
            </Link>
          </p>
        )}
      </div>
    </PageContainer>
  );
}
