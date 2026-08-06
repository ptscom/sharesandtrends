import type { PatternDefinition } from "@/lib/types";

export const EMA_CROSS_PATTERN: PatternDefinition = {
  name: "EMA 3 / 50 Cross",
  description: "Fast EMA crosses above slow EMA with exit on opposite cross",
  indicators: [
    {
      alias: "ema_fast",
      type: "ema",
      params: { length: 3, source: "close" },
      timeframe: "1D",
    },
    {
      alias: "ema_slow",
      type: "ema",
      params: { length: 50, source: "close" },
      timeframe: "1D",
    },
  ],
  entry: {
    op: "crosses_above",
    left: { ref: "ema_fast" },
    right: { ref: "ema_slow" },
  },
  exit: {
    op: "crosses_below",
    left: { ref: "ema_fast" },
    right: { ref: "ema_slow" },
  },
  backtest: {
    entryOn: "close",
    exitOn: "opposite_signal",
    minTrades: 5,
  },
};

export const RSI_OVERSOLD_PATTERN: PatternDefinition = {
  name: "RSI Oversold Bounce",
  description: "RSI crosses above 30 from below",
  indicators: [
    {
      alias: "rsi",
      type: "rsi",
      params: { length: 14, source: "close" },
      timeframe: "1D",
    },
  ],
  entry: {
    op: "crosses_above",
    left: { ref: "rsi" },
    right: { value: 30 },
  },
  exit: {
    op: "crosses_below",
    left: { ref: "rsi" },
    right: { value: 70 },
  },
  backtest: {
    entryOn: "close",
    exitOn: "opposite_signal",
    minTrades: 5,
  },
};

export const DEFAULT_PATTERNS = [EMA_CROSS_PATTERN, RSI_OVERSOLD_PATTERN];
