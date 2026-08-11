"use client";

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
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="ui-eyebrow">Research</p>
        <h1 className="ui-page-title mt-1">Explore</h1>
        <p className="ui-helper mt-1 max-w-2xl">
          Select a universe of symbols, tune a strategy, and scan for matches
          ranked by backtest performance.
        </p>
      </div>

      <div className="flex flex-col items-end gap-3">
        <div className="flex flex-wrap justify-end gap-2">
          <SummaryChip label="Symbols" value={symbolCount} />
          <SummaryChip label="Strategy" value={strategyName} text />
          <SummaryChip
            label="Filters"
            value={`${minWinRate}% win · ${minTrades}+ trades${signalTodayOnly ? " · today" : ""}`}
            text
          />
        </div>
        <button
          type="button"
          disabled={!canScan || scanning}
          onClick={onScan}
          className="ui-btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          <ScanIcon />
          {scanning ? "Scanning…" : "Scan universe"}
        </button>
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  text = false,
}: {
  label: string;
  value: number | string;
  text?: boolean;
}) {
  return (
    <span className="inline-flex max-w-[14rem] items-center gap-1.5 truncate rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-body">
      {!text && (
        <span className="font-semibold text-ink">{value}</span>
      )}
      <span className={text ? "truncate font-semibold text-ink" : ""}>
        {text ? value : label}
      </span>
      {!text && label}
    </span>
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
