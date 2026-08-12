"use client";

import Link from "next/link";

interface ScanSettingsPanelProps {
  minWinRate: number;
  minTrades: number;
  signalTodayOnly: boolean;
  symbolCount: number;
  storedSymbolCount: number;
  onMinWinRateChange: (value: number) => void;
  onMinTradesChange: (value: number) => void;
  onSignalTodayOnlyChange: (value: boolean) => void;
}

export function ScanSettingsPanel({
  minWinRate,
  minTrades,
  signalTodayOnly,
  symbolCount,
  storedSymbolCount,
  onMinWinRateChange,
  onMinTradesChange,
  onSignalTodayOnlyChange,
}: ScanSettingsPanelProps) {
  return (
    <section className="ui-panel p-6">
      <p className="ui-eyebrow">Step 3</p>
      <h2 className="ui-section-title mt-2">Scan settings</h2>
      <p className="ui-helper mt-1">
        Filter scan results by backtest performance. The scan will run across{" "}
        {symbolCount} selected symbol{symbolCount === 1 ? "" : "s"}.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="ui-field-label">Min win rate %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={minWinRate}
                onChange={(e) => onMinWinRateChange(Number(e.target.value))}
                className="ui-input mt-2"
              />
            </label>
            <label className="block">
              <span className="ui-field-label">Min trades</span>
              <input
                type="number"
                min={1}
                max={500}
                value={minTrades}
                onChange={(e) => onMinTradesChange(Number(e.target.value))}
                className="ui-input mt-2"
              />
            </label>
          </div>

          <label className="flex items-center gap-3 text-sm text-body">
            <input
              type="checkbox"
              checked={signalTodayOnly}
              onChange={(e) => onSignalTodayOnlyChange(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Only show symbols with a signal today
          </label>
        </div>

        <div className="rounded-xl border border-border-subtle bg-input/50 p-4">
          <p className="text-sm font-medium text-ink">Scan summary</p>
          <ul className="mt-3 space-y-2 text-sm text-body">
            <li>
              <span className="text-muted">Universe:</span>{" "}
              <span className="font-medium text-ink">
                {symbolCount} symbol{symbolCount === 1 ? "" : "s"}
              </span>
            </li>
            <li>
              <span className="text-muted">Stored locally:</span>{" "}
              <span className="font-medium text-ink">{storedSymbolCount}</span>
            </li>
            <li>
              <span className="text-muted">Min win rate:</span>{" "}
              <span className="font-medium text-ink">{minWinRate}%</span>
            </li>
            <li>
              <span className="text-muted">Min trades:</span>{" "}
              <span className="font-medium text-ink">{minTrades}</span>
            </li>
          </ul>
          {storedSymbolCount === 0 && (
            <p className="ui-helper mt-4">
              No symbols stored.{" "}
              <Link href="/data" className="text-brand-text underline">
                Download data
              </Link>{" "}
              before scanning.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
