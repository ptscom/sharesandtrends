import { DEFAULT_WATCHLIST } from "@/lib/data/default-universe";

export function formatSymbolSummary(
  selected: string[],
  storedCount: number,
  useAllStored: boolean,
): string {
  if (useAllStored && storedCount > 0) {
    return `All ${storedCount} downloaded`;
  }
  if (selected.length === 0) return "";
  if (selected.length <= 4) return selected.join(", ");
  return `${selected.length} symbols`;
}

export function resolveSymbolUniverse(options: {
  useAllStored: boolean;
  selected: string[];
  stored: string[];
  fallback?: string[];
}): string[] {
  const { useAllStored, selected, stored, fallback = DEFAULT_WATCHLIST } =
    options;

  if (useAllStored && stored.length > 0) return stored;
  if (selected.length > 0) return selected;
  if (stored.length > 0) return stored;
  return fallback;
}

export function countSelectedSymbols(
  selected: string[],
  storedCount: number,
  useAllStored: boolean,
): number {
  if (useAllStored && storedCount > 0) return storedCount;
  return selected.length;
}
