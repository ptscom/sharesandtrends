import {
  EXPLORATION_PRESETS,
  type ExplorationPreset,
} from "@/lib/explore/exploration-presets";
import type { ExplorationPresetKind } from "@/lib/explore/exploration-models";
import type {
  BacktestConfig,
  Expression,
  PatternDefinition,
  ValueRef,
} from "@/lib/types";
export interface ExplorationStrategyPreset {
  id: string;
  category: string;
  pattern: PatternDefinition;
  entryLogic: string;
  defaultParams: string;
  exitLogic: string;
}

const BT: BacktestConfig = {
  entryOn: "close",
  exitOn: "opposite_signal",
  minTrades: 5,
};

function cross(
  left: string,
  right: string | number,
  op: "crosses_above" | "crosses_below" = "crosses_above",
): Expression {
  return {
    op,
    left: { ref: left },
    right: typeof right === "number" ? { value: right } : { ref: right },
  };
}

function defaultParams(
  preset: ExplorationPreset,
): Record<string, number | string> {
  const params: Record<string, number | string> = {};
  for (const param of preset.params) {
    params[param.key] = param.default;
  }
  return params;
}

function invertEntryOp(op: Expression["op"]): Expression["op"] {
  switch (op) {
    case "crosses_above":
      return "crosses_below";
    case "crosses_below":
      return "crosses_above";
    case "gt":
    case "gte":
      return "crosses_below";
    case "lt":
    case "lte":
      return "crosses_above";
    default:
      return "crosses_below";
  }
}

function invertEntryExit(entry: Expression): Expression {
  return {
    op: invertEntryOp(entry.op),
    left: entry.left,
    right: entry.right,
  };
}

function refName(ref: ValueRef | Expression | undefined): string | null {
  if (!ref || !("ref" in ref)) return null;
  return ref.ref;
}

function thresholdValue(
  ref: ValueRef | Expression | undefined,
): number | null {
  if (!ref || !("value" in ref)) return null;
  return ref.value;
}

function oscillatorTakeProfitExit(entry: Expression): Expression | null {
  const output = refName(entry.left);
  const threshold = thresholdValue(entry.right);
  if (!output || threshold === null) return null;

  if (entry.op === "lt" || entry.op === "lte") {
    if (output === "rsi" || output === "mfi" || output === "stoch_rsi") {
      return cross(output, 70, "crosses_below");
    }
    if (output === "williamsr") {
      return cross(output, -20, "crosses_below");
    }
    if (output === "cci") {
      return cross(output, 100, "crosses_below");
    }
    if (output === "zscore") {
      return cross(output, 0, "crosses_below");
    }
    if (output === "bb_percent_b") {
      return cross(output, 0.5, "crosses_below");
    }
    return cross(output, threshold, "crosses_above");
  }

  return null;
}

function middleBandRef(pattern: PatternDefinition): string | null {
  const indicator = pattern.indicators[0];
  if (!indicator) return null;
  if (indicator.type === "bb") return "bb_middle";
  if (indicator.type === "keltner") return `${indicator.alias}_middle`;
  if (indicator.type === "envelope") return `${indicator.alias}_middle`;
  return null;
}

function withExitRollingLow(
  pattern: PatternDefinition,
  params: Record<string, number | string>,
): { pattern: PatternDefinition; exitRef: string; exitLen: number } {
  const lookback = Number(params.lookback ?? 20);
  const exitLen = Math.max(10, Math.floor(lookback / 2));
  const exitRef = "exit_rolling_low";
  const timeframe = pattern.indicators[0]?.timeframe;

  if (pattern.indicators.some((indicator) => indicator.alias === exitRef)) {
    return { pattern, exitRef, exitLen };
  }

  return {
    pattern: {
      ...pattern,
      indicators: [
        ...pattern.indicators,
        {
          alias: exitRef,
          type: "rolling_low",
          params: { length: exitLen },
          timeframe,
        },
      ],
    },
    exitRef,
    exitLen,
  };
}

function buildExit(
  preset: ExplorationPreset,
  pattern: PatternDefinition,
  params: Record<string, number | string>,
): { pattern: PatternDefinition; exit: Expression; exitLogic: string } {
  const entry = pattern.entry;

  if (preset.kind === "chart_pattern") {
    return {
      pattern,
      exit: cross("chart_pattern", 0.5, "crosses_below"),
      exitLogic: "Chart pattern signal fades",
    };
  }

  if (preset.kind === "price_breakout") {
    if (pattern.indicators.some((indicator) => indicator.type === "darvas_box")) {
      const bullish =
        preset.id.includes("up") ||
        (!preset.id.includes("down") && !preset.id.includes("breakdown"));
      return {
        pattern,
        exit: bullish
          ? cross("close", "darvas_box_bottom_prior", "crosses_below")
          : cross("close", "darvas_box_top_prior", "crosses_above"),
        exitLogic: bullish
          ? "Close below prior Darvas box bottom"
          : "Close above prior Darvas box top",
      };
    }

    const augmented = withExitRollingLow(pattern, params);
    return {
      pattern: augmented.pattern,
      exit: cross("close", augmented.exitRef, "crosses_below"),
      exitLogic: `Close breaks below ${augmented.exitLen}-day low`,
    };
  }

  if (preset.kind === "price_vs_band") {
    const middle = middleBandRef(pattern);
    if (middle) {
      const entryBand = refName(entry.right) ?? "";
      const bullish =
        entry.op === "crosses_above" ||
        entry.op === "gt" ||
        entry.op === "gte" ||
        entryBand.includes("lower");
      return {
        pattern,
        exit: cross(
          refName(entry.left) ?? "close",
          middle,
          bullish ? "crosses_below" : "crosses_above",
        ),
        exitLogic: bullish
          ? "Price crosses back below middle band"
          : "Price crosses back above middle band",
      };
    }
  }

  const oscillatorExit = oscillatorTakeProfitExit(entry);
  if (oscillatorExit) {
    return {
      pattern,
      exit: oscillatorExit,
      exitLogic: "Oscillator reaches take-profit level",
    };
  }

  const inverted = invertEntryExit(entry);
  return {
    pattern,
    exit: inverted,
    exitLogic: describeExit(preset.kind, inverted),
  };
}

function describeExit(kind: ExplorationPresetKind, exit: Expression): string {
  const left = refName(exit.left) ?? "signal";
  const right = refName(exit.right);
  const value = thresholdValue(exit.right);

  switch (exit.op) {
    case "crosses_below":
      return right
        ? `${left} crosses below ${right}`
        : value !== null
          ? `${left} crosses below ${value}`
          : "Opposite crossover";
    case "crosses_above":
      return right
        ? `${left} crosses above ${right}`
        : value !== null
          ? `${left} crosses above ${value}`
          : "Opposite crossover";
    default:
      return kind === "overlay_vs_overlay"
        ? "Opposite moving-average crossover"
        : "Opposite entry signal";
  }
}

export function explorationPresetToStrategy(
  preset: ExplorationPreset,
  params: Record<string, number | string> = defaultParams(preset),
  timeframeMode: "1D" | "1W" | "1M" | "mtf" = "1D",
): ExplorationStrategyPreset {
  const basePattern = preset.buildPattern(params, timeframeMode);
  const { pattern, exit, exitLogic } = buildExit(preset, basePattern, params);

  return {
    id: preset.id,
    category: preset.category,
    entryLogic: preset.description,
    defaultParams: preset.describe(params),
    exitLogic,
    pattern: {
      ...pattern,
      name: preset.name,
      description: preset.description,
      exit,
      backtest: BT,
    },
  };
}

export function buildStrategyPresetsFromExplorations(): ExplorationStrategyPreset[] {
  return EXPLORATION_PRESETS.map((preset) => explorationPresetToStrategy(preset));
}

export function getExplorationStrategyPreset(
  presetId: string,
): ExplorationStrategyPreset | undefined {
  const exploration = EXPLORATION_PRESETS.find((preset) => preset.id === presetId);
  if (!exploration) return undefined;
  return explorationPresetToStrategy(exploration);
}

function indicatorPeriod(indicator: PatternDefinition["indicators"][number]): number | null {
  const raw =
    indicator.params.length ??
    indicator.params.period ??
    indicator.params.lookback ??
    indicator.params.maPeriod;
  return raw === undefined ? null : Number(raw);
}

export function inferExplorationParams(
  preset: ExplorationPreset,
  pattern: PatternDefinition,
): Record<string, number | string> {
  const params = defaultParams(preset);
  const entry = pattern.entry;
  const entryLeft = refName(entry.left);
  const entryRight = refName(entry.right);
  const entryValue = thresholdValue(entry.right);

  for (const def of preset.params) {
    switch (def.key) {
      case "period": {
        const period = indicatorPeriod(pattern.indicators[0]!);
        if (period !== null) params.period = period;
        break;
      }
      case "fastPeriod": {
        const fast =
          pattern.indicators.find((indicator) => indicator.alias === "fast") ??
          pattern.indicators[0];
        const period = fast ? indicatorPeriod(fast) : null;
        if (period !== null) params.fastPeriod = period;
        break;
      }
      case "slowPeriod": {
        const slow =
          pattern.indicators.find((indicator) => indicator.alias === "slow") ??
          pattern.indicators[1];
        const period = slow ? indicatorPeriod(slow) : null;
        if (period !== null) params.slowPeriod = period;
        break;
      }
      case "lookback": {
        const source = pattern.indicators.find((indicator) =>
          ["rolling_high", "rolling_low", "rolling_range_pct", "chart_pattern", "darvas_box"].includes(
            indicator.type,
          ),
        );
        const lookback = source ? indicatorPeriod(source) : null;
        if (lookback !== null) params.lookback = lookback;
        break;
      }
      case "maxRangePct": {
        const filterValue = thresholdValue(pattern.filters?.right);
        if (filterValue !== null) params.maxRangePct = filterValue;
        break;
      }
      case "threshold":
        if (entryValue !== null) params.threshold = entryValue;
        break;
      case "price":
        if (entryLeft && ["open", "high", "low", "close"].includes(entryLeft)) {
          params.price = entryLeft;
        }
        break;
      case "op":
        params.op = entry.op;
        break;
      case "band": {
        const bandRef = entryRight ?? "";
        if (bandRef.includes("upper")) params.band = "upper";
        else if (bandRef.includes("lower")) params.band = "lower";
        else if (bandRef.includes("middle")) params.band = "middle";
        break;
      }
      case "std": {
        const bb = pattern.indicators.find((indicator) => indicator.type === "bb");
        if (bb?.params.stdDev !== undefined) params.std = Number(bb.params.stdDev);
        break;
      }
      case "pct": {
        const envelope = pattern.indicators.find(
          (indicator) => indicator.type === "envelope",
        );
        if (envelope?.params.pct !== undefined) params.pct = Number(envelope.params.pct);
        break;
      }
      case "fast": {
        const macd = pattern.indicators.find((indicator) => indicator.type === "macd");
        if (macd?.params.fast !== undefined) params.fast = Number(macd.params.fast);
        break;
      }
      case "slow": {
        const macd = pattern.indicators.find((indicator) => indicator.type === "macd");
        if (macd?.params.slow !== undefined) params.slow = Number(macd.params.slow);
        break;
      }
      case "signal": {
        const macd = pattern.indicators.find((indicator) => indicator.type === "macd");
        if (macd?.params.signal !== undefined) {
          params.signal = Number(macd.params.signal);
        } else {
          const trix = pattern.indicators.find((indicator) => indicator.type === "trix");
          if (trix?.params.signal !== undefined) {
            params.signal = Number(trix.params.signal);
          }
        }
        break;
      }
      case "k": {
        const stoch = pattern.indicators.find(
          (indicator) => indicator.type === "stochastic",
        );
        if (stoch?.params.period !== undefined) params.k = Number(stoch.params.period);
        break;
      }
      case "d": {
        const stoch = pattern.indicators.find(
          (indicator) => indicator.type === "stochastic",
        );
        if (stoch?.params.signal !== undefined) params.d = Number(stoch.params.signal);
        break;
      }
      case "rsiPeriod": {
        const stochRsi = pattern.indicators.find(
          (indicator) => indicator.type === "stoch_rsi",
        );
        if (stochRsi?.params.rsiPeriod !== undefined) {
          params.rsiPeriod = Number(stochRsi.params.rsiPeriod);
        }
        break;
      }
      case "stochPeriod": {
        const stochRsi = pattern.indicators.find(
          (indicator) => indicator.type === "stoch_rsi",
        );
        if (stochRsi?.params.stochPeriod !== undefined) {
          params.stochPeriod = Number(stochRsi.params.stochPeriod);
        }
        break;
      }
      case "minDays":
        if (pattern.filters?.minBars) params.minDays = pattern.filters.minBars;
        break;
      case "priorCompare":
        if (pattern.filters?.op === "streak_above") params.priorCompare = "above";
        else if (pattern.filters?.op === "streak_below") params.priorCompare = "below";
        break;
      default:
        break;
    }
  }

  return params;
}

export function rebuildStrategyPattern(
  presetId: string,
  params: Record<string, number | string>,
  existing?: PatternDefinition,
  timeframeMode: "1D" | "1W" | "1M" | "mtf" = "1D",
): PatternDefinition {
  const preset = EXPLORATION_PRESETS.find((item) => item.id === presetId);
  if (!preset) {
    throw new Error(`Unknown exploration preset: ${presetId}`);
  }

  const rebuilt = explorationPresetToStrategy(preset, params, timeframeMode);
  return {
    ...rebuilt.pattern,
    id: existing?.id ?? presetId,
    exit: existing?.exit ?? rebuilt.pattern.exit,
    backtest: existing?.backtest ?? rebuilt.pattern.backtest,
  };
}
