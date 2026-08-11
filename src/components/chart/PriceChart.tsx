"use client";

import type { OhlcvBar, SignalPoint } from "@/lib/types";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

interface PriceChartProps {
  bars: OhlcvBar[];
  signals?: SignalPoint[];
  emaFast?: (number | null)[];
  emaSlow?: (number | null)[];
  patternMarkers?: { date: string; label: string }[];
  height?: number;
}

function toUtc(date: string): UTCTimestamp {
  return (new Date(date + "T00:00:00Z").getTime() / 1000) as UTCTimestamp;
}

export function PriceChart({
  bars,
  signals = [],
  emaFast,
  emaSlow,
  patternMarkers = [],
  height = 420,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#8190a0",
      },
      grid: {
        vertLines: { color: "#f0ece6" },
        horzLines: { color: "#f0ece6" },
      },
      rightPriceScale: { borderColor: "#e8e3dc" },
      timeScale: { borderColor: "#e8e3dc" },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#159a68",
      downColor: "#e05252",
      borderVisible: true,
      borderUpColor: "#159a68",
      borderDownColor: "#e05252",
      wickUpColor: "#159a68",
      wickDownColor: "#e05252",
    });

    candleSeries.setData(
      bars.map((b) => ({
        time: toUtc(b.date),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );

    if (emaFast?.length) {
      const line = chart.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 2,
      });
      line.setData(
        bars
          .map((b, i) =>
            emaFast[i] != null
              ? { time: toUtc(b.date), value: emaFast[i]! }
              : null,
          )
          .filter(Boolean) as { time: UTCTimestamp; value: number }[],
      );
    }

    if (emaSlow?.length) {
      const line = chart.addSeries(LineSeries, {
        color: "#e8a317",
        lineWidth: 2,
      });
      line.setData(
        bars
          .map((b, i) =>
            emaSlow[i] != null
              ? { time: toUtc(b.date), value: emaSlow[i]! }
              : null,
          )
          .filter(Boolean) as { time: UTCTimestamp; value: number }[],
      );
    }

    if (signals.length > 0 || patternMarkers.length > 0) {
      const tradeMarkers = signals.map((s) => ({
        time: toUtc(s.date),
        position:
          s.type === "entry"
            ? ("belowBar" as const)
            : ("aboveBar" as const),
        color: s.type === "entry" ? "#16a34a" : "#dc4c3f",
        shape:
          s.type === "entry" ? ("arrowUp" as const) : ("arrowDown" as const),
        text: s.type === "entry" ? "Entry" : "Exit",
      }));
      const candleMarkers = patternMarkers.map((m) => ({
        time: toUtc(m.date),
        position: "aboveBar" as const,
        color: "#e8a317",
        shape: "circle" as const,
        text: m.label,
      }));
      createSeriesMarkers(candleSeries, [...tradeMarkers, ...candleMarkers]);
    }

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
  }, [bars, signals, emaFast, emaSlow, patternMarkers, height]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-2xl border border-border"
    />
  );
}
