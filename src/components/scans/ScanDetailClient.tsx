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
      <div className="rounded-3xl border border-border bg-surface p-12 text-center">
        <h2 className="text-xl font-semibold text-ink">Scan not found</h2>
        <p className="mt-2 text-sm text-muted">
          Scan results are stored in your browser. This ID may be from another
          device, or the data was cleared.
        </p>
        <Link href="/explore" className="mt-6 inline-block text-brand underline">
          Run a new scan
        </Link>
      </div>
    );
  }

  if (!scan) {
    return <p className="text-muted">Loading scan…</p>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-surface p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">
              Scan results
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">
              {scan.patternName}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {scan.results.length} matches · run{" "}
              {new Date(scan.runAt).toLocaleString()} · stored in your browser
            </p>
          </div>
          <ShareCaption scan={scan} />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-8">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-[0.15em] text-muted">
                <th className="py-3 pr-4">Symbol</th>
                <th className="py-3 pr-4">Signal</th>
                <th className="py-3 pr-4">Win rate</th>
                <th className="py-3 pr-4">Trades</th>
                <th className="py-3 pr-4">Avg return</th>
                <th className="py-3 pr-4">Sharpe</th>
                <th className="py-3">Share</th>
              </tr>
            </thead>
            <tbody>
              {scan.results.map((row) => (
                <tr
                  key={row.symbol}
                  className="border-b border-border/50 hover:bg-bg/50"
                >
                  <td className="py-3 pr-4">
                    <Link
                      href={`/symbol/${row.symbol}`}
                      className="font-mono font-semibold text-brand"
                    >
                      {row.symbol}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    {row.signalToday ? (
                      <span className="rounded-full bg-brand/15 px-2 py-1 text-xs font-semibold text-brand">
                        Today
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {row.stats.winRate.toFixed(1)}%
                  </td>
                  <td className="py-3 pr-4">{row.stats.trades}</td>
                  <td className="py-3 pr-4">
                    {row.stats.avgReturnPct.toFixed(2)}%
                  </td>
                  <td className="py-3 pr-4">
                    {row.stats.sharpe != null
                      ? row.stats.sharpe.toFixed(2)
                      : "—"}
                  </td>
                  <td className="py-3">
                    <RowCopy text={formatShareCaption(scan.patternName, row)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {scan.results.length === 0 && (
            <p className="py-8 text-center text-muted">
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
      className="text-xs text-brand underline"
    >
      {copied ? "Copied!" : "Copy post"}
    </button>
  );
}
