"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShareCaption } from "@/components/share/ShareCaption";
import { formatShareCaption } from "@/components/share/ShareCaption";
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
            <p className="ui-eyebrow">Scan results</p>
            <h1 className="ui-page-title mt-2">{scan.patternName}</h1>
            <p className="ui-helper mt-2">
              {scan.results.length} matches · run{" "}
              {new Date(scan.runAt).toLocaleString()} · stored in your browser
            </p>
          </div>
          <ShareCaption scan={scan} />
        </div>
      </section>

      <section className="ui-panel p-6">
        <div className="overflow-x-auto">
          <table className="ui-table min-w-[720px]">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Signal</th>
                <th>Win rate</th>
                <th>Trades</th>
                <th>Avg return</th>
                <th>Sharpe</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {scan.results.map((row) => (
                <tr key={row.symbol}>
                  <td>
                    <Link
                      href={`/symbol/${row.symbol}?scanId=${scan.id}`}
                      className="inline-flex items-center font-mono text-sm font-semibold leading-none text-brand-text hover:text-brand"
                    >
                      {row.symbol}
                    </Link>
                  </td>
                  <td>
                    {row.signalToday ? (
                      <span className="ui-badge bg-brand-light text-brand-text">
                        Today
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>{row.stats.winRate.toFixed(1)}%</td>
                  <td>{row.stats.trades}</td>
                  <td>{row.stats.avgReturnPct.toFixed(2)}%</td>
                  <td>
                    {row.stats.sharpe != null
                      ? row.stats.sharpe.toFixed(2)
                      : "—"}
                  </td>
                  <td>
                    <RowCopy text={formatShareCaption(scan.patternName, row)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {scan.results.length === 0 && (
            <p className="py-8 text-center text-body">
              No symbols matched your filters.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function RowCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="ui-btn-link text-xs"
    >
      {copied ? "Copied!" : "Copy post"}
    </button>
  );
}
