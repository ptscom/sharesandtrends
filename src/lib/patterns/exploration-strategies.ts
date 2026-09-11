import {
  EXPLORATION_PRESETS,
  type ExplorationPreset,
} from "@/lib/explore/exploration-presets";
import type {
  BacktestConfig,
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
  holdDays: 10,
  minTrades: 5,
};

function defaultParams(
  preset: ExplorationPreset,
): Record<string, number | string> {
  const params: Record<string, number | string> = {};
  for (const param of preset.params) {
    params[param.key] = param.default;
  }
  return params;
}

export function explorationPresetToStrategy(
  preset: ExplorationPreset,
  params: Record<string, number | string> = defaultParams(preset),
  timeframeMode: "1D" | "1W" | "1M" | "mtf" = "1D",
): ExplorationStrategyPreset {
  const basePattern = preset.buildPattern(params, timeframeMode);

  return {
    id: preset.id,
    category: preset.category,
    entryLogic: preset.description,
    defaultParams: preset.describe(params),
    exitLogic: "Not configured",
    pattern: {
      ...basePattern,
      name: preset.name,
      description: preset.description,
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

function indicatorPeriod(
  indicator: PatternDefinition["indicators"][number],
): number | null {
  const raw =
    indicator.params.length ??
    indicator.params.period ??
    indicator.params.lookback ??
    indicator.params.maPeriod;
  return raw === undefined ? null : Number(raw);
}

function refName(ref: ValueRef | undefined): string | null {
  if (!ref || !("ref" in ref)) return null;
  return ref.ref;
}

function thresholdValue(ref: ValueRef | undefined): number | null {
  if (!ref || !("value" in ref)) return null;
  return ref.value;
}

export function inferExplorationParams(
  preset: ExplorationPreset,
  pattern: PatternDefinition,
): Record<string, number | string> {
  const params = defaultParams(preset);
  const entry = pattern.entry;
  const entryLeft =
    entry.left && "ref" in entry.left ? refName(entry.left) : null;
  const entryRight =
    entry.right && "ref" in entry.right ? refName(entry.right) : null;
  const entryValue =
    entry.right && "value" in entry.right ? thresholdValue(entry.right) : null;

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
          [
            "rolling_high",
            "rolling_low",
            "rolling_range_pct",
            "dormant_price_break",
            "chart_pattern",
            "darvas_box",
          ].includes(indicator.type),
        );
        const lookback = source ? indicatorPeriod(source) : null;
        if (lookback !== null) params.lookback = lookback;
        break;
      }
      case "maxRangePct": {
        const filterRight = pattern.filters?.right;
        const filterValue =
          filterRight && "value" in filterRight
            ? thresholdValue(filterRight)
            : null;
        if (filterValue !== null) params.maxRangePct = filterValue;
        break;
      }
      case "threshold":
        if (entryValue !== null) params.threshold = entryValue;
        break;
      case "movePercent":
        if (entryValue !== null) params.movePercent = Math.abs(entryValue);
        break;
      case "price": {
        if (entryLeft && ["open", "high", "low", "close"].includes(entryLeft)) {
          params.price = entryLeft;
          break;
        }
        const dormant = pattern.indicators.find(
          (indicator) => indicator.type === "dormant_price_break",
        );
        if (dormant?.params.source) {
          params.price = String(dormant.params.source);
          break;
        }
        const dailyRet = pattern.indicators.find(
          (indicator) => indicator.type === "daily_return_pct",
        );
        if (dailyRet?.params.source) {
          params.price = String(dailyRet.params.source);
        }
        break;
      }
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
    exit: existing?.exit,
    backtest: existing?.backtest ?? rebuilt.pattern.backtest,
  };
}
