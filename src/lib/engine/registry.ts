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
    outputs: ["upper", "middle", "lower"],
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
];

export function getIndicatorDefinition(
  id: string,
): IndicatorDefinition | undefined {
  return INDICATOR_REGISTRY.find((d) => d.id === id);
}
