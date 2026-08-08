import { getIndicatorDefinition } from "@/lib/engine/registry";
import type { Expression, IndicatorDef, PatternDefinition } from "@/lib/types";

export type RuleOp =
  | "crosses_above"
  | "crosses_below"
  | "gt"
  | "lt"
  | "gte"
  | "lte";

export interface SimpleRule {
  op: RuleOp;
  leftRef: string;
  rightKind: "ref" | "value";
  rightRef?: string;
  rightValue?: number;
}

const BUILTIN_REFS = ["open", "high", "low", "close", "volume"];

export function listSeriesRefs(pattern: PatternDefinition): string[] {
  const refs = new Set<string>(BUILTIN_REFS);

  for (const ind of pattern.indicators) {
    const def = getIndicatorDefinition(ind.type);
    if (!def) {
      refs.add(ind.alias);
      continue;
    }
    if (def.outputs.length === 1) {
      refs.add(ind.alias);
      continue;
    }
    for (const out of def.outputs) {
      refs.add(out === def.outputs[0] ? ind.alias : `${ind.alias}_${out}`);
    }
  }

  return [...refs].sort();
}

export function buildExpression(rule: SimpleRule): Expression {
  const left = { ref: rule.leftRef };
  const right =
    rule.rightKind === "ref"
      ? { ref: rule.rightRef ?? rule.leftRef }
      : { value: rule.rightValue ?? 0 };

  return { op: rule.op, left, right };
}

export function parseSimpleRule(expr: Expression | undefined): SimpleRule | null {
  if (!expr) return null;
  if (expr.args?.length) return null;

  const left = expr.left;
  if (!left || isExpressionNode(left) || !("ref" in left)) return null;

  const right = expr.right;
  if (!right) return null;

  if (isExpressionNode(right)) return null;

  if ("ref" in right) {
    return {
      op: expr.op as RuleOp,
      leftRef: left.ref,
      rightKind: "ref",
      rightRef: right.ref,
    };
  }

  if ("value" in right) {
    return {
      op: expr.op as RuleOp,
      leftRef: left.ref,
      rightKind: "value",
      rightValue: right.value,
    };
  }

  return null;
}

function isExpressionNode(value: unknown): value is Expression {
  return (
    typeof value === "object" &&
    value !== null &&
    "op" in value &&
    typeof (value as Expression).op === "string"
  );
}

export function describeRule(expr: Expression | undefined): string {
  const rule = parseSimpleRule(expr);
  if (!rule) return "Custom expression";
  const right =
    rule.rightKind === "ref" ? rule.rightRef : String(rule.rightValue);
  return `${rule.leftRef} ${rule.op.replaceAll("_", " ")} ${right}`;
}

export function defaultIndicator(type: string, index: number): IndicatorDef {
  const def = getIndicatorDefinition(type);
  const params: Record<string, number | string> = {};
  if (def) {
    for (const [key, schema] of Object.entries(def.params)) {
      params[key] = schema.default;
    }
  }
  return {
    alias: `${type}_${index + 1}`,
    type,
    params,
  };
}

export function blankPattern(): PatternDefinition {
  return {
    name: "New Strategy",
    description: "Custom strategy",
    indicators: [
      {
        alias: "ema_fast",
        type: "ema",
        params: { length: 12, source: "close" },
      },
      {
        alias: "ema_slow",
        type: "ema",
        params: { length: 26, source: "close" },
      },
    ],
    entry: buildExpression({
      op: "crosses_above",
      leftRef: "ema_fast",
      rightKind: "ref",
      rightRef: "ema_slow",
    }),
    exit: buildExpression({
      op: "crosses_below",
      leftRef: "ema_fast",
      rightKind: "ref",
      rightRef: "ema_slow",
    }),
    backtest: {
      entryOn: "close",
      exitOn: "opposite_signal",
      minTrades: 5,
    },
  };
}
