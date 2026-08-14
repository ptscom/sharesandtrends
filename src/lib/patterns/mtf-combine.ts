import type { Expression, IndicatorDef, PatternDefinition, Timeframe } from "@/lib/types";

export type ExploreTimeframeMode = "1D" | "1W" | "1M" | "mtf";

export type MtfSlot = "daily" | "weekly" | "monthly";

const SLOT_TIMEFRAME: Record<MtfSlot, Timeframe> = {
  daily: "1D",
  weekly: "1W",
  monthly: "1M",
};

const SLOT_PREFIX: Record<MtfSlot, string> = {
  daily: "d_",
  weekly: "w_",
  monthly: "m_",
};

function isExpression(value: unknown): value is Expression {
  return (
    typeof value === "object" &&
    value !== null &&
    "op" in value &&
    typeof (value as Expression).op === "string"
  );
}

function remapRef(
  ref: { ref: string } | { value: number },
  aliasMap: Map<string, string>,
): { ref: string } | { value: number } {
  if ("value" in ref) return ref;
  const mapped = aliasMap.get(ref.ref);
  return mapped ? { ref: mapped } : ref;
}

function remapExpression(
  expr: Expression,
  aliasMap: Map<string, string>,
): Expression {
  return {
    ...expr,
    left: expr.left
      ? isExpression(expr.left)
        ? remapExpression(expr.left, aliasMap)
        : remapRef(expr.left, aliasMap)
      : undefined,
    right: expr.right
      ? isExpression(expr.right)
        ? remapExpression(expr.right, aliasMap)
        : remapRef(expr.right, aliasMap)
      : undefined,
    args: expr.args?.map((arg) => remapExpression(arg, aliasMap)),
  };
}

function prefixIndicators(
  indicators: IndicatorDef[],
  prefix: string,
  timeframe: Timeframe,
): { indicators: IndicatorDef[]; aliasMap: Map<string, string> } {
  const aliasMap = new Map<string, string>();

  const prefixed = indicators.map((ind) => {
    const newAlias = `${prefix}${ind.alias}`;
    aliasMap.set(ind.alias, newAlias);
    return {
      ...ind,
      alias: newAlias,
      timeframe,
    };
  });

  return { indicators: prefixed, aliasMap };
}

function prefixPattern(
  pattern: PatternDefinition,
  slot: MtfSlot,
): {
  indicators: IndicatorDef[];
  entry: Expression;
  exit?: Expression;
  name: string;
} {
  const prefix = SLOT_PREFIX[slot];
  const timeframe = SLOT_TIMEFRAME[slot];
  const { indicators, aliasMap } = prefixIndicators(
    pattern.indicators,
    prefix,
    timeframe,
  );

  return {
    name: pattern.name,
    indicators,
    entry: remapExpression(pattern.entry, aliasMap),
    exit: pattern.exit ? remapExpression(pattern.exit, aliasMap) : undefined,
  };
}

function andExpressions(expressions: Expression[]): Expression {
  const active = expressions.filter(Boolean);
  if (active.length === 0) {
    throw new Error("At least one expression is required.");
  }
  if (active.length === 1) return active[0]!;
  return { op: "and", args: active };
}

export interface MtfCombineInput {
  daily: PatternDefinition;
  weekly?: PatternDefinition | null;
  monthly?: PatternDefinition | null;
}

/** Symmetric MTF: buy when all entries align; sell when all exits align. */
export function combineMtfPatterns(input: MtfCombineInput): PatternDefinition {
  const parts: {
    slot: MtfSlot;
    pattern: PatternDefinition;
  }[] = [{ slot: "daily", pattern: input.daily }];

  if (input.weekly) parts.push({ slot: "weekly", pattern: input.weekly });
  if (input.monthly) parts.push({ slot: "monthly", pattern: input.monthly });

  const prefixed = parts.map(({ slot, pattern }) => prefixPattern(pattern, slot));
  const names = prefixed.map((p) => p.name);

  const baseBacktest = input.daily.backtest;

  return {
    name: names.join(" + "),
    description: "Multi-timeframe combined strategy",
    indicators: prefixed.flatMap((p) => p.indicators),
    entry: andExpressions(prefixed.map((p) => p.entry)),
    exit: (() => {
      const exits = prefixed.map((p) => p.exit).filter(Boolean) as Expression[];
      return exits.length > 0 ? andExpressions(exits) : undefined;
    })(),
    backtest: baseBacktest,
  };
}

export function applyTimeframeToPattern(
  pattern: PatternDefinition,
  timeframe: Timeframe,
): PatternDefinition {
  if (timeframe === "1D") return structuredClone(pattern);

  return {
    ...structuredClone(pattern),
    indicators: pattern.indicators.map((ind) => ({
      ...ind,
      timeframe,
    })),
  };
}

export function formatMtfStrategySummary(
  parts: { slot: MtfSlot; name: string | null }[],
): string {
  const labels: Record<MtfSlot, string> = {
    daily: "D",
    weekly: "W",
    monthly: "M",
  };
  const active = parts.filter((p) => p.name);
  if (active.length === 0) return "Not configured";
  return active.map((p) => `${labels[p.slot]}: ${p.name}`).join(" + ");
}

export function formatTimeframeModeLabel(mode: ExploreTimeframeMode): string {
  switch (mode) {
    case "1D":
      return "Daily";
    case "1W":
      return "Weekly";
    case "1M":
      return "Monthly";
    case "mtf":
      return "Multi Time Frame";
  }
}

const MTF_ALIAS_RE = /^(d|w|m)_/;

/** True when a pattern was produced by combineMtfPatterns (prefixed slot aliases). */
export function isMtfCombinedPattern(pattern: PatternDefinition): boolean {
  return pattern.indicators.some((ind) => MTF_ALIAS_RE.test(ind.alias));
}
