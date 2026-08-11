export const POPULAR_STRATEGY_IDS = [
  "ema-cross",
  "golden-cross",
  "adx-di-trend",
  "price-above-sma",
] as const;

export const LIBRARY_FILTERS = [
  { id: "all", label: "All" },
  { id: "Trend", label: "Trend following" },
  { id: "Mean Reversion", label: "Reversal" },
  { id: "Momentum", label: "Momentum" },
  { id: "Breakout", label: "Breakout" },
  { id: "Candlestick", label: "Candlestick" },
] as const;

export type LibraryFilterId = (typeof LIBRARY_FILTERS)[number]["id"];

/** Category badge colors aligned with the global design system. */
export const CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  Trend: { bg: "bg-info-light", text: "text-info", dot: "bg-info" },
  Momentum: { bg: "bg-brand-light", text: "text-brand-text", dot: "bg-brand" },
  Breakout: { bg: "bg-brand-light", text: "text-brand-text", dot: "bg-brand" },
  "Mean Reversion": {
    bg: "bg-accent-light",
    text: "text-accent",
    dot: "bg-accent",
  },
  Candlestick: {
    bg: "bg-danger-light",
    text: "text-danger",
    dot: "bg-danger",
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
