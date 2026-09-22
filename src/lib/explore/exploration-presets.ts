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

export const EXPLORATION_PRESETS: ExplorationPreset[] = [
  {
    id: "exp-sma-price",
    name: "SMA vs Price",
    category: "Trend",
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
    category: "Trend",
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
    category: "Trend",
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
    category: "Trend",
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
    category: "Momentum",
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
    category: "Momentum",
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
    category: "Momentum",
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
    category: "Momentum",
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
    category: "Trend",
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
    category: "Trend",
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
    category: "Trend",
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
    category: "Trend",
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
    category: "Trend",
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
    category: "Trend",
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
    category: "Trend",
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
    category: "Momentum",
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
    category: "Momentum",
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
    category: "Momentum",
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
    id: "exp-williamsr-oversold",
    name: "Williams %R Oversold",
    category: "Momentum",
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
    category: "Momentum",
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
    category: "Momentum",
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
    category: "Momentum",
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
    category: "Momentum",
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
    category: "Momentum",
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
    category: "Momentum",
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
    category: "Momentum",
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
    category: "Momentum",
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
    category: "Momentum",
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
];

export function getExplorationPreset(id: string): ExplorationPreset | undefined {
  return EXPLORATION_PRESETS.find((preset) => preset.id === id);
}

export const DEFAULT_EXPLORATION_PRESET_ID = "exp-sma-price";

export const EXPLORATION_FILTERS = [
  { id: "all", label: "All" },
  { id: "custom", label: "My explorations" },
  { id: "Trend", label: "Trend" },
  { id: "Momentum", label: "Momentum" },
  { id: "Volatility", label: "Volatility" },
] as const;

export type ExplorationFilterId = (typeof EXPLORATION_FILTERS)[number]["id"];

export const EXPLORATION_CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  Trend: { bg: "bg-info-light", text: "text-info", dot: "bg-info" },
  Momentum: { bg: "bg-brand-light", text: "text-brand-text", dot: "bg-brand" },
  Volatility: { bg: "bg-accent-light", text: "text-accent", dot: "bg-accent" },
  Custom: { bg: "bg-input", text: "text-body", dot: "bg-muted" },
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
