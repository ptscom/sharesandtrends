export type Timeframe = "1D" | "1W" | "1M";

export type PriceSource = "open" | "high" | "low" | "close" | "volume";

export interface OhlcvBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SymbolMeta {
  symbol: string;
  name?: string;
  sector?: string;
  lastUpdated?: string;
  barCount?: number;
  fromDate?: string | null;
  toDate?: string | null;
}

export interface IndicatorDef {
  alias: string;
  type: string;
  params: Record<string, number | string>;
  timeframe?: Timeframe;
  source?: PriceSource;
}

export type ValueRef = { ref: string } | { value: number };

export type ExpressionOp =
  | "and"
  | "or"
  | "not"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "crosses_above"
  | "crosses_below"
  | "streak_below"
  | "streak_above";

export interface Expression {
  op: ExpressionOp;
  left?: ValueRef | Expression;
  right?: ValueRef | Expression;
  args?: Expression[];
  /** Consecutive bars required for streak_below / streak_above */
  minBars?: number;
}

export interface BacktestConfig {
  entryOn: "close" | "next_open";
  /** Calendar days in trade before time-based exit */
  holdDays?: number;
  minTrades?: number;
  /** @deprecated Backtests now use signal + time exit together */
  exitOn?: "opposite_signal" | "fixed_hold";
}

export interface PatternDefinition {
  id?: string;
  name: string;
  description?: string;
  indicators: IndicatorDef[];
  entry: Expression;
  exit?: Expression;
  filters?: Expression;
  backtest: BacktestConfig;
  createdAt?: string;
  updatedAt?: string;
}

export interface Trade {
  entryDate: string;
  exitDate: string;
  side: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  holdDays: number;
}

export interface BacktestStats {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgReturnPct: number;
  medianReturnPct: number;
  bestReturnPct: number;
  worstReturnPct: number;
  sharpe: number | null;
}

export interface BacktestResult {
  symbol: string;
  stats: BacktestStats;
  trades: Trade[];
  signals: SignalPoint[];
}

export interface SignalPoint {
  date: string;
  type: "entry" | "exit";
  side: "long" | "short";
  price: number;
}

export interface ScanResultRow {
  symbol: string;
  signalDate: string | null;
  signalToday: boolean;
  zScore?: number;
  stats: BacktestStats;
  lastClose: number;
}

export interface ScanRun {
  id: string;
  patternId: string;
  patternName: string;
  runAt: string;
  universe: string[];
  results: ScanResultRow[];
  filters: {
    minWinRate?: number;
    minTrades?: number;
    signalTodayOnly?: boolean;
  };
}

export interface IndicatorSeries {
  [alias: string]: (number | null)[];
}

export interface ComputedContext {
  dates: string[];
  bars: OhlcvBar[];
  series: IndicatorSeries;
}
