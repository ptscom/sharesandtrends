"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PriceChart } from "@/components/chart/PriceChart";
import { buildExplorationSymbolHistory } from "@/lib/explore/exploration-events";
import { formatExplorationSignalDate } from "@/lib/explore/exploration-snapshot";
import type {
  ExplorationEvent,
  ExplorationHorizonReturn,
} from "@/lib/explore/exploration-events";
import type {
  HorizonStats,
  IndicatorScanRun,
} from "@/lib/explore/exploration-models";
import { resolveExplorationPatternFromScan } from "@/lib/explore/resolve-exploration-scan";
import { formatTimeframeModeLabel } from "@/lib/patterns/mtf-combine";
import { getIndicatorScanRun } from "@/lib/storage/indicator-scans";
import { getPriceBars } from "@/lib/storage/prices";
import type { OhlcvBar, SignalPoint } from "@/lib/types";

export function ExplorationSymbolDetail({
  symbol,
  explorationScanId,
}: {
  symbol: string;
  explorationScanId: string;
}) {
  const [bars, setBars] = useState<OhlcvBar[]>([]);
  const [scan, setScan] = useState<IndicatorScanRun | null>(null);
  const [events, setEvents] = useState<ExplorationEvent[]>([]);
  const [horizons, setHorizons] = useState<{
    d3: HorizonStats;
    d5: HorizonStats;
    d10: HorizonStats;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoadError(null);
      const [scanRun, data] = await Promise.all([
        getIndicatorScanRun(explorationScanId),
        getPriceBars(symbol),
      ]);

      if (!scanRun) {
        setLoadError("Exploration run not found in this browser.");
        setScan(null);
        setBars(data);
        return;
      }

      const resolvedPattern = await resolveExplorationPatternFromScan(scanRun);
      if (!resolvedPattern) {
        setLoadError(
          "Could not rebuild this exploration filter. Re-run the exploration scan and try again.",
        );
        setScan(scanRun);
        setBars(data);
        return;
      }

      setScan(scanRun);
      setBars(data);

      if (data.length > 0) {
        const history = buildExplorationSymbolHistory(
          data,
          resolvedPattern,
          scanRun.timeframeMode,
        );
        setEvents(history.events);
        setHorizons(history.horizons);
      } else {
        setEvents([]);
        setHorizons(null);
      }
    })();
  }, [symbol, explorationScanId]);

  const chartSignals = useMemo<SignalPoint[]>(() => {
    const recent = events.slice(-40);
    return recent.map((event) => ({
      date: event.signalDate,
      type: "entry" as const,
      side: "long" as const,
      price: event.entryPrice,
    }));
  }, [events]);

  if (bars.length === 0) {
    return (
      <div className="ui-panel p-12 text-center">
        <p className="text-muted">No data for {symbol} in your browser.</p>
        <Link href="/data" className="mt-4 inline-block text-brand underline">
          Download prices
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <section className="ui-panel p-6">
          <p className="ui-eyebrow">Symbol</p>
          <h1 className="ui-page-title mt-2">{symbol}</h1>
          <p className="mt-4 text-sm text-danger">{loadError}</p>
          <Link href="/explore" className="mt-4 inline-block ui-btn-secondary">
            ← Back to Explore
          </Link>
        </section>
      </div>
    );
  }

  const last = bars[bars.length - 1]!;
  const sortedEvents = [...events].reverse();

  return (
    <div className="space-y-6">
      <section className="ui-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="ui-eyebrow">Exploration</p>
            <h1 className="ui-page-title mt-2">{symbol}</h1>
            <p className="ui-helper mt-2">
              Last close ${last.close.toFixed(2)} · {bars.length} daily bars
              stored locally
            </p>
            {scan && (
              <>
                <p className="mt-2 text-sm font-medium text-brand-text">
                  {scan.filterName}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {scan.filterDescription} ·{" "}
                  {formatTimeframeModeLabel(scan.timeframeMode)}
                </p>
              </>
            )}
          </div>
          <Link href="/explore" className="ui-btn-secondary">
            ← Back to Explore
          </Link>
        </div>
      </section>

      <section className="ui-panel p-6">
        <h2 className="ui-section-title">Price chart</h2>
        <p className="ui-helper mt-1">
          Recent exploration signals (last {Math.min(events.length, 40)} shown)
        </p>
        <div className="mt-4">
          <PriceChart
            bars={bars.slice(-252)}
            signals={chartSignals}
            emaFast={[]}
            emaSlow={[]}
            patternMarkers={[]}
          />
        </div>
      </section>

      {horizons && scan && (
        <section className="ui-panel p-6">
          <p className="ui-eyebrow">Historical performance</p>
          <h2 className="ui-section-title mt-2">Forward returns after signal</h2>
          <p className="ui-helper mt-1">
            Each row is a past date when this exploration newly triggered.
            Returns are measured from the signal-day close to the close N
            trading days later. Summary cards above average the same per-signal
            returns shown in the table (signals without enough future data are
            excluded from each horizon).
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SummaryCard label="3d return" stats={horizons.d3} />
            <SummaryCard label="5d return" stats={horizons.d5} />
            <SummaryCard label="10d return" stats={horizons.d10} />
          </div>

          {sortedEvents.length === 0 ? (
            <p className="ui-helper mt-6 rounded-xl border border-border-subtle px-4 py-8 text-center">
              No historical signals found for this symbol and exploration.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-border-subtle">
              <table className="ui-table min-w-[720px]">
                <thead>
                  <tr>
                    <th className="px-4">Signal</th>
                    <th className="px-4">Entry close</th>
                    <th className="px-4">3d return</th>
                    <th className="px-4">5d return</th>
                    <th className="px-4">10d return</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEvents.map((event) => (
                    <tr key={event.signalDate}>
                      <td className="px-4 align-top text-sm text-body">
                        {formatExplorationSignalDate({
                          symbol,
                          signalDate: event.signalDate,
                          signalToday: false,
                          lastClose: event.entryPrice,
                        })}
                      </td>
                      <td className="px-4 align-top tabular-nums">
                        {event.entryPrice.toFixed(2)}
                      </td>
                      <HorizonReturnCell value={event.horizons.d3} />
                      <HorizonReturnCell value={event.horizons.d5} />
                      <HorizonReturnCell value={event.horizons.d10} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, stats }: { label: string; stats: HorizonStats }) {
  if (stats.trades === 0) {
    return (
      <div className="rounded-xl border border-border-subtle p-4">
        <div className="ui-field-label">{label}</div>
        <div className="mt-1 text-2xl font-semibold text-muted">—</div>
      </div>
    );
  }

  const positive = stats.avgReturnPct >= 0;

  return (
    <div className="rounded-xl border border-border-subtle p-4">
      <div className="ui-field-label">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold ${
          positive ? "text-success" : "text-danger"
        }`}
      >
        {positive ? "+" : ""}
        {stats.avgReturnPct.toFixed(2)}%
      </div>
      <div className="mt-1 text-sm text-muted">
        {stats.winRate.toFixed(0)}% win · {stats.trades} signals
      </div>
    </div>
  );
}

function HorizonReturnCell({ value }: { value: ExplorationHorizonReturn }) {
  if (value.returnPct === null) {
    return (
      <td className="px-4 align-top tabular-nums text-muted">
        <span>—</span>
      </td>
    );
  }

  const positive = value.returnPct >= 0;

  return (
    <td className="px-4 align-top tabular-nums">
      <div
        className={`text-sm font-medium ${
          positive ? "text-success" : "text-danger"
        }`}
      >
        {positive ? "+" : ""}
        {value.returnPct.toFixed(2)}%
      </div>
      {value.exitDate && (
        <div className="mt-0.5 text-[11px] text-muted">thru {value.exitDate}</div>
      )}
    </td>
  );
}
