"use client";

import { useState } from "react";
import Link from "next/link";
import { formatShareCaption } from "@/components/share/ShareCaption";
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

      {scan.results.length === 0 ? (
        <p className="ui-helper mt-6 rounded-xl border border-border-subtle px-4 py-8 text-center">
          No symbols matched your filters. Try lowering min win rate or min
          trades.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle">
          <table className="ui-table min-w-[720px]">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Signal</th>
                <th>Win rate</th>
                <th>Trades</th>
                <th>Avg return</th>
                <th>Sharpe</th>
                <th>Caption</th>
              </tr>
            </thead>
            <tbody>
              {scan.results.map((row) => (
                <tr key={row.symbol}>
                  <td>
                    <Link
                      href={`/symbol/${row.symbol}?scanId=${scan.id}`}
                      className="font-mono font-semibold text-brand-text hover:underline"
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
                  <td
                    className={
                      row.stats.avgReturnPct >= 0
                        ? "text-success"
                        : "text-danger"
                    }
                  >
                    {row.stats.avgReturnPct >= 0 ? "+" : ""}
                    {row.stats.avgReturnPct.toFixed(2)}%
                  </td>
                  <td>
                    {row.stats.sharpe != null
                      ? row.stats.sharpe.toFixed(2)
                      : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        copyCaption(
                          row.symbol,
                          formatShareCaption(scan.patternName, row),
                        )
                      }
                      className="text-xs text-brand-text underline"
                    >
                      {copiedSymbol === row.symbol ? "Copied!" : "Copy"}
                    </button>
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

function formatRunAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
