"use client";

import type { DistributionBin } from "@/lib/analytics/backtest-analytics";

interface ReturnDistributionChartProps {
  bins: DistributionBin[];
  mean: number;
}

export function ReturnDistributionChart({
  bins,
  mean,
}: ReturnDistributionChartProps) {
  if (bins.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">No trade data yet</p>
    );
  }

  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const meanIdx = bins.findIndex((b) => mean >= b.min && mean <= b.max);

  return (
    <div className="relative">
      <div className="flex h-48 items-end gap-1">
        {bins.map((bin, i) => {
          const heightPct = (bin.count / maxCount) * 100;
          return (
            <div
              key={`${bin.min}-${bin.max}`}
              className="relative flex flex-1 flex-col items-center justify-end"
            >
              <div
                className="w-full rounded-t bg-accent/40 transition-all"
                style={{ height: `${Math.max(heightPct, bin.count > 0 ? 4 : 0)}%` }}
                title={`${bin.min.toFixed(1)}% – ${bin.max.toFixed(1)}%: ${bin.count} trades`}
              />
              {i % 2 === 0 && (
                <span className="mt-1 text-[9px] text-muted">{bin.label}</span>
              )}
            </div>
          );
        })}
      </div>
      {meanIdx >= 0 && (
        <p className="mt-2 text-center text-xs text-info">
          Mean: {mean >= 0 ? "+" : ""}
          {mean.toFixed(2)}%
        </p>
      )}
    </div>
  );
}
