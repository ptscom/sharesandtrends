"use client";

import type { MonthlyReturn } from "@/lib/analytics/backtest-analytics";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

interface MonthlyReturnsHeatmapProps {
  data: MonthlyReturn[];
}

function cellColor(value: number | null): string {
  if (value == null) return "bg-bg";
  if (value >= 8) return "bg-success/80 text-white";
  if (value >= 3) return "bg-success/50 text-ink";
  if (value > 0) return "bg-success/20 text-ink";
  if (value === 0) return "bg-bg text-muted";
  if (value > -3) return "bg-danger/20 text-ink";
  if (value > -8) return "bg-danger/50 text-ink";
  return "bg-danger/80 text-white";
}

export function MonthlyReturnsHeatmap({ data }: MonthlyReturnsHeatmapProps) {
  const byYearMonth = new Map<string, number>();
  for (const row of data) {
    byYearMonth.set(`${row.year}-${row.month}`, row.returnPct);
  }

  const years = [...new Set(data.map((d) => d.year))].sort();
  if (years.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">No monthly data yet</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] border-collapse text-center text-[10px]">
        <thead>
          <tr>
            <th className="p-1 text-left text-muted" />
            {MONTHS.map((m, i) => (
              <th key={m + i} className="p-1 font-medium text-muted">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="p-1 text-left font-medium text-muted">{year}</td>
              {Array.from({ length: 12 }, (_, monthIdx) => {
                const month = monthIdx + 1;
                const value = byYearMonth.get(`${year}-${month}`) ?? null;
                return (
                  <td key={month} className="p-0.5">
                    <div
                      className={`rounded px-0.5 py-1 font-medium ${cellColor(value)}`}
                      title={
                        value != null
                          ? `${year}-${String(month).padStart(2, "0")}: ${value.toFixed(1)}%`
                          : undefined
                      }
                    >
                      {value != null
                        ? `${value >= 0 ? "+" : ""}${value.toFixed(0)}`
                        : "·"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
