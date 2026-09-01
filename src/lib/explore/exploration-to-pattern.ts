import {
  getIndicatorDefinition,
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

function operandKey(operand: ExplorationOperand): string {
  if (operand.kind === "price") return `price:${operand.field}`;
  if (operand.kind === "number") return `num:${operand.value}`;
  return `ind:${operand.indicatorType}:${JSON.stringify(operand.params)}:${operand.output ?? ""}`;
}

function operandToRef(
  operand: ExplorationOperand,
  aliasMap: Map<string, string>,
): string {
  if (operand.kind === "price") return operand.field;
  if (operand.kind === "number") {
    throw new Error("Number operands cannot be converted to series refs");
  }
  const key = operandKey(operand);
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
      const key = operandKey(operand);
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
    if (op === "crosses_above" || op === "crosses_below") {
      throw new Error("Cross operators require two series operands");
    }
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

export function builderStateToPattern(
  name: string,
  builder: ExplorationBuilderState,
  timeframeMode: ExploreTimeframeMode,
): PatternDefinition {
  if (builder.conditions.length === 0) {
    throw new Error("Add at least one condition");
  }

  const { indicators, aliasMap } = collectIndicators(
    builder.conditions,
    timeframeMode,
  );

  const expressions = builder.conditions.map((condition) =>
    conditionToExpression(condition, aliasMap),
  );

  const entry: Expression =
    expressions.length === 1
      ? expressions[0]!
      : { op: builder.logic, args: expressions };

  return {
    name,
    indicators,
    entry,
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

export function describeBuilderState(builder: ExplorationBuilderState): string {
  if (builder.conditions.length === 0) return "No conditions";
  const parts = builder.conditions.map(describeCondition);
  return parts.join(` ${builder.logic.toUpperCase()} `);
}

function describeOperand(operand: ExplorationOperand): string {
  if (operand.kind === "price") {
    return operand.field.toUpperCase();
  }
  if (operand.kind === "number") {
    return String(operand.value);
  }
  const def = getIndicatorDefinition(operand.indicatorType);
  const name = def?.name ?? operand.indicatorType;
  const period = operand.params.length ?? operand.params.period;
  const suffix =
    period !== undefined ? `(${period})` : "";
  if (operand.output && def && def.outputs.length > 1) {
    return `${name}${suffix} ${operand.output}`;
  }
  return `${name}${suffix}`;
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
    left: { kind: "price", field: "close" },
    op: "crosses_above",
    right: {
      kind: "indicator",
      indicatorType: "sma",
      params: { length: 50, source: "close" },
    },
  };
}

export function isValidOperandPair(
  left: ExplorationOperand,
  op: ExplorationOp,
  right: ExplorationOperand,
): boolean {
  if (op === "crosses_above" || op === "crosses_below") {
    return left.kind !== "number" && right.kind !== "number";
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

export function describePreset(
  preset: ExplorationPreset,
  params: Record<string, number | string>,
): string {
  return preset.describe(params);
}
