import type { BacktestConfig, Expression, PatternDefinition } from "@/lib/types";

const BT: BacktestConfig = {
  entryOn: "close",
  exitOn: "opposite_signal",
  minTrades: 5,
};

export interface StrategyPreset {
  id: string;
  category: string;
  pattern: PatternDefinition;
  entryLogic: string;
  defaultParams: string;
  exitLogic: string;
}

function cross(
  left: string,
  right: string | number,
  op: "crosses_above" | "crosses_below" = "crosses_above",
): Expression {
  return {
    op,
    left: { ref: left },
    right: typeof right === "number" ? { value: right } : { ref: right },
  };
}

function gt(left: string, right: string | number): Expression {
  return {
    op: "gt",
    left: { ref: left },
    right: typeof right === "number" ? { value: right } : { ref: right },
  };
}
export const STRATEGY_PRESETS: StrategyPreset[] = [
  // ── Trend ─────────────────────────────────────────────────────────────
  {
    id: "sma-cross",
    category: "Trend",
    entryLogic: "Fast SMA crosses above slow SMA",
    defaultParams: "Fast=20, Slow=50",
    exitLogic: "Opposite crossover",
    pattern: {
      name: "SMA Crossover",
      description: "Fast SMA crosses above slow SMA",
      indicators: [
        { alias: "sma_fast", type: "sma", params: { length: 20, source: "close" } },
        { alias: "sma_slow", type: "sma", params: { length: 50, source: "close" } },
      ],
      entry: cross("sma_fast", "sma_slow"),
      exit: cross("sma_fast", "sma_slow", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "golden-cross",
    category: "Trend",
    entryLogic: "SMA50 crosses above SMA200",
    defaultParams: "Fast=50, Slow=200",
    exitLogic: "Death cross",
    pattern: {
      name: "Golden Cross",
      description: "SMA50 crosses above SMA200",
      indicators: [
        { alias: "sma_fast", type: "sma", params: { length: 50, source: "close" } },
        { alias: "sma_slow", type: "sma", params: { length: 200, source: "close" } },
      ],
      entry: cross("sma_fast", "sma_slow"),
      exit: cross("sma_fast", "sma_slow", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "ema-cross",
    category: "Trend",
    entryLogic: "Fast EMA crosses above slow EMA",
    defaultParams: "Fast=12, Slow=26",
    exitLogic: "Opposite crossover",
    pattern: {
      name: "EMA Crossover",
      description: "Fast EMA crosses above slow EMA",
      indicators: [
        { alias: "ema_fast", type: "ema", params: { length: 12, source: "close" } },
        { alias: "ema_slow", type: "ema", params: { length: 26, source: "close" } },
      ],
      entry: cross("ema_fast", "ema_slow"),
      exit: cross("ema_fast", "ema_slow", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "triple-ema",
    category: "Trend",
    entryLogic: "Fast EMA crosses medium while medium > slow",
    defaultParams: "10 / 20 / 50",
    exitLogic: "Fast EMA crosses below medium",
    pattern: {
      name: "Triple EMA Trend",
      description: "Fast EMA crosses above medium EMA in uptrend stack",
      indicators: [
        { alias: "ema_fast", type: "ema", params: { length: 10, source: "close" } },
        { alias: "ema_med", type: "ema", params: { length: 20, source: "close" } },
        { alias: "ema_slow", type: "ema", params: { length: 50, source: "close" } },
      ],
      filters: gt("ema_med", "ema_slow"),
      entry: cross("ema_fast", "ema_med"),
      exit: cross("ema_fast", "ema_med", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "price-above-sma",
    category: "Trend",
    entryLogic: "Close crosses above SMA200",
    defaultParams: "SMA=200",
    exitLogic: "Close below SMA200",
    pattern: {
      name: "Price Above SMA",
      description: "Close crosses above long-term SMA",
      indicators: [
        { alias: "sma_trend", type: "sma", params: { length: 200, source: "close" } },
      ],
      entry: cross("close", "sma_trend"),
      exit: cross("close", "sma_trend", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "adx-di-trend",
    category: "Trend",
    entryLogic: "+DI crosses above -DI with ADX > 25",
    defaultParams: "ADX=14, Threshold=25",
    exitLogic: "-DI crosses above +DI",
    pattern: {
      name: "ADX + DI Trend",
      description: "Directional trend with strong ADX",
      indicators: [{ alias: "dmi", type: "adx", params: { length: 14 } }],
      filters: gt("dmi_adx", 25),
      entry: cross("dmi_pdi", "dmi_mdi"),
      exit: cross("dmi_pdi", "dmi_mdi", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "parabolic-sar",
    category: "Trend",
    entryLogic: "Close crosses above Parabolic SAR",
    defaultParams: "Step=0.02, Max=0.20",
    exitLogic: "Close below SAR",
    pattern: {
      name: "Parabolic SAR",
      description: "Price crosses above Parabolic SAR",
      indicators: [{ alias: "sar", type: "psar", params: { step: 0.02, max: 0.2 } }],
      entry: cross("close", "sar"),
      exit: cross("close", "sar", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "dmi-breakout",
    category: "Trend",
    entryLogic: "+DI crosses above -DI",
    defaultParams: "DI=14",
    exitLogic: "Opposite DI cross",
    pattern: {
      name: "DMI Breakout",
      description: "Positive directional movement dominates",
      indicators: [{ alias: "dmi", type: "adx", params: { length: 14 } }],
      entry: cross("dmi_pdi", "dmi_mdi"),
      exit: cross("dmi_pdi", "dmi_mdi", "crosses_below"),
      backtest: BT,
    },
  },

  // ── Momentum ────────────────────────────────────────────────────────
  {
    id: "macd-cross",
    category: "Momentum",
    entryLogic: "MACD crosses above signal",
    defaultParams: "12 / 26 / 9",
    exitLogic: "MACD below signal",
    pattern: {
      name: "MACD Crossover",
      description: "MACD line crosses above signal line",
      indicators: [{ alias: "macd", type: "macd", params: { fast: 12, slow: 26, signal: 9 } }],
      entry: cross("macd_macd", "macd_signal"),
      exit: cross("macd_macd", "macd_signal", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "macd-zero",
    category: "Momentum",
    entryLogic: "MACD crosses above zero",
    defaultParams: "12 / 26 / 9",
    exitLogic: "MACD below zero",
    pattern: {
      name: "MACD Zero Line",
      description: "MACD crosses above zero line",
      indicators: [{ alias: "macd", type: "macd", params: { fast: 12, slow: 26, signal: 9 } }],
      entry: cross("macd_macd", 0),
      exit: cross("macd_macd", 0, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "rsi-momentum",
    category: "Momentum",
    entryLogic: "RSI crosses above 60",
    defaultParams: "RSI=14, Level=60",
    exitLogic: "RSI below 50",
    pattern: {
      name: "RSI Momentum",
      description: "RSI crosses above bullish threshold",
      indicators: [{ alias: "rsi", type: "rsi", params: { length: 14, source: "close" } }],
      entry: cross("rsi", 60),
      exit: cross("rsi", 50, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "roc-momentum",
    category: "Momentum",
    entryLogic: "ROC crosses above zero",
    defaultParams: "ROC=20",
    exitLogic: "ROC below zero",
    pattern: {
      name: "ROC Momentum",
      description: "Rate of change turns positive",
      indicators: [{ alias: "roc", type: "roc", params: { length: 20 } }],
      entry: cross("roc", 0),
      exit: cross("roc", 0, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "momentum-6m",
    category: "Momentum",
    entryLogic: "6-month return crosses above zero",
    defaultParams: "126 days",
    exitLogic: "Momentum turns negative",
    pattern: {
      name: "6-Month Momentum",
      description: "Positive medium-term price momentum",
      indicators: [{ alias: "mom", type: "momentum", params: { length: 126 } }],
      entry: cross("mom", 0),
      exit: cross("mom", 0, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "momentum-12m",
    category: "Momentum",
    entryLogic: "12-month return crosses above zero",
    defaultParams: "252 days",
    exitLogic: "Momentum turns negative",
    pattern: {
      name: "12-Month Momentum",
      description: "Positive long-term price momentum",
      indicators: [{ alias: "mom", type: "momentum", params: { length: 252 } }],
      entry: cross("mom", 0),
      exit: cross("mom", 0, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "cci-trend",
    category: "Momentum",
    entryLogic: "CCI crosses above +100",
    defaultParams: "CCI=20",
    exitLogic: "CCI below 0",
    pattern: {
      name: "CCI Trend Breakout",
      description: "CCI crosses above bullish threshold",
      indicators: [{ alias: "cci", type: "cci", params: { length: 20 } }],
      entry: cross("cci", 100),
      exit: cross("cci", 0, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "trix-cross",
    category: "Momentum",
    entryLogic: "TRIX crosses above signal",
    defaultParams: "TRIX=15, Signal=9",
    exitLogic: "TRIX below signal",
    pattern: {
      name: "TRIX Crossover",
      description: "TRIX crosses above signal line",
      indicators: [{ alias: "trix", type: "trix", params: { length: 15, signal: 9 } }],
      entry: cross("trix", "trix_signal"),
      exit: cross("trix", "trix_signal", "crosses_below"),
      backtest: BT,
    },
  },

  // ── Breakout ────────────────────────────────────────────────────────
  {
    id: "donchian",
    category: "Breakout",
    entryLogic: "Close breaks prior 20-day high",
    defaultParams: "20 days",
    exitLogic: "Close below 10-day low",
    pattern: {
      name: "Donchian Breakout",
      description: "Close breaks prior channel high",
      indicators: [
        { alias: "high_20", type: "rolling_high", params: { length: 20 } },
        { alias: "low_10", type: "rolling_low", params: { length: 10 } },
      ],
      entry: cross("close", "high_20"),
      exit: cross("close", "low_10", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "turtle",
    category: "Breakout",
    entryLogic: "Close breaks 55-day high",
    defaultParams: "Entry=55, Exit=20",
    exitLogic: "20-day low break",
    pattern: {
      name: "Turtle Breakout",
      description: "Classic turtle entry on 55-day high",
      indicators: [
        { alias: "high_55", type: "rolling_high", params: { length: 55 } },
        { alias: "low_20", type: "rolling_low", params: { length: 20 } },
      ],
      entry: cross("close", "high_55"),
      exit: cross("close", "low_20", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "52w-high",
    category: "Breakout",
    entryLogic: "Close breaks 252-day high",
    defaultParams: "252 days",
    exitLogic: "Close below 50-day low",
    pattern: {
      name: "52-Week High Breakout",
      description: "Close breaks annual high",
      indicators: [
        { alias: "high_252", type: "rolling_high", params: { length: 252 } },
        { alias: "low_50", type: "rolling_low", params: { length: 50 } },
      ],
      entry: cross("close", "high_252"),
      exit: cross("close", "low_50", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "nday-high",
    category: "Breakout",
    entryLogic: "Close breaks 50-day high",
    defaultParams: "50 days",
    exitLogic: "20-day low break",
    pattern: {
      name: "N-Day High Breakout",
      description: "Close breaks rolling high",
      indicators: [
        { alias: "high_50", type: "rolling_high", params: { length: 50 } },
        { alias: "low_20", type: "rolling_low", params: { length: 20 } },
      ],
      entry: cross("close", "high_50"),
      exit: cross("close", "low_20", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "bb-breakout",
    category: "Breakout",
    entryLogic: "Close crosses above upper Bollinger Band",
    defaultParams: "20, 2 SD",
    exitLogic: "Close below middle band",
    pattern: {
      name: "Bollinger Breakout",
      description: "Close breaks above upper band",
      indicators: [{ alias: "bb", type: "bb", params: { length: 20, stdDev: 2 } }],
      entry: cross("close", "bb_upper"),
      exit: cross("close", "bb_middle", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "keltner-breakout",
    category: "Breakout",
    entryLogic: "Close crosses above upper Keltner channel",
    defaultParams: "EMA=20, ATR=20, Mult=2",
    exitLogic: "Close below middle channel",
    pattern: {
      name: "Keltner Channel Breakout",
      description: "Close breaks above upper Keltner channel",
      indicators: [
        { alias: "kc", type: "keltner", params: { maPeriod: 20, atrPeriod: 20, multiplier: 2 } },
      ],
      entry: cross("close", "kc_upper"),
      exit: cross("close", "kc_middle", "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "volume-breakout",
    category: "Breakout",
    entryLogic: "Price breaks 20D high on above-average volume",
    defaultParams: "High=20D, Volume > avg",
    exitLogic: "10-day low break",
    pattern: {
      name: "Volume Price Breakout",
      description: "Breakout with elevated volume",
      indicators: [
        { alias: "high_20", type: "rolling_high", params: { length: 20 } },
        { alias: "low_10", type: "rolling_low", params: { length: 10 } },
        { alias: "vol_avg", type: "volume_sma", params: { length: 20 } },
      ],
      filters: gt("volume", "vol_avg"),
      entry: cross("close", "high_20"),
      exit: cross("close", "low_10", "crosses_below"),
      backtest: BT,
    },
  },

  // ── Mean Reversion ──────────────────────────────────────────────────
  {
    id: "rsi-oversold",
    category: "Mean Reversion",
    entryLogic: "RSI crosses back above 30",
    defaultParams: "RSI=14, Oversold=30",
    exitLogic: "RSI above 70",
    pattern: {
      name: "RSI Oversold Reversal",
      description: "RSI recovers from oversold",
      indicators: [{ alias: "rsi", type: "rsi", params: { length: 14, source: "close" } }],
      entry: cross("rsi", 30),
      exit: cross("rsi", 70, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "rsi2",
    category: "Mean Reversion",
    entryLogic: "RSI(2) crosses above 10",
    defaultParams: "RSI=2, Entry<10",
    exitLogic: "RSI above 70",
    pattern: {
      name: "RSI(2) Mean Reversion",
      description: "Short-term RSI extreme oversold bounce",
      indicators: [{ alias: "rsi", type: "rsi", params: { length: 2, source: "close" } }],
      entry: cross("rsi", 10),
      exit: cross("rsi", 70, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "bb-reversion",
    category: "Mean Reversion",
    entryLogic: "Close crosses back above lower Bollinger Band",
    defaultParams: "20, 2 SD",
    exitLogic: "Close reaches middle band",
    pattern: {
      name: "Bollinger Mean Reversion",
      description: "Buy dip below lower band, exit at mean",
      indicators: [{ alias: "bb", type: "bb", params: { length: 20, stdDev: 2 } }],
      entry: cross("close", "bb_lower"),
      exit: cross("close", "bb_middle"),
      backtest: BT,
    },
  },
  {
    id: "bb-percent-b",
    category: "Mean Reversion",
    entryLogic: "%B crosses above 0 from below",
    defaultParams: "20, 2 SD",
    exitLogic: "%B reaches 0.5",
    pattern: {
      name: "Bollinger %B Reversion",
      description: "%B recovers from below zero",
      indicators: [{ alias: "bb", type: "bb", params: { length: 20, stdDev: 2 } }],
      entry: cross("bb_percent_b", 0),
      exit: cross("bb_percent_b", 0.5, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "stochastic",
    category: "Mean Reversion",
    entryLogic: "%K crosses above %D from oversold",
    defaultParams: "14, 3, 3",
    exitLogic: "Overbought crossover",
    pattern: {
      name: "Stochastic Reversal",
      description: "%K crosses %D upward from oversold zone",
      indicators: [
        { alias: "stoch", type: "stochastic", params: { period: 14, signal: 3 } },
      ],
      filters: {
        op: "lt",
        left: { ref: "stoch_k" },
        right: { value: 30 },
      },
      entry: cross("stoch_k", "stoch_d"),
      exit: cross("stoch_k", 80, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "williams-r",
    category: "Mean Reversion",
    entryLogic: "Williams %R crosses above -80",
    defaultParams: "14, Oversold=-80",
    exitLogic: "%R below -20",
    pattern: {
      name: "Williams %R Reversal",
      description: "Williams %R recovers from oversold",
      indicators: [{ alias: "wr", type: "williamsr", params: { length: 14 } }],
      entry: cross("wr", -80),
      exit: cross("wr", -20, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "cci-reversal",
    category: "Mean Reversion",
    entryLogic: "CCI crosses above -100",
    defaultParams: "CCI=20",
    exitLogic: "CCI above 100",
    pattern: {
      name: "CCI Reversal",
      description: "CCI upward through oversold level",
      indicators: [{ alias: "cci", type: "cci", params: { length: 20 } }],
      entry: cross("cci", -100),
      exit: cross("cci", 100, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "mfi-reversal",
    category: "Mean Reversion",
    entryLogic: "MFI crosses above 20",
    defaultParams: "MFI=14",
    exitLogic: "MFI above 80",
    pattern: {
      name: "MFI Reversal",
      description: "Money flow recovers from oversold",
      indicators: [{ alias: "mfi", type: "mfi", params: { length: 14 } }],
      entry: cross("mfi", 20),
      exit: cross("mfi", 80, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "zscore-reversion",
    category: "Mean Reversion",
    entryLogic: "Z-score crosses above -2",
    defaultParams: "Lookback=20, Z<-2",
    exitLogic: "Z-score reaches 0",
    pattern: {
      name: "Z-Score Mean Reversion",
      description: "Price deviation from rolling mean reverts",
      indicators: [{ alias: "z", type: "zscore", params: { length: 20 } }],
      entry: cross("z", -2),
      exit: cross("z", 0, "crosses_below"),
      backtest: BT,
    },
  },
  {
    id: "ma-envelope",
    category: "Mean Reversion",
    entryLogic: "Close crosses back above lower MA envelope",
    defaultParams: "SMA=20, Envelope=3%",
    exitLogic: "Close reaches MA",
    pattern: {
      name: "Moving Average Envelope",
      description: "Buy at lower envelope, exit at MA",
      indicators: [{ alias: "env", type: "envelope", params: { length: 20, pct: 3 } }],
      entry: cross("close", "env_lower"),
      exit: cross("close", "env_middle"),
      backtest: BT,
    },
  },
  {
    id: "channel-reversion",
    category: "Mean Reversion",
    entryLogic: "Close crosses above 20-day low after dip",
    defaultParams: "Channel=20",
    exitLogic: "Close reaches prior 20-day high midpoint proxy",
    pattern: {
      name: "Price Channel Mean Reversion",
      description: "Buy near rolling low, exit toward channel mid",
      indicators: [
        { alias: "low_20", type: "rolling_low", params: { length: 20 } },
        { alias: "high_20", type: "rolling_high", params: { length: 20 } },
      ],
      entry: cross("close", "low_20"),
      exit: cross("close", "high_20", "crosses_below"),
      backtest: BT,
    },
  },
];

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
  { name: "Gap-Up / Gap-Down", reason: "Requires gap % bar logic" },
  { name: "Consecutive Down Days", reason: "Requires bar-pattern counter" },
  { name: "Internal Bar Strength (IBS)", reason: "Requires intraday OHLC" },
  { name: "Linear Regression Channel", reason: "Not in indicator library" },
  { name: "Aroon Trend", reason: "Not in indicator library" },
];

export const DEFAULT_PATTERNS = STRATEGY_PRESETS.map((s) => s.pattern);

export const EMA_CROSS_PATTERN =
  STRATEGY_PRESETS.find((s) => s.id === "ema-cross")!.pattern;

export const RSI_OVERSOLD_PATTERN =
  STRATEGY_PRESETS.find((s) => s.id === "rsi-oversold")!.pattern;

export function getStrategiesByCategory(): Record<string, StrategyPreset[]> {
  return STRATEGY_PRESETS.reduce<Record<string, StrategyPreset[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});
}
