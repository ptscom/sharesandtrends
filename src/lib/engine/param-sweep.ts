import { runBacktest } from "@/lib/engine/backtest";
import type { TradeSettings } from "@/lib/engine/trade-settings";
import {
  applyOptimizationVar,
  extractOptimizationVars,
  type OptimizationVar,
} from "@/lib/patterns/optimization";
import type { BacktestStats, PatternDefinition, Trade } from "@/lib/types";

export const MAX_BACKTEST_SYMBOLS = 50;
export const MAX_COMBOS_PER_STRATEGY = 100;
export const MAX_TOTAL_RUNS = 2500;

export interface SweepVarConfig {
  id: string;
  label: string;
  group: string;
  type: "int" | "float" | "enum";
  enabled: boolean;
  sweep: boolean;
  value: number | string;
  min: number;
  max: number;
  step: number;
  options?: string[];
}

export interface StrategySweepState {
  id: string;
  name: string;
  pattern: PatternDefinition;
  vars: SweepVarConfig[];
}

export interface BacktestSweepRow {
  strategyId: string;
  strategyName: string;
  symbol: string;
  paramLabel: string;
  params: Record<string, number | string>;
  stats: BacktestStats;
  trades: Trade[];
}

export function optimizationVarToSweepConfig(v: OptimizationVar): SweepVarConfig {
  return {
    id: v.id,
    label: v.label,
    group: v.group,
    type: v.type,
    enabled: true,
    sweep: false,
    value: v.value,
    min: v.min ?? (typeof v.value === "number" ? v.value : 0),
    max: v.max ?? (typeof v.value === "number" ? v.value : 100),
    step: v.step ?? (v.type === "float" ? 0.1 : 1),
    options: v.options,
  };
}

export function createStrategySweepState(
  id: string,
  name: string,
  pattern: PatternDefinition,
): StrategySweepState {
  return {
    id,
    name,
    pattern: structuredClone(pattern),
    vars: extractOptimizationVars(pattern).map(optimizationVarToSweepConfig),
  };
}

export function generateSweepValues(config: SweepVarConfig): (number | string)[] {
  if (!config.enabled) return [];

  if (config.type === "enum") {
    return [config.value];
  }

  if (!config.sweep) {
    return [config.type === "int" ? Math.round(Number(config.value)) : Number(config.value)];
  }

  const values: number[] = [];
  const step = config.step > 0 ? config.step : 1;
  for (let v = config.min; v <= config.max + step / 2; v += step) {
    const rounded =
      config.type === "int" ? Math.round(v) : Number(v.toFixed(4));
    if (values.length === 0 || values[values.length - 1] !== rounded) {
      values.push(rounded);
    }
  }
  return values;
}

export function generateParamCombos(
  vars: SweepVarConfig[],
): Record<string, number | string>[] {
  const active = vars.filter((v) => v.enabled);
  if (active.length === 0) return [{}];

  const valueLists = active.map((v) => ({
    id: v.id,
    values: generateSweepValues(v),
  }));

  if (valueLists.some((list) => list.values.length === 0)) return [];

  const combos = valueLists.reduce<Record<string, number | string>[]>(
    (acc, { id, values }) =>
      acc.flatMap((combo) =>
        values.map((value) => ({ ...combo, [id]: value })),
      ),
    [{}],
  );

  return combos;
}

export function countParamCombos(vars: SweepVarConfig[]): number {
  return generateParamCombos(vars).length;
}

export function formatParamLabel(
  vars: SweepVarConfig[],
  params: Record<string, number | string>,
): string {
  const parts = vars
    .filter((v) => v.enabled && v.id in params)
    .map((v) => {
      const short =
        v.label.split("·").pop()?.trim() ?? v.label;
      return `${short}=${params[v.id]}`;
    });
  return parts.length > 0 ? parts.join(", ") : "Default";
}

export function applyParamCombo(
  pattern: PatternDefinition,
  params: Record<string, number | string>,
): PatternDefinition {
  let next = structuredClone(pattern);
  for (const [id, value] of Object.entries(params)) {
    next = applyOptimizationVar(next, id, value);
  }
  return next;
}

export interface RunSweepOptions {
  strategies: StrategySweepState[];
  symbols: string[];
  priceData: Record<string, import("@/lib/types").OhlcvBar[]>;
  tradeSettings?: TradeSettings;
  onProgress?: (done: number, total: number) => void;
  maxCombosPerStrategy?: number;
  maxTotalRuns?: number;
}

export function estimateSweepRuns(
  strategies: StrategySweepState[],
  symbolCount: number,
): { combos: number; total: number; warnings: string[] } {
  const warnings: string[] = [];
  let combos = 0;
  let total = 0;

  for (const strategy of strategies) {
    const count = countParamCombos(strategy.vars);
    combos += count;
    total += count * symbolCount;
    if (count > MAX_COMBOS_PER_STRATEGY) {
      warnings.push(
        `"${strategy.name}" has ${count} parameter combos (max ${MAX_COMBOS_PER_STRATEGY}). Reduce sweep ranges.`,
      );
    }
  }

  if (total > MAX_TOTAL_RUNS) {
    warnings.push(
      `Estimated ${total} backtests exceeds limit of ${MAX_TOTAL_RUNS}. Use fewer symbols, strategies, or narrower sweeps.`,
    );
  }
  return { combos, total, warnings };
}

export async function runParameterSweep(
  options: RunSweepOptions,
): Promise<BacktestSweepRow[]> {
  const {
    strategies,
    symbols,
    priceData,
    onProgress,
    tradeSettings,
    maxCombosPerStrategy = MAX_COMBOS_PER_STRATEGY,
    maxTotalRuns = MAX_TOTAL_RUNS,
  } = options;

  const rows: BacktestSweepRow[] = [];
  let done = 0;

  const total = strategies.reduce((sum, strategy) => {
    const comboCount = Math.min(
      countParamCombos(strategy.vars),
      maxCombosPerStrategy,
    );
    return sum + comboCount * symbols.length;
  }, 0);

  for (const strategy of strategies) {
    const combos = generateParamCombos(strategy.vars).slice(
      0,
      maxCombosPerStrategy,
    );

    for (const combo of combos) {
      const pattern = applyParamCombo(strategy.pattern, combo);
      const paramLabel = formatParamLabel(strategy.vars, combo);

      for (const symbol of symbols) {
        if (done >= maxTotalRuns) break;

        const bars = priceData[symbol];
        if (!bars || bars.length < 60) {
          done += 1;
          onProgress?.(done, total);
          continue;
        }

        const result = runBacktest(symbol, bars, pattern, tradeSettings);
        rows.push({
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol,
          paramLabel,
          params: combo,
          stats: result.stats,
          trades: result.trades,
        });

        done += 1;
        onProgress?.(done, total);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  return rows;
}
