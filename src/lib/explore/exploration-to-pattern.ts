import {
  getIndicatorDefinition,
  INDICATOR_REGISTRY,
  type IndicatorDefinition,
} from "@/lib/engine/registry";
import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";
import type {
  Expression,
  IndicatorDef,
  PatternDefinition,
} from "@/lib/types";
import { getExplorationPreset } from "@/lib/explore/exploration-presets";
import type {
  ExplorationBuilderState,
  ExplorationCondition,
  ExplorationConditionRow,
  ExplorationFilter,
  ExplorationOperand,
  ExplorationOp,
  ExplorationPreset,
} from "@/lib/explore/exploration-models";

const PRICE_FIELDS = ["open", "high", "low", "close"] as const;

function toTimeframe(
  mode: ExploreTimeframeMode,
): IndicatorDef["timeframe"] | undefined {
  if (mode === "mtf") return "1D";
  return mode;
}

function primaryOutputKey(def: IndicatorDefinition, alias: string): string {
  if (def.outputs.length === 1) return alias;
  if (def.id === "macd") return `${alias}_macd`;
  if (def.id === "bb") return `${alias}_percent_b`;
  if (def.id === "adx") return `${alias}_adx`;
  if (def.id === "stochastic") return `${alias}_k`;
  if (def.id === "trix") return `${alias}_trix`;
  if (def.id === "keltner") return `${alias}_middle`;
  if (def.id === "envelope") return `${alias}_middle`;
  if (def.id === "stoch_rsi") return `${alias}_stochRSI`;
  if (def.id === "kst") return `${alias}_kst`;
  return `${alias}_${def.outputs[0]}`;
}

function resolveOutputKey(
  def: IndicatorDefinition,
  alias: string,
  output?: string,
): string {
  if (!output || output === def.outputs[0]) {
    return primaryOutputKey(def, alias);
  }
  if (def.outputs.length === 1) return alias;
  if (output === def.outputs[0]) return primaryOutputKey(def, alias);
  return `${alias}_${output}`;
}

function indicatorInstanceKey(operand: Extract<ExplorationOperand, { kind: "indicator" }>): string {
  return `ind:${operand.indicatorType}:${JSON.stringify(operand.params)}`;
}

function operandKey(operand: ExplorationOperand): string {
  if (operand.kind === "price") return `price:${operand.field}`;
  if (operand.kind === "number") return `num:${operand.value}`;
  return `${indicatorInstanceKey(operand)}:${operand.output ?? ""}`;
}

function operandToRef(
  operand: ExplorationOperand,
  aliasMap: Map<string, string>,
): string {
  if (operand.kind === "price") return operand.field;
  if (operand.kind === "number") {
    throw new Error("Number operands cannot be converted to series refs");
  }
  const key = indicatorInstanceKey(operand);
  const alias = aliasMap.get(key);
  if (!alias) {
    throw new Error(`Missing alias for operand: ${operand.indicatorType}`);
  }
  const def = getIndicatorDefinition(operand.indicatorType);
  if (!def) return alias;
  return resolveOutputKey(def, alias, operand.output);
}

function collectIndicators(
  conditions: ExplorationCondition[],
  timeframeMode: ExploreTimeframeMode,
): { indicators: IndicatorDef[]; aliasMap: Map<string, string> } {
  const indicators: IndicatorDef[] = [];
  const aliasMap = new Map<string, string>();
  const tf = toTimeframe(timeframeMode);
  let index = 0;

  for (const condition of conditions) {
    for (const operand of [condition.left, condition.right]) {
      if (operand.kind !== "indicator") continue;
      const key = indicatorInstanceKey(operand);
      if (aliasMap.has(key)) continue;
      const alias = `e${index}`;
      index += 1;
      aliasMap.set(key, alias);
      indicators.push({
        alias,
        type: operand.indicatorType,
        params: operand.params,
        timeframe: tf,
      });
    }
  }

  return { indicators, aliasMap };
}

function conditionToExpression(
  condition: ExplorationCondition,
  aliasMap: Map<string, string>,
): Expression {
  const { left, op, right } = condition;

  if (right.kind === "number") {
    return {
      op,
      left: { ref: operandToRef(left, aliasMap) },
      right: { value: right.value },
    };
  }

  if (left.kind === "number") {
    throw new Error("Left operand cannot be a number");
  }

  return {
    op,
    left: { ref: operandToRef(left, aliasMap) },
    right: { ref: operandToRef(right, aliasMap) },
  };
}

function buildLogicExpression(
  rows: ExplorationConditionRow[],
  aliasMap: Map<string, string>,
): Expression {
  const normalized = normalizeBuilderState({ rows });
  if (normalized.rows.length === 0) {
    throw new Error("Add at least one condition");
  }

  const expressions = normalized.rows.map((row) =>
    conditionToExpression(row.condition, aliasMap),
  );

  let result = expressions[0]!;
  for (let i = 1; i < normalized.rows.length; i++) {
    const connector = normalized.rows[i]!.connector ?? "and";
    result = { op: connector, args: [result, expressions[i]!] };
  }
  return result;
}

export function normalizeBuilderState(
  builder: ExplorationBuilderState,
): ExplorationBuilderState {
  if (builder.rows?.length) {
    return builder;
  }

  if (builder.conditions?.length) {
    const logic = builder.logic ?? "and";
    return {
      rows: builder.conditions.map((condition, index) => ({
        id: condition.id,
        connector: index === 0 ? undefined : logic,
        condition,
      })),
    };
  }

  return {
    rows: [
      {
        id: crypto.randomUUID(),
        condition: createBlankCondition(),
      },
    ],
  };
}

export function createBlankRow(): ExplorationConditionRow {
  return {
    id: crypto.randomUUID(),
    connector: "and",
    condition: createBlankCondition(),
  };
}

export function builderStateToPattern(
  name: string,
  builder: ExplorationBuilderState,
  timeframeMode: ExploreTimeframeMode,
): PatternDefinition {
  const normalized = normalizeBuilderState(builder);
  if (normalized.rows.length === 0) {
    throw new Error("Add at least one condition");
  }

  const conditions = normalized.rows.map((row) => row.condition);
  const { indicators, aliasMap } = collectIndicators(conditions, timeframeMode);
  const entry = buildLogicExpression(normalized.rows, aliasMap);

  return {
    name,
    indicators,
    entry,
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

export function describeBuilderState(builder: ExplorationBuilderState): string {
  const normalized = normalizeBuilderState(builder);
  if (normalized.rows.length === 0) return "No conditions";

  return normalized.rows
    .map((row, index) => {
      const part = describeCondition(row.condition);
      if (index === 0) return part;
      const join = (row.connector ?? "and").toUpperCase();
      return `${join} ${part}`;
    })
    .join(" ");
}

function describeOperand(operand: ExplorationOperand): string {
  if (operand.kind === "price") {
    return operand.field.toUpperCase();
  }
  if (operand.kind === "number") {
    return String(operand.value);
  }
  return formatIndicatorLabel(
    operand.indicatorType,
    operand.params,
    operand.output,
  );
}

function describeOp(op: ExplorationOp): string {
  switch (op) {
    case "gt":
      return ">";
    case "lt":
      return "<";
    case "gte":
      return ">=";
    case "lte":
      return "<=";
    case "crosses_above":
      return "crosses above";
    case "crosses_below":
      return "crosses below";
    default:
      return op;
  }
}

function describeCondition(condition: ExplorationCondition): string {
  return `${describeOperand(condition.left)} ${describeOp(condition.op)} ${describeOperand(condition.right)}`;
}

export function explorationFilterToPattern(
  filter: ExplorationFilter,
): PatternDefinition {
  if (filter.source === "builder" && filter.builder) {
    return builderStateToPattern(
      filter.name,
      filter.builder,
      filter.timeframeMode,
    );
  }

  if (filter.source === "preset" && filter.presetId && filter.params) {
    const preset = getExplorationPreset(filter.presetId);
    if (!preset) {
      throw new Error(`Unknown exploration preset: ${filter.presetId}`);
    }
    return preset.buildPattern(filter.params, filter.timeframeMode);
  }

  throw new Error("Exploration filter is not configured");
}

export function describeExplorationFilter(filter: ExplorationFilter): string {
  if (filter.source === "builder" && filter.builder) {
    return describeBuilderState(filter.builder);
  }
  if (filter.source === "preset" && filter.presetId && filter.params) {
    const preset = getExplorationPreset(filter.presetId);
    if (!preset) return filter.name;
    return preset.describe(filter.params);
  }
  return filter.name;
}

export function createBlankCondition(): ExplorationCondition {
  return {
    id: crypto.randomUUID(),
    left: {
      kind: "indicator",
      indicatorType: "rsi",
      params: { length: 14, source: "close" },
    },
    op: "crosses_above",
    right: { kind: "number", value: 30 },
  };
}

export function isValidOperandPair(
  left: ExplorationOperand,
  op: ExplorationOp,
  right: ExplorationOperand,
): boolean {
  if (op === "crosses_above" || op === "crosses_below") {
    if (left.kind === "number") return false;
    if (right.kind === "number") {
      return left.kind === "indicator" || left.kind === "price";
    }
    return (
      (left.kind === "indicator" || left.kind === "price") &&
      (right.kind === "indicator" || right.kind === "price")
    );
  }
  if (right.kind === "number") {
    return left.kind === "indicator" || left.kind === "price";
  }
  return (
    (left.kind === "indicator" || left.kind === "price") &&
    (right.kind === "indicator" || right.kind === "price")
  );
}

export const PRICE_FIELD_OPTIONS = PRICE_FIELDS.map((field) => ({
  value: field,
  label: field.toUpperCase(),
}));

export function defaultIndicatorParams(
  type: string,
): Record<string, number | string> {
  const def = getIndicatorDefinition(type);
  if (!def) return {};
  const params: Record<string, number | string> = {};
  for (const [key, schema] of Object.entries(def.params)) {
    params[key] = schema.default;
  }
  return params;
}

export const INDICATOR_SHORT_NAMES: Record<string, string> = {
  sma: "SMA",
  ema: "EMA",
  rsi: "RSI",
  cci: "CCI",
  macd: "MACD",
  stochastic: "Stoch",
  adx: "ADX",
  bb: "Bollinger",
  atr: "ATR",
  williamsr: "Williams %R",
  mfi: "MFI",
  roc: "ROC",
  momentum: "Momentum",
  zscore: "Z-Score",
  obv: "OBV",
  trix: "TRIX",
  psar: "PSAR",
  keltner: "Keltner",
  envelope: "Envelope",
  rolling_high: "Rolling High",
  rolling_low: "Rolling Low",
  volume_sma: "Vol SMA",
  candle_pattern: "Candle",
  wma: "WMA",
  wema: "WEMA",
  stoch_rsi: "Stoch RSI",
  awesome_oscillator: "AO",
  force_index: "Force Index",
  vwap: "VWAP",
  kst: "KST",
  adl: "ADL",
  stddev: "Std Dev",
  highest: "Highest",
  lowest: "Lowest",
  dmi: "DMI",
};

export const INDICATOR_CATEGORY_LABELS: Record<string, string> = {
  overlap: "Moving averages & overlays",
  momentum: "Momentum",
  trend: "Trend",
  volatility: "Volatility",
  volume: "Volume",
  price: "Price levels",
  mean_reversion: "Mean reversion",
  pattern: "Patterns",
};

const OSCILLATOR_TYPES = new Set([
  "rsi",
  "cci",
  "williamsr",
  "mfi",
  "adx",
  "roc",
  "momentum",
  "zscore",
  "awesome_oscillator",
  "force_index",
  "stoch_rsi",
]);

const OVERLAY_TYPES = new Set([
  "sma",
  "ema",
  "wma",
  "wema",
  "psar",
  "rolling_high",
  "rolling_low",
  "volume_sma",
  "vwap",
  "highest",
  "lowest",
]);
const LINE_CROSS_TYPES = new Set(["macd", "stochastic", "trix", "kst", "stoch_rsi"]);
const BAND_TYPES = new Set(["bb", "keltner", "envelope"]);

export type IndicatorRole =
  | "oscillator"
  | "overlay"
  | "line_cross"
  | "band"
  | "other";

export function getIndicatorRole(type: string): IndicatorRole {
  if (OSCILLATOR_TYPES.has(type)) return "oscillator";
  if (OVERLAY_TYPES.has(type)) return "overlay";
  if (LINE_CROSS_TYPES.has(type)) return "line_cross";
  if (BAND_TYPES.has(type)) return "band";
  return "other";
}

export function formatIndicatorLabel(
  type: string,
  params: Record<string, number | string>,
  output?: string,
): string {
  const short = INDICATOR_SHORT_NAMES[type] ?? type.toUpperCase();
  const period =
    params.length ??
    params.period ??
    params.k ??
    params.rsiPeriod ??
    params.fastPeriod;
  let label = period !== undefined ? `${short} (${period})` : short;
  const source = params.source;
  if (source && source !== "close") {
    label += ` · ${String(source).toUpperCase()}`;
  }
  if (output && LINE_CROSS_TYPES.has(type)) {
    label += ` · ${output}`;
  }
  return label;
}

export function indicatorHasSource(type: string): boolean {
  return Boolean(getIndicatorDefinition(type)?.params.source);
}

export function indicatorSourceOptions(
  type: string,
): { value: string; label: string }[] {
  const def = getIndicatorDefinition(type);
  const options = def?.params.source?.options ?? ["close"];
  return options.map((value) => ({
    value,
    label: value.toUpperCase(),
  }));
}

export function groupedIndicatorsForPicker(): {
  category: string;
  label: string;
  items: { id: string; name: string }[];
}[] {
  const groups = new Map<string, { id: string; name: string }[]>();
  for (const item of INDICATOR_REGISTRY) {
    if (item.id === "candle_pattern") continue;
    const list = groups.get(item.category) ?? [];
    list.push({
      id: item.id,
      name: formatIndicatorLabel(item.id, defaultIndicatorParams(item.id)),
    });
    groups.set(item.category, list);
  }

  const order = [
    "overlap",
    "momentum",
    "trend",
    "volatility",
    "volume",
    "price",
    "mean_reversion",
  ];

  return order
    .filter((category) => groups.has(category))
    .map((category) => ({
      category,
      label: INDICATOR_CATEGORY_LABELS[category] ?? category,
      items: groups.get(category)!,
    }));
}

export function primaryPeriodKey(
  type: string,
): "length" | "period" | "k" | "rsiPeriod" | "fastPeriod" | null {
  const def = getIndicatorDefinition(type);
  if (!def) return null;
  if ("length" in def.params) return "length";
  if ("rsiPeriod" in def.params) return "rsiPeriod";
  if ("period" in def.params) return "period";
  if ("fastPeriod" in def.params) return "fastPeriod";
  if ("k" in def.params) return "k";
  return null;
}

export function defaultRightForLeft(
  left: ExplorationOperand,
): ExplorationOperand {
  if (left.kind !== "indicator") {
    return { kind: "number", value: 0 };
  }
  const role = getIndicatorRole(left.indicatorType);
  if (role === "oscillator") {
    const defaults: Record<string, number> = {
      rsi: 50,
      cci: 0,
      williamsr: -50,
      mfi: 50,
      adx: 25,
      roc: 0,
      momentum: 0,
      zscore: 0,
    };
    return {
      kind: "number",
      value: defaults[left.indicatorType] ?? 0,
    };
  }
  if (role === "line_cross") {
    const outputMap: Record<string, string> = {
      macd: "signal",
      stochastic: "d",
      trix: "signal",
      kst: "signal",
      stoch_rsi: "d",
    };
    const output = outputMap[left.indicatorType] ?? "signal";
    return {
      kind: "indicator",
      indicatorType: left.indicatorType,
      params: { ...left.params },
      output,
    };
  }
  return { kind: "price", field: "close" };
}

export function defaultOpForLeft(left: ExplorationOperand): ExplorationOp {
  if (left.kind !== "indicator") return "crosses_above";
  const role = getIndicatorRole(left.indicatorType);
  if (role === "oscillator") return "gt";
  if (role === "line_cross") return "crosses_above";
  return "crosses_above";
}

export function coerceConditionForLeft(
  left: ExplorationOperand,
  op: ExplorationOp,
  right: ExplorationOperand,
): { op: ExplorationOp; right: ExplorationOperand } {
  if (left.kind !== "indicator") {
    return { op, right };
  }

  const role = getIndicatorRole(left.indicatorType);

  if (role === "oscillator") {
    const nextRight =
      right.kind === "number" ? right : defaultRightForLeft(left);
    return { op, right: nextRight };
  }

  if (role === "line_cross") {
    let nextOp = op;
    if (nextOp !== "crosses_above" && nextOp !== "crosses_below") {
      nextOp = "crosses_above";
    }
    const nextRight =
      right.kind === "indicator" &&
      right.indicatorType === left.indicatorType
        ? right
        : defaultRightForLeft(left);
    return { op: nextOp, right: nextRight };
  }

  if (role === "overlay" || role === "band") {
    let nextOp = op;
    let nextRight = right;
    if (op === "crosses_above" || op === "crosses_below") {
      if (right.kind === "number") {
        nextRight = { kind: "price", field: "close" };
      }
    }
    return { op: nextOp, right: nextRight };
  }

  return { op, right };
}

export const OP_LABELS: Record<ExplorationOp, string> = {
  gt: "above",
  gte: "at or above",
  lt: "below",
  lte: "at or below",
  crosses_above: "crosses above",
  crosses_below: "crosses below",
};

export function operatorsForLeft(left: ExplorationOperand): ExplorationOp[] {
  if (left.kind === "price") {
    return ["crosses_above", "crosses_below", "gt", "gte", "lt", "lte"];
  }
  if (left.kind !== "indicator") {
    return ["gt", "gte", "lt", "lte"];
  }

  const role = getIndicatorRole(left.indicatorType);
  if (role === "oscillator") {
    return ["gt", "gte", "lt", "lte", "crosses_above", "crosses_below"];
  }
  if (role === "line_cross") {
    return ["crosses_above", "crosses_below"];
  }
  return ["crosses_above", "crosses_below", "gt", "gte", "lt", "lte"];
}

export function describePreset(
  preset: ExplorationPreset,
  params: Record<string, number | string>,
): string {
  return preset.describe(params);
}
