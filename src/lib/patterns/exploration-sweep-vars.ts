import {
  optimizationVarToSweepConfig,
  type SweepVarConfig,
} from "@/lib/engine/param-sweep";
import type { ExplorationPreset } from "@/lib/explore/exploration-presets";
import { getExplorationPreset } from "@/lib/explore/exploration-presets";
import {
  inferExplorationParams,
  rebuildStrategyPattern,
} from "@/lib/patterns/exploration-strategies";
import {
  extractOptimizationVars,
  type OptimizationVar,
} from "@/lib/patterns/optimization";
import type { PatternDefinition } from "@/lib/types";

const LOOKBACK_INDICATOR_TYPES = new Set([
  "rolling_high",
  "rolling_low",
  "rolling_range_pct",
  "darvas_box",
]);

function shouldHideOptimizationVar(
  variable: OptimizationVar,
  preset: ExplorationPreset,
  pattern: PatternDefinition,
): boolean {
  const semanticKeys = new Set(preset.params.map((param) => param.key));

  if (semanticKeys.has("lookback") && variable.group === "indicator") {
    const match = variable.id.match(/^indicator:(\d+):(length|lookback)$/);
    if (match) {
      const indicator = pattern.indicators[Number(match[1])];
      if (!indicator) return false;
      if (LOOKBACK_INDICATOR_TYPES.has(indicator.type)) return true;
      if (indicator.type === "dormant_price_break" && match[2] === "lookback") {
        return true;
      }
      if (indicator.type === "chart_pattern" && match[2] === "lookback") {
        return true;
      }
    }
  }

  if (semanticKeys.has("maxRangePct") && variable.id.startsWith("threshold:filters")) {
    return true;
  }

  if (semanticKeys.has("movePercent") && variable.id.startsWith("threshold:entry")) {
    return true;
  }

  if (semanticKeys.has("threshold") && variable.id.startsWith("threshold:entry")) {
    return true;
  }

  if (semanticKeys.has("period") && variable.group === "indicator") {
    const match = variable.id.match(/^indicator:(\d+):length$/);
    if (match && Number(match[1]) === 0) return true;
  }

  if (semanticKeys.has("fastPeriod") && variable.group === "indicator") {
    const fast = pattern.indicators.find((indicator) => indicator.alias === "fast");
    const fastIndex = fast ? pattern.indicators.indexOf(fast) : 0;
    const match = variable.id.match(/^indicator:(\d+):length$/);
    if (match && Number(match[1]) === fastIndex) return true;
  }

  if (semanticKeys.has("slowPeriod") && variable.group === "indicator") {
    const slow = pattern.indicators.find((indicator) => indicator.alias === "slow");
    const slowIndex = slow ? pattern.indicators.indexOf(slow) : 1;
    const match = variable.id.match(/^indicator:(\d+):length$/);
    if (match && Number(match[1]) === slowIndex) return true;
  }

  return false;
}

/** Rebuild exploration-linked strategies so entry + filters match indicator exploration. */
export function normalizeExplorationStrategyPattern(
  strategyId: string,
  pattern: PatternDefinition,
): PatternDefinition {
  const preset = getExplorationPreset(strategyId);
  if (!preset) return structuredClone(pattern);
  const params = inferExplorationParams(preset, pattern);
  return rebuildStrategyPattern(strategyId, params, pattern);
}

export function buildSweepVarsForStrategy(
  strategyId: string,
  pattern: PatternDefinition,
): SweepVarConfig[] {
  const preset = getExplorationPreset(strategyId);
  const normalized = preset
    ? normalizeExplorationStrategyPattern(strategyId, pattern)
    : structuredClone(pattern);

  const vars = extractOptimizationVars(normalized);
  const filtered = preset
    ? vars.filter((variable) => !shouldHideOptimizationVar(variable, preset, normalized))
    : vars;

  return filtered.map(optimizationVarToSweepConfig);
}
