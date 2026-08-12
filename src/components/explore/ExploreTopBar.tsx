"use client";

import {
  LabSummaryChip,
  LabTopBar,
} from "@/components/lab/LabShell";

interface ExploreTopBarProps {
  symbolCount: number;
  strategyName: string;
  minWinRate: number;
  minTrades: number;
  signalTodayOnly: boolean;
  scanning: boolean;
  canScan: boolean;
  onScan: () => void;
}

export function ExploreTopBar({
  symbolCount,
  strategyName,
  minWinRate,
  minTrades,
  signalTodayOnly,
  scanning,
  canScan,
  onScan,
}: ExploreTopBarProps) {
  const filterSummary = `${minWinRate}% win · ${minTrades}+ trades${
    signalTodayOnly ? " · today" : ""
  }`;

  return (
    <LabTopBar
      title="Explore"
      description="Select a universe of symbols, tune a strategy, and scan for matches ranked by backtest performance."
      chips={
        <>
          <LabSummaryChip label="Symbols" value={symbolCount} />
          <LabSummaryChip
            label="Strategy"
            value={strategyName}
            mode="text"
          />
          <LabSummaryChip label="Filters" value={filterSummary} mode="text" />
        </>
      }
      actionLabel="Scan universe"
      loadingLabel="Scanning…"
      actionIcon={<ScanIcon />}
      actionDisabled={!canScan}
      actionLoading={scanning}
      onAction={onScan}
    />
  );
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}
