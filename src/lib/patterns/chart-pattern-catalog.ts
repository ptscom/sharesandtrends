export type ChartPatternBias = "bullish" | "bearish";

export interface ChartPatternMeta {
  id: string;
  name: string;
  bias: ChartPatternBias;
  /** Typical minimum bars needed for detection */
  bars: number;
  implemented: boolean;
}

export const CHART_PATTERN_CATALOG: ChartPatternMeta[] = [
  { id: "bull_flag", name: "Bull Flag", bias: "bullish", bars: 30, implemented: true },
  {
    id: "ascending_triangle",
    name: "Ascending Triangle",
    bias: "bullish",
    bars: 40,
    implemented: true,
  },
  {
    id: "cup_and_handle",
    name: "Cup & Handle",
    bias: "bullish",
    bars: 60,
    implemented: true,
  },
  {
    id: "double_bottom",
    name: "Double Bottom",
    bias: "bullish",
    bars: 50,
    implemented: true,
  },
  {
    id: "long_base_breakout",
    name: "Long Base Breakout",
    bias: "bullish",
    bars: 60,
    implemented: true,
  },
  { id: "bear_flag", name: "Bear Flag", bias: "bearish", bars: 30, implemented: true },
  {
    id: "descending_triangle",
    name: "Descending Triangle",
    bias: "bearish",
    bars: 40,
    implemented: true,
  },
  {
    id: "head_and_shoulders",
    name: "Head & Shoulders",
    bias: "bearish",
    bars: 60,
    implemented: true,
  },
  { id: "double_top", name: "Double Top", bias: "bearish", bars: 50, implemented: true },
  {
    id: "long_base_breakdown",
    name: "Long Base Breakdown",
    bias: "bearish",
    bars: 60,
    implemented: true,
  },
];

export function getImplementedChartPatternIds(): string[] {
  return CHART_PATTERN_CATALOG.filter((p) => p.implemented).map((p) => p.id);
}

export function getChartPatternMeta(id: string): ChartPatternMeta | undefined {
  return CHART_PATTERN_CATALOG.find((p) => p.id === id);
}
