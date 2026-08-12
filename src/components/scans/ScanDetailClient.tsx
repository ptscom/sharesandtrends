"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShareCaption } from "@/components/share/ShareCaption";
import { ScanResultsTable } from "@/components/shared/ScanResultsTable";
import { getScanRun } from "@/lib/storage/patterns";
import type { ScanRun } from "@/lib/types";

export function ScanDetailClient({ scanId }: { scanId: string }) {
  const [scan, setScan] = useState<ScanRun | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void getScanRun(scanId).then((record) => {
      if (record) setScan(record);
      else setMissing(true);
    });
  }, [scanId]);

  if (missing) {
    return (
      <div className="ui-panel p-12 text-center">
        <h2 className="ui-section-title text-xl">Scan not found</h2>
        <p className="ui-helper mt-2">
          Scan results are stored in your browser. This ID may be from another
          device, or the data was cleared.
        </p>
        <Link href="/explore" className="ui-btn-link mt-6 inline-block">
          Run a new scan
        </Link>
      </div>
    );
  }

  if (!scan) {
    return <p className="text-body">Loading scan…</p>;
  }

  return (
    <div className="space-y-6">
      <section className="ui-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/explore"
              className="text-xs font-medium text-brand-text hover:underline"
            >
              ← Back to Explore
            </Link>
            <p className="ui-eyebrow mt-3">Scan results</p>
            <h1 className="ui-page-title mt-2">{scan.patternName}</h1>
            <p className="ui-helper mt-2">
              {scan.results.length} matches · {scan.universe.length} symbols
              scanned · run {new Date(scan.runAt).toLocaleString()} · stored in
              your browser
            </p>
          </div>
          <ShareCaption scan={scan} />
        </div>
      </section>

      <section className="ui-panel p-6">
        <ScanResultsTable scan={scan} />
      </section>
    </div>
  );
}
