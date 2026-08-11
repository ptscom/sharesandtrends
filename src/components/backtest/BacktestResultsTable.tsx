"use client";

import type { BacktestSweepRow } from "@/lib/engine/param-sweep";

interface BacktestResultsTableProps {
  rows: BacktestSweepRow[];
}

export function BacktestResultsTable({ rows }: BacktestResultsTableProps) {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort(
    (a, b) => b.stats.winRate - a.stats.winRate || b.stats.avgReturnPct - a.stats.avgReturnPct,
  );

  return (
    <section className="ui-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Results</p>
          <h2 className="ui-section-title mt-2">
            Backtest results ({sorted.length})
          </h2>
        </div>
        <button
          type="button"
          onClick={() => exportCsv(sorted)}
          className="ui-btn-secondary"
        >
          Export CSV
        </button>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="ui-table min-w-[960px]">
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Parameters</th>
              <th>Symbol</th>
              <th>Trades</th>
              <th>Win rate</th>
              <th>Avg return</th>
              <th>Sharpe</th>
              <th>Best</th>
              <th>Worst</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => (
              <tr key={`${row.strategyId}-${row.symbol}-${row.paramLabel}-${index}`}>
                <td className="font-medium">{row.strategyName}</td>
                <td className="max-w-[14rem] text-body">{row.paramLabel}</td>
                <td className="font-mono font-semibold">{row.symbol}</td>
                <td>{row.stats.trades}</td>
                <td>{row.stats.winRate.toFixed(1)}%</td>
                <td
                  className={
                    row.stats.avgReturnPct >= 0 ? "text-success" : "text-danger"
                  }
                >
                  {row.stats.avgReturnPct >= 0 ? "+" : ""}
                  {row.stats.avgReturnPct.toFixed(2)}%
                </td>
                <td>
                  {row.stats.sharpe != null ? row.stats.sharpe.toFixed(2) : "—"}
                </td>
                <td className="text-success">
                  {row.stats.bestReturnPct.toFixed(1)}%
                </td>
                <td className="text-danger">
                  {row.stats.worstReturnPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function exportCsv(rows: BacktestSweepRow[]) {
  const header =
    "Strategy,Parameters,Symbol,Trades,Win Rate,Avg Return,Sharpe,Best,Worst";
  const lines = rows.map(
    (r) =>
      `"${r.strategyName}","${r.paramLabel}",${r.symbol},${r.stats.trades},${r.stats.winRate.toFixed(2)},${r.stats.avgReturnPct.toFixed(2)},${r.stats.sharpe?.toFixed(2) ?? ""},${r.stats.bestReturnPct.toFixed(2)},${r.stats.worstReturnPct.toFixed(2)}`,
  );
  const blob = new Blob([header + "\n" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "backtest-sweep-results.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
