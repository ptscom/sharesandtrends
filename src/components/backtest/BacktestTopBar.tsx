"use client";

import {
  LabSummaryChip,
  LabTopBar,
} from "@/components/lab/LabShell";

interface BacktestTopBarProps {
  symbolCount: number;
  strategyCount: number;
  runCount: number;
  paramSetCount: number;
  running: boolean;
  canRun: boolean;
  onRun: () => void;
}

export function BacktestTopBar({
  symbolCount,
  strategyCount,
  runCount,
  paramSetCount,
  running,
  canRun,
  onRun,
}: BacktestTopBarProps) {
  return (
    <LabTopBar
      title="Backtest lab"
      description="Test strategies across multiple symbols with parameter sweeps. Each combination of symbol × strategy × parameter set runs as a separate backtest."
      chips={
        <>
          <LabSummaryChip label="Symbols" value={symbolCount} />
          <LabSummaryChip label="Strategies" value={strategyCount} />
          <LabSummaryChip label="Runs" value={runCount} />
          <LabSummaryChip label="Param sets" value={paramSetCount} />
        </>
      }
      actionLabel="Run backtest"
      loadingLabel="Running…"
      actionIcon={<PlayIcon />}
      actionDisabled={!canRun}
      actionLoading={running}
      onAction={onRun}
    />
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M6.3 4.2a1 1 0 011.05-.15l9.01 5.19a1 1 0 010 1.74l-9.01 5.2A1 1 0 015 15.2V4.8a1 1 0 011.3-.6z" />
    </svg>
  );
}
