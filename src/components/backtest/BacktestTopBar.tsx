"use client";

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
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="ui-eyebrow">Research</p>
        <h1 className="ui-page-title mt-1">Backtest lab</h1>
        <p className="ui-helper mt-1 max-w-2xl">
          Test strategies across multiple symbols with parameter sweeps. Each
          combination of symbol × strategy × parameter set runs as a separate
          backtest.
        </p>
      </div>

      <div className="flex flex-col items-end gap-3">
        <div className="flex flex-wrap justify-end gap-2">
          <SummaryChip label="Symbols" value={symbolCount} />
          <SummaryChip label="Strategies" value={strategyCount} />
          <SummaryChip label="Runs" value={runCount} />
          <SummaryChip label="Param sets" value={paramSetCount} />
        </div>
        <button
          type="button"
          disabled={!canRun || running}
          onClick={onRun}
          className="ui-btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          <PlayIcon />
          {running ? "Running…" : "Run backtest"}
        </button>
      </div>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-body">
      <span className="font-semibold text-ink">{value}</span>
      {label}
    </span>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M6.3 4.2a1 1 0 011.05-.15l9.01 5.19a1 1 0 010 1.74l-9.01 5.2A1 1 0 015 15.2V4.8a1 1 0 011.3-.6z" />
    </svg>
  );
}
