import { getIndicatorDefinition } from "@/lib/engine/registry";
import type {
  BacktestConfig,
  Expression,
  IndicatorDef,
  PatternDefinition,
} from "@/lib/types";

export type OptimizationVarGroup = "indicator" | "threshold" | "backtest";

export interface OptimizationVar {
  id: string;
  group: OptimizationVarGroup;
  label: string;
  type: "int" | "float" | "enum";
  value: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

const OVERLAY_TYPES = new Set([
  "sma",
  "ema",
  "bb",
  "keltner",
  "envelope",
  "psar",
]);

function isExpression(value: unknown): value is Expression {
  return (
    typeof value === "object" &&
    value !== null &&
    "op" in value &&
    typeof (value as Expression).op === "string"
  );
}

function walkExpression(
  expr: Expression,
  path: string,
  visit: (expr: Expression, path: string) => void,
): void {
  visit(expr, path);
  if (expr.left && isExpression(expr.left)) {
    walkExpression(expr.left, `${path}.left`, visit);
  }
  if (expr.right && isExpression(expr.right)) {
    walkExpression(expr.right, `${path}.right`, visit);
  }
  for (const [i, arg] of (expr.args ?? []).entries()) {
    walkExpression(arg, `${path}.args[${i}]`, visit);
  }
}

function thresholdLabel(path: string, op: string): string {
  const section = path.split(".")[0] ?? path;
  const sectionLabel =
    section === "entry"
      ? "Entry"
      : section === "exit"
        ? "Exit"
        : section === "filters"
          ? "Filter"
          : section;
  const side = path.endsWith(".left") ? " (left)" : " (right)";
  return `${sectionLabel} ${op}${side}`;
}

function extractThresholdVars(
  expr: Expression | undefined,
  root: string,
): OptimizationVar[] {
  if (!expr) return [];
  const vars: OptimizationVar[] = [];

  walkExpression(expr, root, (node, path) => {
    if (node.left && !isExpression(node.left) && "value" in node.left) {
      vars.push({
        id: `threshold:${path}.left`,
        group: "threshold",
        label: thresholdLabel(path, node.op),
        type: Number.isInteger(node.left.value) ? "int" : "float",
        value: node.left.value,
        min: -500,
        max: 500,
        step: Number.isInteger(node.left.value) ? 1 : 0.1,
      });
    }
    if (node.right && !isExpression(node.right) && "value" in node.right) {
      vars.push({
        id: `threshold:${path}.right`,
        group: "threshold",
        label: thresholdLabel(path, node.op),
        type: Number.isInteger(node.right.value) ? "int" : "float",
        value: node.right.value,
        min: -500,
        max: 500,
        step: Number.isInteger(node.right.value) ? 1 : 0.1,
      });
    }
  });

  return vars;
}

function extractBacktestVars(backtest: BacktestConfig): OptimizationVar[] {
  const vars: OptimizationVar[] = [
    {
      id: "backtest:entryOn",
      group: "backtest",
      label: "Entry timing",
      type: "enum",
      value: backtest.entryOn,
      options: ["close", "next_open"],
    },
    {
      id: "backtest:exitOn",
      group: "backtest",
      label: "Exit mode",
      type: "enum",
      value: backtest.exitOn,
      options: ["opposite_signal", "fixed_hold"],
    },
    {
      id: "backtest:minTrades",
      group: "backtest",
      label: "Min trades (backtest)",
      type: "int",
      value: backtest.minTrades ?? 5,
      min: 1,
      max: 100,
      step: 1,
    },
  ];

  if (backtest.exitOn === "fixed_hold") {
    vars.push({
      id: "backtest:holdDays",
      group: "backtest",
      label: "Hold days",
      type: "int",
      value: backtest.holdDays ?? 10,
      min: 1,
      max: 252,
      step: 1,
    });
  }

  return vars;
}

export function extractOptimizationVars(
  pattern: PatternDefinition,
): OptimizationVar[] {
  const vars: OptimizationVar[] = [];

  pattern.indicators.forEach((ind, index) => {
    const def = getIndicatorDefinition(ind.type);
    if (!def) return;

    for (const [key, schema] of Object.entries(def.params)) {
      const current = ind.params[key] ?? schema.default;
      vars.push({
        id: `indicator:${index}:${key}`,
        group: "indicator",
        label: `${ind.alias} · ${schema.label}`,
        type: schema.type,
        value: current,
        min: schema.min,
        max: schema.max,
        step: schema.type === "float" ? 0.01 : 1,
        options: schema.options,
      });
    }
  });

  vars.push(...extractThresholdVars(pattern.entry, "entry"));
  vars.push(...extractThresholdVars(pattern.exit, "exit"));
  vars.push(...extractThresholdVars(pattern.filters, "filters"));
  vars.push(...extractBacktestVars(pattern.backtest));

  return vars;
}

function setLiteralAt(
  expr: Expression,
  pathParts: string[],
  side: "left" | "right",
  value: number,
): Expression {
  const clone = structuredClone(expr);
  let node: Expression = clone;
  for (const part of pathParts) {
    const match = part.match(/^args\[(\d+)\]$/);
    if (match) {
      node = node.args![Number(match[1])]!;
    }
  }
  const target = node[side];
  if (target && !isExpression(target) && "value" in target) {
    target.value = value;
  }
  return clone;
}

function applyThresholdVar(
  pattern: PatternDefinition,
  id: string,
  value: number,
): PatternDefinition {
  const path = id.replace("threshold:", "");
  const parts = path.split(".");
  const section = parts[0];
  const side = parts[parts.length - 1] as "left" | "right";
  const nodePath = parts.slice(1, -1);

  const next = { ...pattern };
  if (section === "entry" && pattern.entry) {
    next.entry = setLiteralAt(pattern.entry, nodePath, side, value);
  } else if (section === "exit" && pattern.exit) {
    next.exit = setLiteralAt(pattern.exit, nodePath, side, value);
  } else if (section === "filters" && pattern.filters) {
    next.filters = setLiteralAt(pattern.filters, nodePath, side, value);
  }
  return next;
}

export function applyOptimizationVar(
  pattern: PatternDefinition,
  id: string,
  value: number | string,
): PatternDefinition {
  if (id.startsWith("indicator:")) {
    const [, indexStr, key] = id.split(":");
    const index = Number(indexStr);
    const indicators = pattern.indicators.map((ind, i) => {
      if (i !== index) return ind;
      return {
        ...ind,
        params: { ...ind.params, [key!]: value },
      };
    });
    return { ...pattern, indicators };
  }

  if (id.startsWith("threshold:")) {
    return applyThresholdVar(pattern, id, Number(value));
  }

  if (id.startsWith("backtest:")) {
    const key = id.replace("backtest:", "") as keyof BacktestConfig;
    const backtest = { ...pattern.backtest, [key]: value };
    if (key === "exitOn" && value !== "fixed_hold") {
      delete backtest.holdDays;
    }
    return { ...pattern, backtest };
  }

  return pattern;
}

export function chartOverlays(
  pattern: PatternDefinition,
  series: Record<string, (number | null)[]>,
): { fast?: (number | null)[]; slow?: (number | null)[] } {
  const aliases = pattern.indicators
    .filter((ind) => OVERLAY_TYPES.has(ind.type))
    .flatMap((ind) => {
      const def = getIndicatorDefinition(ind.type);
      if (!def) return [ind.alias];
      if (def.outputs.length === 1) return [ind.alias];
      return def.outputs.map((out) =>
        out === def.outputs[0] ? ind.alias : `${ind.alias}_${out}`,
      );
    });

  return {
    fast: aliases[0] ? series[aliases[0]] : undefined,
    slow: aliases[1] ? series[aliases[1]] : undefined,
  };
}

export function summarizeIndicatorParams(indicators: IndicatorDef[]): string {
  return indicators
    .map((ind) => {
      const numeric = Object.entries(ind.params)
        .filter(([, v]) => typeof v === "number")
        .map(([, v]) => v)
        .join("/");
      return numeric ? `${ind.alias}=${numeric}` : ind.alias;
    })
    .join(", ");
}
