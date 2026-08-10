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

export const CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  Trend: { bg: "bg-accent/15", text: "text-accent", dot: "bg-accent" },
  Momentum: { bg: "bg-info/15", text: "text-info", dot: "bg-info" },
  Breakout: { bg: "bg-brand/15", text: "text-brand-dark", dot: "bg-brand" },
  "Mean Reversion": {
    bg: "bg-success/15",
    text: "text-success",
    dot: "bg-success",
  },
  Candlestick: { bg: "bg-danger/15", text: "text-danger", dot: "bg-danger" },
  Custom: { bg: "bg-muted/15", text: "text-muted", dot: "bg-muted" },
};

export function categoryStyle(category: string) {
  return (
    CATEGORY_STYLES[category] ?? {
      bg: "bg-accent/15",
      text: "text-accent",
      dot: "bg-accent",
    }
  );
}

export function shortStrategyName(name: string): string {
  return name.length > 14 ? `${name.slice(0, 12)}…` : name;
}
