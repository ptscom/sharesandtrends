import type { Expression, PatternDefinition } from "@/lib/types";
import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";
import type {
  ExplorationParamDef,
  ExplorationPreset,
} from "@/lib/explore/exploration-models";

export type { ExplorationPreset };

const OHLC_OPTIONS = [
  { value: "close", label: "Close" },
  { value: "open", label: "Open" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
];

const COMPARE_OPTIONS = [
  { value: "crosses_above", label: "Crosses above" },
  { value: "crosses_below", label: "Crosses below" },
  { value: "gt", label: "Above ( > )" },
  { value: "gte", label: "At or above ( >= )" },
  { value: "lt", label: "Below ( < )" },
  { value: "lte", label: "At or below ( <= )" },
];

const BB_BAND_OPTIONS = [
  { value: "upper", label: "Upper band" },
  { value: "middle", label: "Middle band" },
  { value: "lower", label: "Lower band" },
];

function toTf(mode: ExploreTimeframeMode) {
  return mode === "mtf" ? "1D" : mode;
}

function expr(
  op: Expression["op"],
  left: string,
  right: string | number,
): Expression {
  return {
    op,
    left: { ref: left },
    right: typeof right === "number" ? { value: right } : { ref: right },
  };
}

function opLabel(op: string): string {
  return COMPARE_OPTIONS.find((o) => o.value === op)?.label ?? op;
}

function priceLabel(price: string): string {
  return OHLC_OPTIONS.find((o) => o.value === price)?.label ?? price;
}

function buildOverlayVsPrice(
  overlayType: "sma" | "ema" | "wma",
  params: Record<string, number | string>,
  timeframeMode: ExploreTimeframeMode,
  name: string,
): PatternDefinition {
  const period = Number(params.period ?? 50);
  const price = String(params.price ?? "close");
  const op = String(params.op ?? "crosses_above") as Expression["op"];
  const alias = overlayType;

  return {
    name,
    indicators: [
      {
        alias,
        type: overlayType,
        params: { length: period, source: "close" },
        timeframe: toTf(timeframeMode),
      },
    ],
    entry: expr(op, price, alias),
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

function buildOverlayVsOverlay(
  overlayType: "sma" | "ema" | "wma",
  params: Record<string, number | string>,
  timeframeMode: ExploreTimeframeMode,
  name: string,
): PatternDefinition {
  const fast = Number(params.fastPeriod ?? 50);
  const slow = Number(params.slowPeriod ?? 200);
  const op = String(params.op ?? "crosses_above") as Expression["op"];

  return {
    name,
    indicators: [
      {
        alias: "fast",
        type: overlayType,
        params: { length: fast, source: "close" },
        timeframe: toTf(timeframeMode),
      },
      {
        alias: "slow",
        type: overlayType,
        params: { length: slow, source: "close" },
        timeframe: toTf(timeframeMode),
      },
    ],
    entry: expr(op, "fast", "slow"),
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

function buildOscillatorLevel(
  indicatorType: string,
  alias: string,
  outputKey: string,
  params: Record<string, number | string>,
  timeframeMode: ExploreTimeframeMode,
  name: string,
  defaultThreshold: number,
): PatternDefinition {
  const period = Number(params.period ?? 14);
  const threshold = Number(params.threshold ?? defaultThreshold);
  const op = String(params.op ?? "gt") as Expression["op"];

  const indicatorParams: Record<string, number | string> = { length: period };
  if (indicatorType === "cci") {
    indicatorParams.constant = 0.015;
  }

  return {
    name,
    indicators: [
      {
        alias,
        type: indicatorType,
        params: indicatorParams,
        timeframe: toTf(timeframeMode),
      },
    ],
    entry: expr(op, outputKey, threshold),
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

function buildStreakBreakoutOscillator(
  indicatorType: string,
  alias: string,
  outputKey: string,
  params: Record<string, number | string>,
  timeframeMode: ExploreTimeframeMode,
  name: string,
  defaultThreshold: number,
): PatternDefinition {
  const period = Number(params.period ?? 14);
  const threshold = Number(params.threshold ?? defaultThreshold);
  const minDays = Number(params.minDays ?? 100);
  const op = String(params.op ?? "crosses_above") as Expression["op"];
  const priorCompare = String(params.priorCompare ?? "below");
  const streakOp =
    priorCompare === "above" ? "streak_above" : "streak_below";

  const indicatorParams: Record<string, number | string> = { length: period };
  if (indicatorType === "cci") {
    indicatorParams.constant = 0.015;
  }

  return {
    name,
    indicators: [
      {
        alias,
        type: indicatorType,
        params: indicatorParams,
        timeframe: toTf(timeframeMode),
      },
    ],
    entry: expr(op, outputKey, threshold),
    filters: {
      op: streakOp,
      left: { ref: outputKey },
      right: { value: threshold },
      minBars: minDays,
    },
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

function buildLineCross(
  indicatorType: string,
  params: Record<string, number | string>,
  timeframeMode: ExploreTimeframeMode,
  name: string,
  leftKey: string,
  rightKey: string,
  indicatorParams: Record<string, number | string>,
): PatternDefinition {
  const op = String(params.op ?? "crosses_above") as Expression["op"];
  const alias = indicatorType;

  return {
    name,
    indicators: [
      {
        alias,
        type: indicatorType,
        params: indicatorParams,
        timeframe: toTf(timeframeMode),
      },
    ],
    entry: expr(op, leftKey, rightKey),
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

function buildMixedOverlayCross(
  fastType: "sma" | "ema" | "wma",
  slowType: "sma" | "ema" | "wma",
  params: Record<string, number | string>,
  timeframeMode: ExploreTimeframeMode,
  name: string,
): PatternDefinition {
  const fast = Number(params.fastPeriod ?? 20);
  const slow = Number(params.slowPeriod ?? 50);
  const op = String(params.op ?? "crosses_above") as Expression["op"];

  return {
    name,
    indicators: [
      {
        alias: "fast",
        type: fastType,
        params: { length: fast, source: "close" },
        timeframe: toTf(timeframeMode),
      },
      {
        alias: "slow",
        type: slowType,
        params: { length: slow, source: "close" },
        timeframe: toTf(timeframeMode),
      },
    ],
    entry: expr(op, "fast", "slow"),
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

function buildPriceVsChannel(
  channelType: "keltner" | "envelope",
  params: Record<string, number | string>,
  timeframeMode: ExploreTimeframeMode,
  name: string,
): PatternDefinition {
  const period = Number(params.period ?? 20);
  const price = String(params.price ?? "close");
  const band = String(params.band ?? "upper");
  const op = String(params.op ?? "crosses_above") as Expression["op"];
  const alias = channelType;
  const bandRef =
    band === "middle"
      ? `${alias}_middle`
      : band === "lower"
        ? `${alias}_lower`
        : `${alias}_upper`;

  const indicatorParams: Record<string, number | string> = {};
  if (channelType === "keltner") {
    indicatorParams.maPeriod = period;
    indicatorParams.atrPeriod = Number(params.atrPeriod ?? 10);
    indicatorParams.multiplier = Number(params.multiplier ?? 2);
  } else {
    indicatorParams.length = period;
    indicatorParams.pct = Number(params.pct ?? params.percent ?? 2.5);
  }

  return {
    name,
    indicators: [
      {
        alias,
        type: channelType,
        params: indicatorParams,
        timeframe: toTf(timeframeMode),
      },
    ],
    entry: expr(op, price, bandRef),
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

const LEVEL_COMPARE_OPTIONS = [
  { value: "gt", label: "Above ( > )" },
  { value: "gte", label: "At or above ( >= )" },
  { value: "lt", label: "Below ( < )" },
  { value: "lte", label: "At or below ( <= )" },
];

const CROSS_COMPARE_OPTIONS = [
  { value: "crosses_above", label: "Crosses above" },
  { value: "crosses_below", label: "Crosses below" },
];

const MIN_DAYS_PARAM: ExplorationParamDef = {
  key: "minDays",
  label: "Min days prior",
  type: "int",
  default: 100,
  min: 1,
  max: 500,
};

const PRIOR_COMPARE_OPTIONS = [
  { value: "below", label: "Below level" },
  { value: "above", label: "Above level" },
];

const PERIOD_PARAM: ExplorationParamDef = {
  key: "period",
  label: "Period",
  type: "int",
  default: 50,
  min: 2,
  max: 500,
};

const FAST_PERIOD_PARAM: ExplorationParamDef = {
  key: "fastPeriod",
  label: "Fast period",
  type: "int",
  default: 50,
  min: 2,
  max: 500,
};

const SLOW_PERIOD_PARAM: ExplorationParamDef = {
  key: "slowPeriod",
  label: "Slow period",
  type: "int",
  default: 200,
  min: 2,
  max: 500,
};

const PRICE_PARAM: ExplorationParamDef = {
  key: "price",
  label: "Price",
  type: "enum",
  default: "close",
  options: OHLC_OPTIONS,
};

const OP_PARAM: ExplorationParamDef = {
  key: "op",
  label: "Condition",
  type: "enum",
  default: "crosses_above",
  options: COMPARE_OPTIONS,
};

const LOOKBACK_PARAM: ExplorationParamDef = {
  key: "lookback",
  label: "Lookback bars",
  type: "int",
  default: 200,
  min: 2,
  max: 500,
};

const DARVAS_LOOKBACK_PARAM: ExplorationParamDef = {
  key: "lookback",
  label: "Box lookback",
  type: "int",
  default: 20,
  min: 2,
  max: 300,
};

function buildRollingExtremeBreak(
  direction: "high" | "low",
  params: Record<string, number | string>,
  timeframeMode: ExploreTimeframeMode,
  name: string,
): PatternDefinition {
  const lookback = Number(params.lookback ?? 200);
  const defaultPrice = direction === "high" ? "high" : "low";
  const defaultOp = direction === "high" ? "crosses_above" : "crosses_below";
  const price = String(params.price ?? defaultPrice);
  const op = String(params.op ?? defaultOp) as Expression["op"];
  const alias = direction === "high" ? "rolling_high" : "rolling_low";
  const indicatorType = direction === "high" ? "rolling_high" : "rolling_low";

  return {
    name,
    indicators: [
      {
        alias,
        type: indicatorType,
        params: { length: lookback },
        timeframe: toTf(timeframeMode),
      },
    ],
    entry: expr(op, price, alias),
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

const CHART_LOOKBACK_PARAM: ExplorationParamDef = {
  key: "lookback",
  label: "Lookback bars",
  type: "int",
  default: 60,
  min: 15,
  max: 300,
};

function buildChartPattern(
  patternId: string,
  params: Record<string, number | string>,
  timeframeMode: ExploreTimeframeMode,
  name: string,
): PatternDefinition {
  const lookback = Number(params.lookback ?? 60);

  return {
    name,
    indicators: [
      {
        alias: "chart_pattern",
        type: "chart_pattern",
        params: { pattern: patternId, lookback },
        timeframe: toTf(timeframeMode),
      },
    ],
    entry: expr("gt", "chart_pattern", 0.5),
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

function buildDarvasBreakout(
  direction: "up" | "down",
  params: Record<string, number | string>,
  timeframeMode: ExploreTimeframeMode,
  name: string,
): PatternDefinition {
  const lookback = Number(params.lookback ?? 20);
  const price = String(params.price ?? "close");
  const op =
    direction === "up"
      ? (String(params.op ?? "crosses_above") as Expression["op"])
      : (String(params.op ?? "crosses_below") as Expression["op"]);
  const bandRef =
    direction === "up" ? "darvas_box_top_prior" : "darvas_box_bottom_prior";

  return {
    name,
    indicators: [
      {
        alias: "darvas_box",
        type: "darvas_box",
        params: { lookback },
        timeframe: toTf(timeframeMode),
      },
    ],
    entry: expr(op, price, bandRef),
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

export const EXPLORATION_PRESETS: ExplorationPreset[] = [
  {
    id: "exp-sma-price",
    name: "SMA vs Price",
    category: "Moving Averages",
    kind: "overlay_vs_price",
    description: "Compare price to a simple moving average",
    params: [PERIOD_PARAM, PRICE_PARAM, OP_PARAM],
    buildPattern: (params, tf) =>
      buildOverlayVsPrice("sma", params, tf, "SMA vs Price"),
    describe: (params) => {
      const period = Number(params.period ?? 50);
      const price = String(params.price ?? "close");
      const op = String(params.op ?? "crosses_above");
      return `${priceLabel(price)} ${opLabel(op).toLowerCase()} SMA(${period})`;
    },
  },
  {
    id: "exp-ema-price",
    name: "EMA vs Price",
    category: "Moving Averages",
    kind: "overlay_vs_price",
    description: "Compare price to an exponential moving average",
    params: [PERIOD_PARAM, PRICE_PARAM, OP_PARAM],
    buildPattern: (params, tf) =>
      buildOverlayVsPrice("ema", params, tf, "EMA vs Price"),
    describe: (params) => {
      const period = Number(params.period ?? 50);
      const price = String(params.price ?? "close");
      const op = String(params.op ?? "crosses_above");
      return `${priceLabel(price)} ${opLabel(op).toLowerCase()} EMA(${period})`;
    },
  },
  {
    id: "exp-sma-sma",
    name: "SMA Crossover",
    category: "Moving Averages",
    kind: "overlay_vs_overlay",
    description: "Fast SMA crossing slow SMA (e.g. golden cross)",
    params: [FAST_PERIOD_PARAM, SLOW_PERIOD_PARAM, OP_PARAM],
    buildPattern: (params, tf) =>
      buildOverlayVsOverlay("sma", params, tf, "SMA Crossover"),
    describe: (params) => {
      const fast = Number(params.fastPeriod ?? 50);
      const slow = Number(params.slowPeriod ?? 200);
      const op = String(params.op ?? "crosses_above");
      return `SMA(${fast}) ${opLabel(op).toLowerCase()} SMA(${slow})`;
    },
  },
  {
    id: "exp-ema-ema",
    name: "EMA Crossover",
    category: "Moving Averages",
    kind: "overlay_vs_overlay",
    description: "Fast EMA crossing slow EMA",
    params: [FAST_PERIOD_PARAM, SLOW_PERIOD_PARAM, OP_PARAM],
    buildPattern: (params, tf) =>
      buildOverlayVsOverlay("ema", params, tf, "EMA Crossover"),
    describe: (params) => {
      const fast = Number(params.fastPeriod ?? 50);
      const slow = Number(params.slowPeriod ?? 200);
      const op = String(params.op ?? "crosses_above");
      return `EMA(${fast}) ${opLabel(op).toLowerCase()} EMA(${slow})`;
    },
  },
  {
    id: "exp-rsi-level",
    name: "RSI Level",
    category: "Oscillators",
    kind: "oscillator_level",
    description: "RSI above or below a threshold",
    params: [
      { key: "period", label: "Period", type: "int", default: 14, min: 2, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: 50, min: 0, max: 100 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "gt",
        options: [
          { value: "gt", label: "Above ( > )" },
          { value: "gte", label: "At or above ( >= )" },
          { value: "lt", label: "Below ( < )" },
          { value: "lte", label: "At or below ( <= )" },
        ],
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel("rsi", "rsi", "rsi", params, tf, "RSI Level", 50),
    describe: (params) => {
      const period = Number(params.period ?? 14);
      const threshold = Number(params.threshold ?? 50);
      const op = String(params.op ?? "gt");
      return `RSI(${period}) ${opLabel(op).toLowerCase()} ${threshold}`;
    },
  },
  {
    id: "exp-cci-level",
    name: "CCI Level",
    category: "Oscillators",
    kind: "oscillator_level",
    description: "CCI above or below a threshold",
    params: [
      { key: "period", label: "Period", type: "int", default: 20, min: 2, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: 0, min: -300, max: 300 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "gt",
        options: [
          { value: "gt", label: "Above ( > )" },
          { value: "lt", label: "Below ( < )" },
        ],
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel("cci", "cci", "cci", params, tf, "CCI Level", 0),
    describe: (params) => {
      const period = Number(params.period ?? 20);
      const threshold = Number(params.threshold ?? 0);
      const op = String(params.op ?? "gt");
      return `CCI(${period}) ${opLabel(op).toLowerCase()} ${threshold}`;
    },
  },
  {
    id: "exp-adx-level",
    name: "ADX Level",
    category: "Trend",
    kind: "oscillator_level",
    description: "ADX trend strength above a threshold",
    params: [
      { key: "period", label: "Period", type: "int", default: 14, min: 2, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: 25, min: 0, max: 100 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "gt",
        options: [
          { value: "gt", label: "Above ( > )" },
          { value: "gte", label: "At or above ( >= )" },
        ],
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel("adx", "adx", "adx_adx", params, tf, "ADX Level", 25),
    describe: (params) => {
      const period = Number(params.period ?? 14);
      const threshold = Number(params.threshold ?? 25);
      const op = String(params.op ?? "gt");
      return `ADX(${period}) ${opLabel(op).toLowerCase()} ${threshold}`;
    },
  },
  {
    id: "exp-macd-cross",
    name: "MACD Cross",
    category: "Oscillators",
    kind: "line_cross",
    description: "MACD line crossing signal line",
    params: [
      { key: "fast", label: "Fast", type: "int", default: 12, min: 2, max: 50 },
      { key: "slow", label: "Slow", type: "int", default: 26, min: 2, max: 100 },
      { key: "signal", label: "Signal", type: "int", default: 9, min: 2, max: 50 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_above",
        options: [
          { value: "crosses_above", label: "Crosses above signal" },
          { value: "crosses_below", label: "Crosses below signal" },
        ],
      },
    ],
    buildPattern: (params, tf) =>
      buildLineCross(
        "macd",
        params,
        tf,
        "MACD Cross",
        "macd_macd",
        "macd_signal",
        {
          fast: Number(params.fast ?? 12),
          slow: Number(params.slow ?? 26),
          signal: Number(params.signal ?? 9),
        },
      ),
    describe: (params) => {
      const op = String(params.op ?? "crosses_above");
      return `MACD ${opLabel(op).toLowerCase()} signal`;
    },
  },
  {
    id: "exp-stoch-cross",
    name: "Stochastic Cross",
    category: "Oscillators",
    kind: "line_cross",
    description: "%K crossing %D",
    params: [
      { key: "k", label: "%K period", type: "int", default: 14, min: 2, max: 50 },
      { key: "d", label: "%D period", type: "int", default: 3, min: 1, max: 20 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_above",
        options: [
          { value: "crosses_above", label: "%K crosses above %D" },
          { value: "crosses_below", label: "%K crosses below %D" },
        ],
      },
    ],
    buildPattern: (params, tf) =>
      buildLineCross(
        "stochastic",
        params,
        tf,
        "Stochastic Cross",
        "stochastic_k",
        "stochastic_d",
        {
          k: Number(params.k ?? 14),
          d: Number(params.d ?? 3),
        },
      ),
    describe: (params) => {
      const op = String(params.op ?? "crosses_above");
      return `%K ${opLabel(op).toLowerCase()} %D`;
    },
  },
  {
    id: "exp-price-bb",
    name: "Price vs Bollinger",
    category: "Volatility",
    kind: "price_vs_band",
    description: "Price relative to Bollinger Band",
    params: [
      { key: "period", label: "Period", type: "int", default: 20, min: 2, max: 200 },
      { key: "std", label: "Std dev", type: "float", default: 2, min: 0.5, max: 5 },
      PRICE_PARAM,
      {
        key: "band",
        label: "Band",
        type: "enum",
        default: "upper",
        options: BB_BAND_OPTIONS,
      },
      OP_PARAM,
    ],
    buildPattern: (params, tf) => {
      const period = Number(params.period ?? 20);
      const std = Number(params.std ?? 2);
      const price = String(params.price ?? "close");
      const band = String(params.band ?? "upper");
      const op = String(params.op ?? "crosses_above") as Expression["op"];
      const bandRef =
        band === "middle" ? "bb_middle" : band === "lower" ? "bb_lower" : "bb_upper";

      return {
        name: "Price vs Bollinger",
        indicators: [
          {
            alias: "bb",
            type: "bb",
            params: { length: period, std },
            timeframe: toTf(tf),
          },
        ],
        entry: expr(op, price, bandRef),
        backtest: { entryOn: "close", exitOn: "opposite_signal" },
      };
    },
    describe: (params) => {
      const period = Number(params.period ?? 20);
      const price = String(params.price ?? "close");
      const band = String(params.band ?? "upper");
      const op = String(params.op ?? "crosses_above");
      const bandLabel =
        BB_BAND_OPTIONS.find((b) => b.value === band)?.label ?? band;
      return `${priceLabel(price)} ${opLabel(op).toLowerCase()} BB ${bandLabel} (${period})`;
    },
  },
  {
    id: "exp-wma-price",
    name: "WMA vs Price",
    category: "Moving Averages",
    kind: "overlay_vs_price",
    description: "Compare price to a weighted moving average",
    params: [PERIOD_PARAM, PRICE_PARAM, OP_PARAM],
    buildPattern: (params, tf) =>
      buildOverlayVsPrice("wma", params, tf, "WMA vs Price"),
    describe: (params) => {
      const period = Number(params.period ?? 50);
      const price = String(params.price ?? "close");
      const op = String(params.op ?? "crosses_above");
      return `${priceLabel(price)} ${opLabel(op).toLowerCase()} WMA(${period})`;
    },
  },
  {
    id: "exp-wma-wma",
    name: "WMA Crossover",
    category: "Moving Averages",
    kind: "overlay_vs_overlay",
    description: "Fast WMA crossing slow WMA",
    params: [FAST_PERIOD_PARAM, SLOW_PERIOD_PARAM, OP_PARAM],
    buildPattern: (params, tf) =>
      buildOverlayVsOverlay("wma", params, tf, "WMA Crossover"),
    describe: (params) => {
      const fast = Number(params.fastPeriod ?? 50);
      const slow = Number(params.slowPeriod ?? 200);
      const op = String(params.op ?? "crosses_above");
      return `WMA(${fast}) ${opLabel(op).toLowerCase()} WMA(${slow})`;
    },
  },
  {
    id: "exp-ema-sma",
    name: "EMA vs SMA",
    category: "Moving Averages",
    kind: "overlay_vs_overlay",
    description: "Fast EMA crossing slow SMA",
    params: [
      { ...FAST_PERIOD_PARAM, default: 20 },
      { ...SLOW_PERIOD_PARAM, default: 50 },
      OP_PARAM,
    ],
    buildPattern: (params, tf) =>
      buildMixedOverlayCross("ema", "sma", params, tf, "EMA vs SMA"),
    describe: (params) => {
      const fast = Number(params.fastPeriod ?? 20);
      const slow = Number(params.slowPeriod ?? 50);
      const op = String(params.op ?? "crosses_above");
      return `EMA(${fast}) ${opLabel(op).toLowerCase()} SMA(${slow})`;
    },
  },
  {
    id: "exp-ema-9-21",
    name: "EMA 9/21 Cross",
    category: "Moving Averages",
    kind: "overlay_vs_overlay",
    description: "Short-term EMA crossing medium EMA",
    params: [
      { ...FAST_PERIOD_PARAM, default: 9, label: "Fast EMA" },
      { ...SLOW_PERIOD_PARAM, default: 21, label: "Slow EMA" },
      OP_PARAM,
    ],
    buildPattern: (params, tf) =>
      buildOverlayVsOverlay("ema", params, tf, "EMA 9/21 Cross"),
    describe: (params) => {
      const fast = Number(params.fastPeriod ?? 9);
      const slow = Number(params.slowPeriod ?? 21);
      const op = String(params.op ?? "crosses_above");
      return `EMA(${fast}) ${opLabel(op).toLowerCase()} EMA(${slow})`;
    },
  },
  {
    id: "exp-sma-10-20",
    name: "SMA 10/20 Cross",
    category: "Moving Averages",
    kind: "overlay_vs_overlay",
    description: "Short-term SMA golden cross",
    params: [
      { ...FAST_PERIOD_PARAM, default: 10, label: "Fast SMA" },
      { ...SLOW_PERIOD_PARAM, default: 20, label: "Slow SMA" },
      OP_PARAM,
    ],
    buildPattern: (params, tf) =>
      buildOverlayVsOverlay("sma", params, tf, "SMA 10/20 Cross"),
    describe: (params) => {
      const fast = Number(params.fastPeriod ?? 10);
      const slow = Number(params.slowPeriod ?? 20);
      const op = String(params.op ?? "crosses_above");
      return `SMA(${fast}) ${opLabel(op).toLowerCase()} SMA(${slow})`;
    },
  },
  {
    id: "exp-price-psar",
    name: "Price vs Parabolic SAR",
    category: "Moving Averages",
    kind: "overlay_vs_price",
    description: "Price crossing Parabolic SAR",
    params: [PRICE_PARAM, OP_PARAM],
    buildPattern: (params, tf) => {
      const price = String(params.price ?? "close");
      const op = String(params.op ?? "crosses_above") as Expression["op"];
      return {
        name: "Price vs Parabolic SAR",
        indicators: [
          {
            alias: "psar",
            type: "psar",
            params: { step: 0.02, max: 0.2 },
            timeframe: toTf(tf),
          },
        ],
        entry: expr(op, price, "psar"),
        backtest: { entryOn: "close", exitOn: "opposite_signal" },
      };
    },
    describe: (params) => {
      const price = String(params.price ?? "close");
      const op = String(params.op ?? "crosses_above");
      return `${priceLabel(price)} ${opLabel(op).toLowerCase()} PSAR`;
    },
  },
  {
    id: "exp-price-vwap",
    name: "Price vs VWAP",
    category: "Moving Averages",
    kind: "overlay_vs_price",
    description: "Price relative to volume-weighted average price",
    params: [PRICE_PARAM, OP_PARAM],
    buildPattern: (params, tf) => {
      const price = String(params.price ?? "close");
      const op = String(params.op ?? "crosses_above") as Expression["op"];
      return {
        name: "Price vs VWAP",
        indicators: [
          {
            alias: "vwap",
            type: "vwap",
            params: {},
            timeframe: toTf(tf),
          },
        ],
        entry: expr(op, price, "vwap"),
        backtest: { entryOn: "close", exitOn: "opposite_signal" },
      };
    },
    describe: (params) => {
      const price = String(params.price ?? "close");
      const op = String(params.op ?? "crosses_above");
      return `${priceLabel(price)} ${opLabel(op).toLowerCase()} VWAP`;
    },
  },
  {
    id: "exp-adx-di-cross",
    name: "+DI vs -DI",
    category: "Trend",
    kind: "line_cross",
    description: "Directional movement index line cross",
    params: [
      { key: "period", label: "Period", type: "int", default: 14, min: 2, max: 100 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_above",
        options: CROSS_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildLineCross(
        "adx",
        params,
        tf,
        "+DI vs -DI",
        "adx_pdi",
        "adx_mdi",
        { length: Number(params.period ?? 14) },
      ),
    describe: (params) => {
      const op = String(params.op ?? "crosses_above");
      return `+DI ${opLabel(op).toLowerCase()} -DI`;
    },
  },
  {
    id: "exp-rsi-oversold",
    name: "RSI Oversold",
    category: "Oscillators",
    kind: "oscillator_level",
    description: "RSI below 30 — potential bounce",
    params: [
      { key: "period", label: "Period", type: "int", default: 14, min: 2, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: 30, min: 0, max: 100 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "lt",
        options: LEVEL_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel("rsi", "rsi", "rsi", params, tf, "RSI Oversold", 30),
    describe: (params) => {
      const period = Number(params.period ?? 14);
      const threshold = Number(params.threshold ?? 30);
      const op = String(params.op ?? "lt");
      return `RSI(${period}) ${opLabel(op).toLowerCase()} ${threshold}`;
    },
  },
  {
    id: "exp-rsi-overbought",
    name: "RSI Overbought",
    category: "Oscillators",
    kind: "oscillator_level",
    description: "RSI above 70 — potential pullback",
    params: [
      { key: "period", label: "Period", type: "int", default: 14, min: 2, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: 70, min: 0, max: 100 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "gt",
        options: LEVEL_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel("rsi", "rsi", "rsi", params, tf, "RSI Overbought", 70),
    describe: (params) => {
      const period = Number(params.period ?? 14);
      const threshold = Number(params.threshold ?? 70);
      const op = String(params.op ?? "gt");
      return `RSI(${period}) ${opLabel(op).toLowerCase()} ${threshold}`;
    },
  },
  {
    id: "exp-rsi-cross-50",
    name: "RSI Cross 50",
    category: "Oscillators",
    kind: "oscillator_level",
    description: "RSI crossing the 50 midline",
    params: [
      { key: "period", label: "Period", type: "int", default: 14, min: 2, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: 50, min: 0, max: 100 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_above",
        options: CROSS_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel("rsi", "rsi", "rsi", params, tf, "RSI Cross 50", 50),
    describe: (params) => {
      const period = Number(params.period ?? 14);
      const op = String(params.op ?? "crosses_above");
      return `RSI(${period}) ${opLabel(op).toLowerCase()} 50`;
    },
  },
  {
    id: "exp-rsi-breakout-after-consolidation",
    name: "RSI Breakout After Consolidation",
    category: "Oscillators",
    kind: "streak_breakout",
    description:
      "RSI crosses above a level after staying below it for many consecutive days",
    params: [
      { key: "period", label: "Period", type: "int", default: 14, min: 2, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: 60, min: 0, max: 100 },
      MIN_DAYS_PARAM,
      {
        key: "priorCompare",
        label: "Prior stretch",
        type: "enum",
        default: "below",
        options: PRIOR_COMPARE_OPTIONS,
      },
      {
        key: "op",
        label: "Trigger",
        type: "enum",
        default: "crosses_above",
        options: CROSS_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildStreakBreakoutOscillator(
        "rsi",
        "rsi",
        "rsi",
        params,
        tf,
        "RSI Breakout After Consolidation",
        60,
      ),
    describe: (params) => {
      const period = Number(params.period ?? 14);
      const threshold = Number(params.threshold ?? 60);
      const minDays = Number(params.minDays ?? 100);
      const op = String(params.op ?? "crosses_above");
      const priorCompare = String(params.priorCompare ?? "below");
      return `RSI(${period}) ${priorCompare} ${threshold} for ${minDays}+ days, then ${opLabel(op).toLowerCase()} ${threshold}`;
    },
  },
  {
    id: "exp-williamsr-oversold",
    name: "Williams %R Oversold",
    category: "Oscillators",
    kind: "oscillator_level",
    description: "Williams %R below -80",
    params: [
      { key: "period", label: "Period", type: "int", default: 14, min: 2, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: -80, min: -100, max: 0 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "lt",
        options: LEVEL_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel(
        "williamsr",
        "williamsr",
        "williamsr",
        params,
        tf,
        "Williams %R Oversold",
        -80,
      ),
    describe: (params) => {
      const period = Number(params.period ?? 14);
      const threshold = Number(params.threshold ?? -80);
      const op = String(params.op ?? "lt");
      return `Williams %R(${period}) ${opLabel(op).toLowerCase()} ${threshold}`;
    },
  },
  {
    id: "exp-mfi-oversold",
    name: "MFI Oversold",
    category: "Oscillators",
    kind: "oscillator_level",
    description: "Money Flow Index below 20",
    params: [
      { key: "period", label: "Period", type: "int", default: 14, min: 2, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: 20, min: 0, max: 100 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "lt",
        options: LEVEL_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel("mfi", "mfi", "mfi", params, tf, "MFI Oversold", 20),
    describe: (params) => {
      const period = Number(params.period ?? 14);
      const threshold = Number(params.threshold ?? 20);
      const op = String(params.op ?? "lt");
      return `MFI(${period}) ${opLabel(op).toLowerCase()} ${threshold}`;
    },
  },
  {
    id: "exp-roc-cross-zero",
    name: "ROC Cross Zero",
    category: "Oscillators",
    kind: "oscillator_level",
    description: "Rate of change crossing zero",
    params: [
      { key: "period", label: "Period", type: "int", default: 12, min: 2, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: 0, min: -100, max: 100 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_above",
        options: CROSS_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel("roc", "roc", "roc", params, tf, "ROC Cross Zero", 0),
    describe: (params) => {
      const period = Number(params.period ?? 12);
      const op = String(params.op ?? "crosses_above");
      return `ROC(${period}) ${opLabel(op).toLowerCase()} 0`;
    },
  },
  {
    id: "exp-momentum-positive",
    name: "Momentum Positive",
    category: "Oscillators",
    kind: "oscillator_level",
    description: "Momentum above zero",
    params: [
      { key: "period", label: "Period", type: "int", default: 10, min: 2, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: 0, min: -1000, max: 1000 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "gt",
        options: LEVEL_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel(
        "momentum",
        "momentum",
        "momentum",
        params,
        tf,
        "Momentum Positive",
        0,
      ),
    describe: (params) => {
      const period = Number(params.period ?? 10);
      const op = String(params.op ?? "gt");
      return `Momentum(${period}) ${opLabel(op).toLowerCase()} 0`;
    },
  },
  {
    id: "exp-stoch-rsi-cross",
    name: "Stoch RSI Cross",
    category: "Oscillators",
    kind: "line_cross",
    description: "Stochastic RSI %K crossing %D",
    params: [
      { key: "rsiPeriod", label: "RSI period", type: "int", default: 14, min: 2, max: 50 },
      { key: "stochPeriod", label: "Stoch period", type: "int", default: 14, min: 2, max: 50 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_above",
        options: CROSS_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildLineCross(
        "stoch_rsi",
        params,
        tf,
        "Stoch RSI Cross",
        "stoch_rsi_k",
        "stoch_rsi_d",
        {
          rsiPeriod: Number(params.rsiPeriod ?? 14),
          stochasticPeriod: Number(params.stochPeriod ?? 14),
          kPeriod: 3,
          dPeriod: 3,
        },
      ),
    describe: (params) => {
      const op = String(params.op ?? "crosses_above");
      return `Stoch RSI %K ${opLabel(op).toLowerCase()} %D`;
    },
  },
  {
    id: "exp-trix-cross",
    name: "TRIX Cross",
    category: "Oscillators",
    kind: "line_cross",
    description: "TRIX line crossing signal",
    params: [
      { key: "period", label: "Period", type: "int", default: 15, min: 2, max: 50 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_above",
        options: CROSS_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildLineCross(
        "trix",
        params,
        tf,
        "TRIX Cross",
        "trix_trix",
        "trix_signal",
        { length: Number(params.period ?? 15) },
      ),
    describe: (params) => {
      const op = String(params.op ?? "crosses_above");
      return `TRIX ${opLabel(op).toLowerCase()} signal`;
    },
  },
  {
    id: "exp-kst-cross",
    name: "KST Cross",
    category: "Oscillators",
    kind: "line_cross",
    description: "Know Sure Thing crossing signal line",
    params: [
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_above",
        options: CROSS_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildLineCross(
        "kst",
        params,
        tf,
        "KST Cross",
        "kst_kst",
        "kst_signal",
        {},
      ),
    describe: (params) => {
      const op = String(params.op ?? "crosses_above");
      return `KST ${opLabel(op).toLowerCase()} signal`;
    },
  },
  {
    id: "exp-ao-cross-zero",
    name: "Awesome Oscillator",
    category: "Oscillators",
    kind: "oscillator_level",
    description: "AO crossing above or below zero",
    params: [
      { key: "threshold", label: "Level", type: "float", default: 0, min: -10, max: 10 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_above",
        options: CROSS_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) => {
      const threshold = Number(params.threshold ?? 0);
      const op = String(params.op ?? "crosses_above") as Expression["op"];
      return {
        name: "Awesome Oscillator",
        indicators: [
          {
            alias: "ao",
            type: "awesome_oscillator",
            params: { fastPeriod: 5, slowPeriod: 34 },
            timeframe: toTf(tf),
          },
        ],
        entry: expr(op, "ao", threshold),
        backtest: { entryOn: "close", exitOn: "opposite_signal" },
      };
    },
    describe: (params) => {
      const op = String(params.op ?? "crosses_above");
      return `AO ${opLabel(op).toLowerCase()} 0`;
    },
  },
  {
    id: "exp-force-index-positive",
    name: "Force Index",
    category: "Oscillators",
    kind: "oscillator_level",
    description: "Force Index above zero",
    params: [
      { key: "period", label: "Period", type: "int", default: 13, min: 1, max: 50 },
      { key: "threshold", label: "Level", type: "float", default: 0, min: -1000, max: 1000 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "gt",
        options: LEVEL_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel(
        "force_index",
        "force_index",
        "force_index",
        params,
        tf,
        "Force Index",
        0,
      ),
    describe: (params) => {
      const period = Number(params.period ?? 13);
      const op = String(params.op ?? "gt");
      return `Force Index(${period}) ${opLabel(op).toLowerCase()} 0`;
    },
  },
  {
    id: "exp-zscore-oversold",
    name: "Z-Score Oversold",
    category: "Oscillators",
    kind: "oscillator_level",
    description: "Price z-score below -2 (statistical dip)",
    params: [
      { key: "period", label: "Period", type: "int", default: 20, min: 5, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: -2, min: -5, max: 5 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "lt",
        options: LEVEL_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel(
        "zscore",
        "zscore",
        "zscore",
        params,
        tf,
        "Z-Score Oversold",
        -2,
      ),
    describe: (params) => {
      const period = Number(params.period ?? 20);
      const threshold = Number(params.threshold ?? -2);
      const op = String(params.op ?? "lt");
      return `Z-Score(${period}) ${opLabel(op).toLowerCase()} ${threshold}`;
    },
  },
  {
    id: "exp-price-keltner",
    name: "Price vs Keltner",
    category: "Volatility",
    kind: "price_vs_band",
    description: "Price relative to Keltner channel",
    params: [
      { key: "period", label: "Period", type: "int", default: 20, min: 2, max: 200 },
      PRICE_PARAM,
      {
        key: "band",
        label: "Band",
        type: "enum",
        default: "upper",
        options: BB_BAND_OPTIONS,
      },
      OP_PARAM,
    ],
    buildPattern: (params, tf) =>
      buildPriceVsChannel("keltner", params, tf, "Price vs Keltner"),
    describe: (params) => {
      const period = Number(params.period ?? 20);
      const price = String(params.price ?? "close");
      const band = String(params.band ?? "upper");
      const op = String(params.op ?? "crosses_above");
      const bandLabel =
        BB_BAND_OPTIONS.find((b) => b.value === band)?.label ?? band;
      return `${priceLabel(price)} ${opLabel(op).toLowerCase()} Keltner ${bandLabel} (${period})`;
    },
  },
  {
    id: "exp-price-envelope",
    name: "Price vs Envelope",
    category: "Volatility",
    kind: "price_vs_band",
    description: "Price relative to moving average envelope",
    params: [
      { key: "period", label: "Period", type: "int", default: 20, min: 2, max: 200 },
      { key: "pct", label: "Percent", type: "float", default: 2.5, min: 0.5, max: 10 },
      PRICE_PARAM,
      {
        key: "band",
        label: "Band",
        type: "enum",
        default: "upper",
        options: BB_BAND_OPTIONS,
      },
      OP_PARAM,
    ],
    buildPattern: (params, tf) =>
      buildPriceVsChannel("envelope", params, tf, "Price vs Envelope"),
    describe: (params) => {
      const period = Number(params.period ?? 20);
      const price = String(params.price ?? "close");
      const band = String(params.band ?? "upper");
      const op = String(params.op ?? "crosses_above");
      const bandLabel =
        BB_BAND_OPTIONS.find((b) => b.value === band)?.label ?? band;
      return `${priceLabel(price)} ${opLabel(op).toLowerCase()} Envelope ${bandLabel} (${period})`;
    },
  },
  {
    id: "exp-bb-percent-b-low",
    name: "BB %B Low",
    category: "Volatility",
    kind: "oscillator_level",
    description: "Bollinger %B below 0.2 (near lower band)",
    params: [
      { key: "period", label: "Period", type: "int", default: 20, min: 2, max: 200 },
      { key: "std", label: "Std dev", type: "float", default: 2, min: 0.5, max: 5 },
      { key: "threshold", label: "%B level", type: "float", default: 0.2, min: 0, max: 1 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "lt",
        options: LEVEL_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) => {
      const period = Number(params.period ?? 20);
      const std = Number(params.std ?? 2);
      const threshold = Number(params.threshold ?? 0.2);
      const op = String(params.op ?? "lt") as Expression["op"];
      return {
        name: "BB %B Low",
        indicators: [
          {
            alias: "bb",
            type: "bb",
            params: { length: period, std },
            timeframe: toTf(tf),
          },
        ],
        entry: expr(op, "bb_percent_b", threshold),
        backtest: { entryOn: "close", exitOn: "opposite_signal" },
      };
    },
    describe: (params) => {
      const period = Number(params.period ?? 20);
      const threshold = Number(params.threshold ?? 0.2);
      const op = String(params.op ?? "lt");
      return `BB %B(${period}) ${opLabel(op).toLowerCase()} ${threshold}`;
    },
  },
  {
    id: "exp-stddev-high",
    name: "Std Dev Expansion",
    category: "Volatility",
    kind: "oscillator_level",
    description: "Standard deviation above average (volatility expansion)",
    params: [
      { key: "period", label: "Period", type: "int", default: 20, min: 2, max: 100 },
      { key: "threshold", label: "Level", type: "float", default: 2, min: 0, max: 20 },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "gt",
        options: LEVEL_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildOscillatorLevel(
        "stddev",
        "stddev",
        "stddev",
        params,
        tf,
        "Std Dev Expansion",
        2,
      ),
    describe: (params) => {
      const period = Number(params.period ?? 20);
      const threshold = Number(params.threshold ?? 2);
      const op = String(params.op ?? "gt");
      return `StdDev(${period}) ${opLabel(op).toLowerCase()} ${threshold}`;
    },
  },
  {
    id: "exp-new-high-after-lookback",
    name: "New High After Lookback",
    category: "Breakout",
    kind: "price_breakout",
    description:
      "Price high breaks above the highest high of the prior N bars (not all-time high)",
    params: [
      LOOKBACK_PARAM,
      {
        key: "price",
        label: "Price",
        type: "enum",
        default: "high",
        options: OHLC_OPTIONS,
      },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_above",
        options: CROSS_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildRollingExtremeBreak("high", params, tf, "New High After Lookback"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 200);
      const price = String(params.price ?? "high");
      const op = String(params.op ?? "crosses_above");
      return `${priceLabel(price)} ${opLabel(op).toLowerCase()} ${lookback}-bar high`;
    },
  },
  {
    id: "exp-new-low-after-lookback",
    name: "New Low After Lookback",
    category: "Breakout",
    kind: "price_breakout",
    description:
      "Price low breaks below the lowest low of the prior N bars",
    params: [
      LOOKBACK_PARAM,
      {
        key: "price",
        label: "Price",
        type: "enum",
        default: "low",
        options: OHLC_OPTIONS,
      },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_below",
        options: CROSS_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildRollingExtremeBreak("low", params, tf, "New Low After Lookback"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 200);
      const price = String(params.price ?? "low");
      const op = String(params.op ?? "crosses_below");
      return `${priceLabel(price)} ${opLabel(op).toLowerCase()} ${lookback}-bar low`;
    },
  },
  {
    id: "exp-darvas-breakout-up",
    name: "Darvas Box Breakout Up",
    category: "Breakout",
    kind: "price_breakout",
    description:
      "Close breaks above the prior Darvas box top after consolidation",
    params: [
      DARVAS_LOOKBACK_PARAM,
      {
        key: "price",
        label: "Price",
        type: "enum",
        default: "close",
        options: OHLC_OPTIONS,
      },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_above",
        options: CROSS_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildDarvasBreakout("up", params, tf, "Darvas Box Breakout Up"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 20);
      const price = String(params.price ?? "close");
      const op = String(params.op ?? "crosses_above");
      return `${priceLabel(price)} ${opLabel(op).toLowerCase()} Darvas box top (${lookback} lookback)`;
    },
  },
  {
    id: "exp-darvas-breakout-down",
    name: "Darvas Box Breakout Down",
    category: "Breakout",
    kind: "price_breakout",
    description:
      "Close breaks below the prior Darvas box bottom after consolidation",
    params: [
      DARVAS_LOOKBACK_PARAM,
      {
        key: "price",
        label: "Price",
        type: "enum",
        default: "close",
        options: OHLC_OPTIONS,
      },
      {
        key: "op",
        label: "Condition",
        type: "enum",
        default: "crosses_below",
        options: CROSS_COMPARE_OPTIONS,
      },
    ],
    buildPattern: (params, tf) =>
      buildDarvasBreakout("down", params, tf, "Darvas Box Breakout Down"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 20);
      const price = String(params.price ?? "close");
      const op = String(params.op ?? "crosses_below");
      return `${priceLabel(price)} ${opLabel(op).toLowerCase()} Darvas box bottom (${lookback} lookback)`;
    },
  },
  {
    id: "exp-chart-bull-flag",
    name: "Bull Flag",
    category: "Chart patterns",
    kind: "chart_pattern",
    description: "Bullish continuation after a sharp rally and tight flag consolidation",
    params: [CHART_LOOKBACK_PARAM],
    buildPattern: (params, tf) =>
      buildChartPattern("bull_flag", params, tf, "Bull Flag"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 60);
      return `Bull flag breakout (${lookback} bar lookback)`;
    },
  },
  {
    id: "exp-chart-ascending-triangle",
    name: "Ascending Triangle",
    category: "Chart patterns",
    kind: "chart_pattern",
    description: "Flat resistance with rising lows breaking upward",
    params: [CHART_LOOKBACK_PARAM],
    buildPattern: (params, tf) =>
      buildChartPattern("ascending_triangle", params, tf, "Ascending Triangle"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 60);
      return `Ascending triangle breakout (${lookback} bar lookback)`;
    },
  },
  {
    id: "exp-chart-cup-handle",
    name: "Cup & Handle",
    category: "Chart patterns",
    kind: "chart_pattern",
    description: "Rounded base recovery with a shallow handle breakout",
    params: [CHART_LOOKBACK_PARAM],
    buildPattern: (params, tf) =>
      buildChartPattern("cup_and_handle", params, tf, "Cup & Handle"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 60);
      return `Cup & handle breakout (${lookback} bar lookback)`;
    },
  },
  {
    id: "exp-chart-double-bottom",
    name: "Double Bottom",
    category: "Chart patterns",
    kind: "chart_pattern",
    description: "Two similar lows with a neckline breakout",
    params: [CHART_LOOKBACK_PARAM],
    buildPattern: (params, tf) =>
      buildChartPattern("double_bottom", params, tf, "Double Bottom"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 60);
      return `Double bottom breakout (${lookback} bar lookback)`;
    },
  },
  {
    id: "exp-chart-long-base-breakout",
    name: "Long Base Breakout",
    category: "Chart patterns",
    kind: "chart_pattern",
    description: "Extended tight range resolving with an upside breakout",
    params: [CHART_LOOKBACK_PARAM],
    buildPattern: (params, tf) =>
      buildChartPattern("long_base_breakout", params, tf, "Long Base Breakout"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 60);
      return `Long base breakout (${lookback} bar lookback)`;
    },
  },
  {
    id: "exp-chart-bear-flag",
    name: "Bear Flag",
    category: "Chart patterns",
    kind: "chart_pattern",
    description: "Bearish continuation after a sharp decline and tight flag consolidation",
    params: [CHART_LOOKBACK_PARAM],
    buildPattern: (params, tf) =>
      buildChartPattern("bear_flag", params, tf, "Bear Flag"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 60);
      return `Bear flag breakdown (${lookback} bar lookback)`;
    },
  },
  {
    id: "exp-chart-descending-triangle",
    name: "Descending Triangle",
    category: "Chart patterns",
    kind: "chart_pattern",
    description: "Flat support with falling highs breaking downward",
    params: [CHART_LOOKBACK_PARAM],
    buildPattern: (params, tf) =>
      buildChartPattern("descending_triangle", params, tf, "Descending Triangle"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 60);
      return `Descending triangle breakdown (${lookback} bar lookback)`;
    },
  },
  {
    id: "exp-chart-head-shoulders",
    name: "Head & Shoulders",
    category: "Chart patterns",
    kind: "chart_pattern",
    description: "Three-peak reversal with neckline breakdown",
    params: [CHART_LOOKBACK_PARAM],
    buildPattern: (params, tf) =>
      buildChartPattern("head_and_shoulders", params, tf, "Head & Shoulders"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 60);
      return `Head & shoulders breakdown (${lookback} bar lookback)`;
    },
  },
  {
    id: "exp-chart-double-top",
    name: "Double Top",
    category: "Chart patterns",
    kind: "chart_pattern",
    description: "Two similar highs with a neckline breakdown",
    params: [CHART_LOOKBACK_PARAM],
    buildPattern: (params, tf) =>
      buildChartPattern("double_top", params, tf, "Double Top"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 60);
      return `Double top breakdown (${lookback} bar lookback)`;
    },
  },
  {
    id: "exp-chart-long-base-breakdown",
    name: "Long Base Breakdown",
    category: "Chart patterns",
    kind: "chart_pattern",
    description: "Extended tight range resolving with a downside breakdown",
    params: [CHART_LOOKBACK_PARAM],
    buildPattern: (params, tf) =>
      buildChartPattern("long_base_breakdown", params, tf, "Long Base Breakdown"),
    describe: (params) => {
      const lookback = Number(params.lookback ?? 60);
      return `Long base breakdown (${lookback} bar lookback)`;
    },
  },
];

export function getExplorationPreset(id: string): ExplorationPreset | undefined {
  return EXPLORATION_PRESETS.find((preset) => preset.id === id);
}

export const DEFAULT_EXPLORATION_PRESET_ID = "exp-sma-price";

export const EXPLORATION_CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "Moving Averages", label: "Moving Averages" },
  { id: "Oscillators", label: "Oscillators" },
  { id: "Volatility", label: "Volatility" },
  { id: "Breakout", label: "Breakout" },
  { id: "Trend", label: "Trend" },
  { id: "Candlesticks", label: "Candlesticks" },
  { id: "Chart patterns", label: "Chart patterns" },
  { id: "favorites", label: "Favorites" },
  { id: "custom", label: "Custom" },
] as const;

export type ExplorationCategoryId =
  (typeof EXPLORATION_CATEGORY_TABS)[number]["id"];

export const EXPLORATION_CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  "Moving Averages": {
    bg: "bg-info-light",
    text: "text-info",
    dot: "bg-info",
  },
  Oscillators: {
    bg: "bg-brand-light",
    text: "text-brand-text",
    dot: "bg-brand",
  },
  Volatility: { bg: "bg-accent-light", text: "text-accent", dot: "bg-accent" },
  Breakout: {
    bg: "bg-success-light",
    text: "text-success",
    dot: "bg-success",
  },
  Trend: { bg: "bg-info-light", text: "text-info", dot: "bg-info" },
  Candlesticks: { bg: "bg-input", text: "text-body", dot: "bg-muted" },
  "Chart patterns": {
    bg: "bg-success-light",
    text: "text-success",
    dot: "bg-success",
  },
  Custom: { bg: "bg-input", text: "text-body", dot: "bg-muted" },
  Favorites: { bg: "bg-brand-light", text: "text-brand-text", dot: "bg-brand" },
};

export function explorationCategoryStyle(category: string) {
  return (
    EXPLORATION_CATEGORY_STYLES[category] ?? {
      bg: "bg-accent-light",
      text: "text-accent",
      dot: "bg-accent",
    }
  );
}
