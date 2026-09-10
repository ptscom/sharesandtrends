import type { PatternDefinition } from "@/lib/types";
import { buildStrategyPresetsFromExplorations } from "@/lib/patterns/exploration-strategies";

export interface StrategyPreset {
  id: string;
  category: string;
  pattern: PatternDefinition;
  entryLogic: string;
  defaultParams: string;
  exitLogic: string;
}

export const STRATEGY_PRESETS: StrategyPreset[] =
  buildStrategyPresetsFromExplorations();

/** Strategies from the spreadsheet not yet supported (intraday, trailing exits, etc.) */
export const UNSUPPORTED_STRATEGIES = [
  { name: "Supertrend", reason: "Requires custom ATR trend overlay" },
  { name: "Ichimoku Cloud Breakout", reason: "Complex multi-component cloud logic" },
  { name: "Opening Range Breakout", reason: "Requires intraday data" },
  { name: "Bollinger Squeeze Breakout", reason: "Requires bandwidth percentile ranking" },
  { name: "ATR Breakout", reason: "Requires ATR multiple price trigger" },
  { name: "ATR Trailing Stop", reason: "Requires trailing stop exit model" },
  { name: "Chandelier Trend", reason: "Requires trailing Chandelier exit" },
  { name: "VWAP Reversion / Trend", reason: "Requires intraday session data" },
  { name: "OBV Breakout", reason: "Requires OBV rolling high series" },
  { name: "Internal Bar Strength (IBS)", reason: "Requires intraday OHLC" },
  { name: "Linear Regression Channel", reason: "Not in indicator library" },
  { name: "Aroon Trend", reason: "Not in indicator library" },
];

export const DEFAULT_PATTERNS = STRATEGY_PRESETS.map((s) => s.pattern);

export const DEFAULT_STRATEGY_PRESET_ID = "exp-ema-ema";

export const EMA_CROSS_PATTERN =
  STRATEGY_PRESETS.find((s) => s.id === DEFAULT_STRATEGY_PRESET_ID)!.pattern;

export const RSI_OVERSOLD_PATTERN =
  STRATEGY_PRESETS.find((s) => s.id === "exp-rsi-oversold")!.pattern;

export function getStrategiesByCategory(): Record<string, StrategyPreset[]> {
  return STRATEGY_PRESETS.reduce<Record<string, StrategyPreset[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});
}
