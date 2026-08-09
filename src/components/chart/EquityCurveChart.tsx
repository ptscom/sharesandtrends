"use client";

import type { EquityPoint } from "@/lib/analytics/backtest-analytics";
import {
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

interface EquityCurveChartProps {
  strategy: EquityPoint[];
  buyHold: EquityPoint[];
  symbol: string;
  height?: number;
}

function toUtc(date: string): UTCTimestamp {
  return (new Date(date + "T00:00:00Z").getTime() / 1000) as UTCTimestamp;
}

export function EquityCurveChart({
  strategy,
  buyHold,
  symbol,
  height = 260,
}: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || strategy.length === 0) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#6b7280",
      },
      grid: {
        vertLines: { color: "#f0ebe3" },
        horzLines: { color: "#f0ebe3" },
      },
      rightPriceScale: { borderColor: "#e8e4dd" },
      timeScale: { borderColor: "#e8e4dd" },
    });

    const strategySeries = chart.addSeries(LineSeries, {
      color: "#e8a317",
      lineWidth: 2,
      title: "Strategy",
    });
    strategySeries.setData(
      strategy.map((p) => ({ time: toUtc(p.date), value: p.value })),
    );

    const buyHoldSeries = chart.addSeries(LineSeries, {
      color: "#9ca3af",
      lineWidth: 2,
      lineStyle: 2,
      title: `Buy & Hold (${symbol})`,
    });
    buyHoldSeries.setData(
      buyHold.map((p) => ({ time: toUtc(p.date), value: p.value })),
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [strategy, buyHold, symbol, height]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-brand" />
          Strategy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded border border-dashed border-muted" />
          Buy &amp; Hold ({symbol})
        </span>
      </div>
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-xl border border-border bg-surface"
      />
    </div>
  );
}
