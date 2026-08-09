import { getImplementedPatternIds } from "@/lib/patterns/candle-catalog";

export interface IndicatorParamSchema {
  type: "int" | "float" | "enum";
  default: number | string;
  min?: number;
  max?: number;
  options?: string[];
  label: string;
}

export interface IndicatorDefinition {
  id: string;
  name: string;
  category: string;
  params: Record<string, IndicatorParamSchema>;
  outputs: string[];
}

export const INDICATOR_REGISTRY: IndicatorDefinition[] = [
  {
    id: "sma",
    name: "Simple Moving Average",
    category: "overlap",
    params: {
      length: { type: "int", default: 20, min: 1, max: 500, label: "Period" },
      source: {
        type: "enum",
        default: "close",
        options: ["open", "high", "low", "close", "volume"],
        label: "Source",
      },
    },
    outputs: ["sma"],
  },
  {
    id: "ema",
    name: "Exponential Moving Average",
    category: "overlap",
    params: {
      length: { type: "int", default: 20, min: 1, max: 500, label: "Period" },
      source: {
        type: "enum",
        default: "close",
        options: ["open", "high", "low", "close", "volume"],
        label: "Source",
      },
    },
    outputs: ["ema"],
  },
  {
    id: "rsi",
    name: "Relative Strength Index",
    category: "momentum",
    params: {
      length: { type: "int", default: 14, min: 2, max: 100, label: "Period" },
      source: {
        type: "enum",
        default: "close",
        options: ["open", "high", "low", "close"],
        label: "Source",
      },
    },
    outputs: ["rsi"],
  },
  {
    id: "macd",
    name: "MACD",
    category: "momentum",
    params: {
      fast: { type: "int", default: 12, min: 1, max: 100, label: "Fast" },
      slow: { type: "int", default: 26, min: 1, max: 200, label: "Slow" },
      signal: { type: "int", default: 9, min: 1, max: 50, label: "Signal" },
      source: {
        type: "enum",
        default: "close",
        options: ["open", "high", "low", "close"],
        label: "Source",
      },
    },
    outputs: ["macd", "signal", "histogram"],
  },
  {
    id: "bb",
    name: "Bollinger Bands",
    category: "volatility",
    params: {
      length: { type: "int", default: 20, min: 2, max: 200, label: "Period" },
      stdDev: { type: "float", default: 2, min: 0.5, max: 5, label: "Std Dev" },
      source: {
        type: "enum",
        default: "close",
        options: ["open", "high", "low", "close"],
        label: "Source",
      },
    },
    outputs: ["upper", "middle", "lower", "percent_b"],
  },
  {
    id: "atr",
    name: "Average True Range",
    category: "volatility",
    params: {
      length: { type: "int", default: 14, min: 1, max: 100, label: "Period" },
    },
    outputs: ["atr"],
  },
  {
    id: "adx",
    name: "ADX / DMI",
    category: "trend",
    params: {
      length: { type: "int", default: 14, min: 2, max: 50, label: "Period" },
    },
    outputs: ["adx", "pdi", "mdi"],
  },
  {
    id: "stochastic",
    name: "Stochastic",
    category: "momentum",
    params: {
      period: { type: "int", default: 14, min: 2, max: 50, label: "%K Period" },
      signal: { type: "int", default: 3, min: 1, max: 10, label: "%D Period" },
    },
    outputs: ["k", "d"],
  },
  {
    id: "williamsr",
    name: "Williams %R",
    category: "momentum",
    params: {
      length: { type: "int", default: 14, min: 2, max: 50, label: "Period" },
    },
    outputs: ["williamsr"],
  },
  {
    id: "cci",
    name: "Commodity Channel Index",
    category: "momentum",
    params: {
      length: { type: "int", default: 20, min: 2, max: 100, label: "Period" },
    },
    outputs: ["cci"],
  },
  {
    id: "roc",
    name: "Rate of Change",
    category: "momentum",
    params: {
      length: { type: "int", default: 20, min: 2, max: 300, label: "Period" },
    },
    outputs: ["roc"],
  },
  {
    id: "mfi",
    name: "Money Flow Index",
    category: "volume",
    params: {
      length: { type: "int", default: 14, min: 2, max: 50, label: "Period" },
    },
    outputs: ["mfi"],
  },
  {
    id: "obv",
    name: "On Balance Volume",
    category: "volume",
    params: {},
    outputs: ["obv"],
  },
  {
    id: "psar",
    name: "Parabolic SAR",
    category: "trend",
    params: {
      step: { type: "float", default: 0.02, min: 0.01, max: 0.1, label: "Step" },
      max: { type: "float", default: 0.2, min: 0.1, max: 0.5, label: "Max" },
    },
    outputs: ["psar"],
  },
  {
    id: "trix",
    name: "TRIX",
    category: "momentum",
    params: {
      length: { type: "int", default: 15, min: 2, max: 50, label: "Period" },
      signal: { type: "int", default: 9, min: 2, max: 30, label: "Signal" },
    },
    outputs: ["trix", "signal"],
  },
  {
    id: "keltner",
    name: "Keltner Channels",
    category: "volatility",
    params: {
      maPeriod: { type: "int", default: 20, min: 5, max: 100, label: "EMA Period" },
      atrPeriod: { type: "int", default: 20, min: 5, max: 50, label: "ATR Period" },
      multiplier: { type: "float", default: 2, min: 0.5, max: 5, label: "Multiplier" },
    },
    outputs: ["upper", "middle", "lower"],
  },
  {
    id: "rolling_high",
    name: "Prior Rolling High",
    category: "price",
    params: {
      length: { type: "int", default: 20, min: 2, max: 300, label: "Period" },
    },
    outputs: ["rolling_high"],
  },
  {
    id: "rolling_low",
    name: "Prior Rolling Low",
    category: "price",
    params: {
      length: { type: "int", default: 20, min: 2, max: 300, label: "Period" },
    },
    outputs: ["rolling_low"],
  },
  {
    id: "momentum",
    name: "Price Momentum %",
    category: "momentum",
    params: {
      length: { type: "int", default: 126, min: 5, max: 300, label: "Lookback" },
    },
    outputs: ["momentum"],
  },
  {
    id: "zscore",
    name: "Price Z-Score",
    category: "mean_reversion",
    params: {
      length: { type: "int", default: 20, min: 5, max: 200, label: "Lookback" },
    },
    outputs: ["zscore"],
  },
  {
    id: "envelope",
    name: "MA Envelope",
    category: "overlap",
    params: {
      length: { type: "int", default: 20, min: 5, max: 200, label: "SMA Period" },
      pct: { type: "float", default: 3, min: 0.5, max: 15, label: "Envelope %" },
    },
    outputs: ["middle", "upper", "lower"],
  },
  {
    id: "volume_sma",
    name: "Volume SMA",
    category: "volume",
    params: {
      length: { type: "int", default: 20, min: 2, max: 100, label: "Period" },
    },
    outputs: ["volume_sma"],
  },
  {
    id: "candle_pattern",
    name: "Candlestick Pattern",
    category: "pattern",
    params: {
      pattern: {
        type: "enum",
        default: "doji",
        options: getImplementedPatternIds(),
        label: "Pattern",
      },
      bodyRatio: {
        type: "float",
        default: 0.1,
        min: 0.01,
        max: 0.5,
        label: "Body ratio",
      },
      shadowRatio: {
        type: "float",
        default: 2,
        min: 1,
        max: 6,
        label: "Shadow ratio",
      },
    },
    outputs: ["signal"],
  },
];

export function getIndicatorDefinition(
  id: string,
): IndicatorDefinition | undefined {
  return INDICATOR_REGISTRY.find((d) => d.id === id);
}
