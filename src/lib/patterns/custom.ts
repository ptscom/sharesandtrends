import { summarizeIndicatorParams } from "@/lib/patterns/optimization";
import { describeRule } from "@/lib/patterns/rule-builder";
import type { StrategyPreset } from "@/lib/patterns/strategies";
import type { PatternDefinition } from "@/lib/types";

export function patternToPreset(pattern: PatternDefinition): StrategyPreset {
  return {
    id: pattern.id ?? crypto.randomUUID(),
    category: "Custom",
    pattern,
    entryLogic: describeRule(pattern.entry),
    defaultParams: summarizeIndicatorParams(pattern.indicators),
    exitLogic: pattern.exit ? describeRule(pattern.exit) : "Opposite signal",
  };
}
