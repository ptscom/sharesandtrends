import type { StrategyPreset } from "@/lib/patterns/strategies";

export const POPULAR_STRATEGY_IDS = [
  "ema-cross",
  "golden-cross",
  "adx-di-trend",
  "price-above-sma",
] as const;

export const RECENT_STRATEGIES_KEY = "st-recent-strategies";
export const MAX_RECENT_STRATEGIES = 5;

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

export function paramTags(preset: StrategyPreset): string[] {
  const tags = [preset.category];
  const params = preset.defaultParams
    .split(/[,·]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...tags, ...params.slice(0, 2)];
}

export function loadRecentStrategyIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_STRATEGIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveRecentStrategyIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    RECENT_STRATEGIES_KEY,
    JSON.stringify(ids.slice(0, MAX_RECENT_STRATEGIES)),
  );
}

export function pushRecentStrategyId(id: string): string[] {
  const next = [id, ...loadRecentStrategyIds().filter((x) => x !== id)].slice(
    0,
    MAX_RECENT_STRATEGIES,
  );
  saveRecentStrategyIds(next);
  return next;
}
