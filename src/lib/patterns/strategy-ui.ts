export const POPULAR_STRATEGY_IDS = [
  "exp-ema-ema",
  "exp-sma-sma",
  "exp-adx-di-cross",
  "exp-ema-price",
] as const;

export const LIBRARY_FILTERS = [
  { id: "all", label: "All" },
  { id: "Moving Averages", label: "Moving Averages" },
  { id: "Oscillators", label: "Oscillators" },
  { id: "Volatility", label: "Volatility" },
  { id: "Breakout", label: "Breakout" },
  { id: "Trend", label: "Trend" },
  { id: "Chart patterns", label: "Chart patterns" },
] as const;

export type LibraryFilterId = (typeof LIBRARY_FILTERS)[number]["id"];

/** Category badge colors aligned with exploration categories. */
export const CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  "Moving Averages": {
    bg: "bg-info-light",
    text: "text-info",
    dot: "bg-info",
  },
  Oscillators: {
    bg: "bg-brand-light",
    text: "text-brand-text",
    dot: "bg-brand",
  },
  Volatility: { bg: "bg-accent-light", text: "text-accent", dot: "bg-accent" },
  Breakout: {
    bg: "bg-success-light",
    text: "text-success",
    dot: "bg-success",
  },
  Trend: { bg: "bg-info-light", text: "text-info", dot: "bg-info" },
  "Chart patterns": {
    bg: "bg-success-light",
    text: "text-success",
    dot: "bg-success",
  },
  Custom: { bg: "bg-input", text: "text-body", dot: "bg-muted" },
};

export function categoryStyle(category: string) {
  return (
    CATEGORY_STYLES[category] ?? {
      bg: "bg-accent-light",
      text: "text-accent",
      dot: "bg-accent",
    }
  );
}

export function shortStrategyName(name: string): string {
  return name.length > 14 ? `${name.slice(0, 12)}…` : name;
}
