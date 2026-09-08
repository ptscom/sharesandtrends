import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";
import type { PatternDefinition } from "@/lib/types";

export type ExplorePath = "indicator" | "strategy";

export type PriceField = "open" | "high" | "low" | "close";

export type ExplorationOp =
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "crosses_above"
  | "crosses_below";

export type ExplorationOperand =
  | { kind: "price"; field: PriceField }
  | { kind: "number"; value: number }
  | {
      kind: "indicator";
      indicatorType: string;
      params: Record<string, number | string>;
      output?: string;
    };

export interface ExplorationCondition {
  id: string;
  left: ExplorationOperand;
  op: ExplorationOp;
  right: ExplorationOperand;
}

/** One rule row — first row is IF, later rows join via connector. */
export interface ExplorationConditionRow {
  id: string;
  /** How this row connects to the previous row (undefined on first row). */
  connector?: "and" | "or";
  condition: ExplorationCondition;
}

export interface ExplorationBuilderState {
  rows: ExplorationConditionRow[];
  /** Optional streak/duration rule evaluated before the signal bar */
  priorContext?: ExplorationPriorContext;
  /** @deprecated Legacy flat list — migrated via normalizeBuilderState() */
  logic?: "and" | "or";
  /** @deprecated Legacy flat list — migrated via normalizeBuilderState() */
  conditions?: ExplorationCondition[];
}

export type PriorContextCompare = "below" | "above";

/** Series must stay above/below a level for minBars ending the day before the signal */
export interface ExplorationPriorContext {
  enabled: boolean;
  minBars: number;
  compare: PriorContextCompare;
  level: number;
  operand: ExplorationOperand;
}

export function createDefaultPriorContext(): ExplorationPriorContext {
  return {
    enabled: false,
    minBars: 100,
    compare: "below",
    level: 60,
    operand: {
      kind: "indicator",
      indicatorType: "rsi",
      params: { length: 14, source: "close" },
    },
  };
}

export interface ExplorationParamDef {
  key: string;
  label: string;
  type: "int" | "float" | "enum";
  default: number | string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
}

export type ExplorationPresetKind =
  | "overlay_vs_price"
  | "overlay_vs_overlay"
  | "oscillator_level"
  | "line_cross"
  | "price_vs_band"
  | "streak_breakout"
  | "price_breakout";

export interface ExplorationPreset {
  id: string;
  name: string;
  category: string;
  kind: ExplorationPresetKind;
  description: string;
  params: ExplorationParamDef[];
  buildPattern: (
    params: Record<string, number | string>,
    timeframeMode: ExploreTimeframeMode,
  ) => PatternDefinition;
  describe: (params: Record<string, number | string>) => string;
}

export interface ExplorationFilter {
  source: "preset" | "builder";
  name: string;
  /** Short human-readable summary for results and snapshots */
  description?: string;
  timeframeMode: ExploreTimeframeMode;
  presetId?: string;
  params?: Record<string, number | string>;
  builder?: ExplorationBuilderState;
  /** Set when this custom filter was saved to the exploration library */
  savedId?: string;
}

export interface SavedExploration {
  id: string;
  name: string;
  description?: string;
  builder: ExplorationBuilderState;
  createdAt: string;
  updatedAt: string;
}

export interface HorizonStats {
  avgReturnPct: number;
  winRate: number;
  trades: number;
}

export interface IndicatorScanResultRow {
  symbol: string;
  signalDate: string | null;
  signalToday: boolean;
  lastClose: number;
  /** Historical backtest stats for fixed hold periods */
  horizons?: {
    d3: HorizonStats;
    d5: HorizonStats;
    d10: HorizonStats;
  };
}

export interface IndicatorScanRun {
  id: string;
  runAt: string;
  /** Groups runs for the same exploration filter (preset, saved, or custom) */
  filterKey: string;
  universe: string[];
  filterName: string;
  filterDescription: string;
  timeframeMode: ExploreTimeframeMode;
  /** Snapshot of the exploration filter used for this run (for symbol drill-down) */
  filter?: ExplorationFilter;
  results: IndicatorScanResultRow[];
}

export function defaultParamsForPreset(
  preset: ExplorationPreset,
): Record<string, number | string> {
  const params: Record<string, number | string> = {};
  for (const def of preset.params) {
    params[def.key] = def.default;
  }
  return params;
}

export function summarizeExplorationFilter(
  filter: ExplorationFilter | null,
): string {
  if (!filter) return "Not configured";
  return filter.name;
}

export function summarizeExplorationFilters(
  filters: Record<string, ExplorationFilter>,
): string {
  const entries = Object.values(filters);
  if (entries.length === 0) return "Not configured";
  if (entries.length === 1) return entries[0]!.name;
  return `${entries.length} explorations selected`;
}
