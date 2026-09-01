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
  overlayType: "sma" | "ema",
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
  overlayType: "sma" | "ema",
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
];

export function getExplorationPreset(id: string): ExplorationPreset | undefined {
  return EXPLORATION_PRESETS.find((preset) => preset.id === id);
}

export const DEFAULT_EXPLORATION_PRESET_ID = "exp-sma-price";

export const EXPLORATION_FILTERS = [
  { id: "all", label: "All" },
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
