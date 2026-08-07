import type { ComputedContext, Expression, ValueRef } from "@/lib/types";

function isExpression(value: unknown): value is Expression {
  return (
    typeof value === "object" &&
    value !== null &&
    "op" in value &&
    typeof (value as Expression).op === "string"
  );
}

function resolveRef(
  ctx: ComputedContext,
  ref: ValueRef,
  index: number,
): number | null {
  if ("value" in ref) return ref.value;
  const key = ref.ref;
  if (key in ctx.series) {
    const v = ctx.series[key][index];
    return v === undefined ? null : v;
  }
  return null;
}

function resolveValue(
  ctx: ComputedContext,
  node: ValueRef | Expression | undefined,
  index: number,
): number | null {
  if (node === undefined) return null;
  if (isExpression(node)) {
    return evaluateExpression(ctx, node, index) ? 1 : 0;
  }
  return resolveRef(ctx, node, index);
}

export function evaluateExpression(
  ctx: ComputedContext,
  expr: Expression,
  index: number,
): boolean {
  if (index < 0 || index >= ctx.dates.length) return false;

  switch (expr.op) {
    case "and":
      return (expr.args ?? []).every((arg) =>
        evaluateExpression(ctx, arg, index),
      );
    case "or":
      return (expr.args ?? []).some((arg) =>
        evaluateExpression(ctx, arg, index),
      );
    case "gt": {
      const l = resolveValue(ctx, expr.left, index);
      const r = resolveValue(ctx, expr.right, index);
      return l !== null && r !== null && l > r;
    }
    case "lt": {
      const l = resolveValue(ctx, expr.left, index);
      const r = resolveValue(ctx, expr.right, index);
      return l !== null && r !== null && l < r;
    }
    case "gte": {
      const l = resolveValue(ctx, expr.left, index);
      const r = resolveValue(ctx, expr.right, index);
      return l !== null && r !== null && l >= r;
    }
    case "lte": {
      const l = resolveValue(ctx, expr.left, index);
      const r = resolveValue(ctx, expr.right, index);
      return l !== null && r !== null && l <= r;
    }
    case "crosses_above": {
      if (index < 1) return false;
      const l0 = resolveValue(ctx, expr.left, index - 1);
      const r0 = resolveValue(ctx, expr.right, index - 1);
      const l1 = resolveValue(ctx, expr.left, index);
      const r1 = resolveValue(ctx, expr.right, index);
      if ([l0, r0, l1, r1].some((v) => v === null)) return false;
      return l0! <= r0! && l1! > r1!;
    }
    case "crosses_below": {
      if (index < 1) return false;
      const l0 = resolveValue(ctx, expr.left, index - 1);
      const r0 = resolveValue(ctx, expr.right, index - 1);
      const l1 = resolveValue(ctx, expr.left, index);
      const r1 = resolveValue(ctx, expr.right, index);
      if ([l0, r0, l1, r1].some((v) => v === null)) return false;
      return l0! >= r0! && l1! < r1!;
    }
    default:
      return false;
  }
}

export function evaluateSeries(
  ctx: ComputedContext,
  expr: Expression,
): boolean[] {
  return ctx.dates.map((_, i) => evaluateExpression(ctx, expr, i));
}

export function evaluateOptional(
  ctx: ComputedContext,
  expr: Expression | undefined,
): boolean[] {
  if (!expr) return ctx.dates.map(() => true);
  return evaluateSeries(ctx, expr);
}
