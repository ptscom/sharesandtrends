import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";
import type { Expression, IndicatorDef, PatternDefinition } from "@/lib/types";
import {
  getIndicatorDefinition,
  INDICATOR_REGISTRY,
  type IndicatorDefinition,
} from "@/lib/engine/registry";

export type ExplorePath = "indicator" | "strategy";

export type IndicatorRuleOp =
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "crosses_above"
  | "crosses_below";

export interface IndicatorRule {
  op: IndicatorRuleOp;
  compareTo: "value" | "series";
  value?: number;
  /** Price series (open/high/low/close) or another indicator alias ref */
  seriesRef?: string;
}

export interface IndicatorComboPart {
  id: string;
  indicatorType: string;
  name: string;
  params: Record<string, number | string>;
  outputKey: string;
  rule: IndicatorRule;
}

export interface ExploreIndicatorItem {
  id: string;
  kind: "single" | "combo";
  name: string;
  enabled: boolean;
  timeframeMode: ExploreTimeframeMode;
  indicatorType?: string;
  params: Record<string, number | string>;
  outputKey: string;
  rule: IndicatorRule;
  comboLogic?: "and" | "or";
  parts?: IndicatorComboPart[];
}

export interface IndicatorScanResultRow {
  symbol: string;
  signalDate: string | null;
  signalToday: boolean;
  lastClose: number;
}

export interface IndicatorScanGroup {
  itemId: string;
  itemName: string;
  timeframeMode: ExploreTimeframeMode;
  results: IndicatorScanResultRow[];
}

export interface IndicatorScanRun {
  id: string;
  runAt: string;
  universe: string[];
  groups: IndicatorScanGroup[];
}

const DEFAULT_RULES: Record<string, IndicatorRule> = {
  rsi: { op: "gt", compareTo: "value", value: 50 },
  cci: { op: "gt", compareTo: "value", value: 0 },
  williamsr: { op: "gt", compareTo: "value", value: -50 },
  mfi: { op: "gt", compareTo: "value", value: 50 },
  macd: { op: "crosses_above", compareTo: "series", seriesRef: "signal" },
  stochastic: { op: "crosses_above", compareTo: "series", seriesRef: "d" },
  trix: { op: "crosses_above", compareTo: "series", seriesRef: "signal" },
  adx: { op: "gt", compareTo: "value", value: 25 },
  roc: { op: "gt", compareTo: "value", value: 0 },
  momentum: { op: "gt", compareTo: "value", value: 0 },
  zscore: { op: "gt", compareTo: "value", value: 0 },
  obv: { op: "gt", compareTo: "value", value: 0 },
  atr: { op: "gt", compareTo: "value", value: 0 },
  candle_pattern: { op: "gt", compareTo: "value", value: 0 },
};

export function primaryOutputKey(
  def: IndicatorDefinition,
  alias: string,
): string {
  if (def.outputs.length === 1) return alias;
  if (def.id === "macd") return `${alias}_macd`;
  if (def.id === "bb") return `${alias}_percent_b`;
  if (def.id === "adx") return `${alias}_adx`;
  if (def.id === "stochastic") return `${alias}_k`;
  if (def.id === "trix") return `${alias}_trix`;
  if (def.id === "keltner") return `${alias}_middle`;
  if (def.id === "envelope") return `${alias}_middle`;
  if (def.id === "psar") return alias;
  return `${alias}_${def.outputs[0]}`;
}

export function defaultRuleForIndicator(type: string): IndicatorRule {
  if (DEFAULT_RULES[type]) return { ...DEFAULT_RULES[type]! };

  if (type === "sma" || type === "ema") {
    return { op: "crosses_above", compareTo: "series", seriesRef: "close" };
  }

  if (
    type === "rolling_high" ||
    type === "rolling_low" ||
    type === "volume_sma"
  ) {
    return { op: "crosses_above", compareTo: "series", seriesRef: "close" };
  }

  return { op: "gt", compareTo: "value", value: 0 };
}

export function defaultParamsForIndicator(
  def: IndicatorDefinition,
): Record<string, number | string> {
  const params: Record<string, number | string> = {};
  for (const [key, schema] of Object.entries(def.params)) {
    params[key] = schema.default;
  }
  return params;
}

export function createSingleIndicatorItem(
  def: IndicatorDefinition,
  timeframeMode: ExploreTimeframeMode = "1D",
): ExploreIndicatorItem {
  const alias = def.id;
  return {
    id: `${def.id}-${timeframeMode}`,
    kind: "single",
    name: def.name,
    enabled: false,
    timeframeMode,
    indicatorType: def.id,
    params: defaultParamsForIndicator(def),
    outputKey: primaryOutputKey(def, alias),
    rule: defaultRuleForIndicator(def.id),
  };
}

export function createRegistryIndicatorItems(
  timeframeMode: ExploreTimeframeMode,
): ExploreIndicatorItem[] {
  return INDICATOR_REGISTRY.map((def) =>
    createSingleIndicatorItem(def, timeframeMode),
  );
}

export function createComboIndicatorItem(
  name: string,
  timeframeMode: ExploreTimeframeMode,
  comboLogic: "and" | "or",
  parts: IndicatorComboPart[],
): ExploreIndicatorItem {
  return {
    id: `combo-${crypto.randomUUID()}`,
    kind: "combo",
    name,
    enabled: true,
    timeframeMode,
    params: {},
    outputKey: "",
    rule: { op: "gt", compareTo: "value", value: 0 },
    comboLogic,
    parts,
  };
}

function resolveRuleRightRef(
  alias: string,
  indicatorType: string,
  rule: IndicatorRule,
): string {
  if (rule.compareTo === "value") return "";
  const ref = rule.seriesRef ?? "close";
  if (
    ref === "close" ||
    ref === "open" ||
    ref === "high" ||
    ref === "low" ||
    ref === "volume"
  ) {
    return ref;
  }
  const def = getIndicatorDefinition(indicatorType);
  if (!def) return `${alias}_${ref}`;
  if (def.outputs.length === 1) return alias;
  if (ref === def.outputs[0]) return primaryOutputKey(def, alias);
  return `${alias}_${ref}`;
}

function ruleToExpression(
  alias: string,
  indicatorType: string,
  outputKey: string,
  rule: IndicatorRule,
): Expression {
  if (
    (indicatorType === "sma" || indicatorType === "ema") &&
    rule.compareTo === "series" &&
    rule.seriesRef === "close"
  ) {
    return {
      op: rule.op,
      left: { ref: "close" },
      right: { ref: alias },
    };
  }

  if (
    (indicatorType === "rolling_high" ||
      indicatorType === "rolling_low") &&
    rule.compareTo === "series" &&
    rule.seriesRef === "close"
  ) {
    return {
      op: rule.op,
      left: { ref: "close" },
      right: { ref: alias },
    };
  }

  const leftRef = outputKey;

  if (rule.compareTo === "value") {
    return {
      op: rule.op,
      left: { ref: leftRef },
      right: { value: rule.value ?? 0 },
    };
  }

  const rightRef = resolveRuleRightRef(alias, indicatorType, rule);

  return {
    op: rule.op,
    left: { ref: leftRef },
    right: { ref: rightRef },
  };
}

function partToIndicatorDef(
  part: IndicatorComboPart,
  alias: string,
  timeframe: ExploreIndicatorItem["timeframeMode"],
): IndicatorDef {
  const tf =
    timeframe === "mtf" ? "1D" : (timeframe as IndicatorDef["timeframe"]);
  return {
    alias,
    type: part.indicatorType,
    params: part.params,
    timeframe: tf,
  };
}

export function indicatorItemToPattern(
  item: ExploreIndicatorItem,
): PatternDefinition {
  if (item.kind === "combo" && item.parts && item.parts.length > 0) {
    const indicators: IndicatorDef[] = [];
    const expressions: Expression[] = [];

    item.parts.forEach((part, index) => {
      const alias = `p${index}_${part.indicatorType}`;
      indicators.push(
        partToIndicatorDef(part, alias, item.timeframeMode),
      );
      const def = getIndicatorDefinition(part.indicatorType);
      const outputKey = def
        ? primaryOutputKey(def, alias)
        : part.outputKey;
      expressions.push(
        ruleToExpression(alias, part.indicatorType, outputKey, part.rule),
      );
    });

    return {
      name: item.name,
      indicators,
      entry: {
        op: item.comboLogic ?? "and",
        args: expressions,
      },
      backtest: { entryOn: "close", exitOn: "opposite_signal" },
    };
  }

  const def = getIndicatorDefinition(item.indicatorType!);
  if (!def) {
    throw new Error(`Unknown indicator: ${item.indicatorType}`);
  }

  const alias = item.indicatorType!;
  const tf =
    item.timeframeMode === "mtf"
      ? "1D"
      : (item.timeframeMode as IndicatorDef["timeframe"]);

  const indicators: IndicatorDef[] = [
    {
      alias,
      type: item.indicatorType!,
      params: item.params,
      timeframe: tf,
    },
  ];

  let entry: Expression;
  if (
    (item.indicatorType === "sma" || item.indicatorType === "ema") &&
    item.rule.compareTo === "series" &&
    item.rule.seriesRef === "close"
  ) {
    entry = {
      op: item.rule.op,
      left: { ref: "close" },
      right: { ref: alias },
    };
  } else if (
    (item.indicatorType === "rolling_high" ||
      item.indicatorType === "rolling_low") &&
    item.rule.compareTo === "series" &&
    item.rule.seriesRef === "close"
  ) {
    entry = {
      op: item.rule.op,
      left: { ref: "close" },
      right: { ref: alias },
    };
  } else {
    entry = ruleToExpression(
      alias,
      item.indicatorType!,
      item.outputKey,
      item.rule,
    );
  }

  return {
    name: item.name,
    indicators,
    entry,
    backtest: { entryOn: "close", exitOn: "opposite_signal" },
  };
}

export function formatIndicatorRule(rule: IndicatorRule): string {
  if (rule.compareTo === "value") {
    return `${rule.op} ${rule.value ?? 0}`;
  }
  return `${rule.op} ${rule.seriesRef ?? "close"}`;
}

export function summarizeEnabledIndicators(
  items: ExploreIndicatorItem[],
): string {
  const enabled = items.filter((i) => i.enabled);
  if (enabled.length === 0) return "Not configured";
  if (enabled.length === 1) return enabled[0]!.name;
  return `${enabled.length} indicators`;
}
