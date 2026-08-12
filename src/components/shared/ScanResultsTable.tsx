"use client";

import Link from "next/link";
import { useState } from "react";
import { formatShareCaption } from "@/components/share/ShareCaption";
import type { ScanRun } from "@/lib/types";

interface ScanResultsTableProps {
  scan: ScanRun;
  onCopyCaption?: (symbol: string, text: string) => void;
  copiedSymbol?: string | null;
}

export function ScanResultsTable({
  scan,
  onCopyCaption,
  copiedSymbol,
}: ScanResultsTableProps) {
  if (scan.results.length === 0) {
    return (
      <p className="ui-helper rounded-xl border border-border-subtle px-4 py-8 text-center">
        No symbols matched your filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
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
              <td className="align-middle whitespace-nowrap px-4">
                <Link
                  href={`/symbol/${row.symbol}?scanId=${scan.id}`}
                  className="inline-flex items-center font-mono text-sm font-semibold leading-none text-brand-text hover:underline"
                >
                  {row.symbol}
                </Link>
              </td>
              <td className="align-middle whitespace-nowrap px-4">
                {row.signalToday ? (
                  <span className="ui-badge bg-brand-light text-brand-text">
                    Today
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="align-middle px-4 tabular-nums">
                {row.stats.winRate.toFixed(1)}%
              </td>
              <td className="align-middle px-4 tabular-nums">
                {row.stats.trades}
              </td>
              <td
                className={`align-middle whitespace-nowrap px-4 tabular-nums ${
                  row.stats.avgReturnPct >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {row.stats.avgReturnPct >= 0 ? "+" : ""}
                {row.stats.avgReturnPct.toFixed(2)}%
              </td>
              <td className="align-middle whitespace-nowrap px-4 tabular-nums">
                {row.stats.sharpe != null ? row.stats.sharpe.toFixed(2) : "—"}
              </td>
              <td className="align-middle px-4">
                {onCopyCaption ? (
                  <button
                    type="button"
                    onClick={() =>
                      onCopyCaption(
                        row.symbol,
                        formatShareCaption(scan.patternName, row),
                      )
                    }
                    className="text-xs text-brand-text underline"
                  >
                    {copiedSymbol === row.symbol ? "Copied!" : "Copy"}
                  </button>
                ) : (
                  <RowCopy text={formatShareCaption(scan.patternName, row)} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
      className="text-xs text-brand-text underline"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
