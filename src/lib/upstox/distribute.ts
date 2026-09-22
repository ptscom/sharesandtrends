import type { TokenLane } from "@/lib/upstox/tokens";
import { activeLanes } from "@/lib/upstox/tokens";

/** Round-robin assign each symbol to a lane index (stable first attempt). */
export function assignSymbolsToLanes(
  symbols: string[],
  laneCount: number,
): Map<string, number> {
  const map = new Map<string, number>();
  if (laneCount <= 0) return map;
  symbols.forEach((symbol, index) => {
    map.set(symbol, index % laneCount);
  });
  return map;
}

export function laneForSymbol(
  lanes: TokenLane[],
  symbol: string,
  assignment: Map<string, number>,
  redistributed = false,
): TokenLane | null {
  const active = activeLanes(lanes);
  if (active.length === 0) return null;
  const preferred = assignment.get(symbol);
  if (preferred !== undefined) {
    const lane = lanes[preferred];
    if (lane && !lane.invalid) return lane;
    if (!redistributed) {
      const fallback = active[preferred % active.length];
      return fallback ?? active[0];
    }
  }
  return active[0];
}

export function distributeRoundRobin<T>(
  items: T[],
  bucketCount: number,
): T[][] {
  const buckets: T[][] = Array.from({ length: bucketCount }, () => []);
  items.forEach((item, index) => {
    buckets[index % bucketCount].push(item);
  });
  return buckets;
}
