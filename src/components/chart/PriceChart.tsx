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
        background: { type: ColorType.Solid, color: "#0f1419" },
        textColor: "#9aa4b2",
      },
      grid: {
        vertLines: { color: "#1e2732" },
        horzLines: { color: "#1e2732" },
      },
      rightPriceScale: { borderColor: "#2a3544" },
      timeScale: { borderColor: "#2a3544" },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#0f6a4a",
      downColor: "#df6b4c",
      borderVisible: true,
      borderUpColor: "#0f6a4a",
      borderDownColor: "#df6b4c",
      wickUpColor: "#0f6a4a",
      wickDownColor: "#df6b4c",
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
        color: "#5b9bd5",
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
        color: "#e8b84a",
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
        color: s.type === "entry" ? "#0f6a4a" : "#df6b4c",
        shape:
          s.type === "entry" ? ("arrowUp" as const) : ("arrowDown" as const),
        text: s.type === "entry" ? "Entry" : "Exit",
      }));
      const candleMarkers = patternMarkers.map((m) => ({
        time: toUtc(m.date),
        position: "aboveBar" as const,
        color: "#e8b84a",
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
