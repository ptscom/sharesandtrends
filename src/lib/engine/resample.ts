import type { OhlcvBar, Timeframe } from "@/lib/types";

function weekKey(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function resampleBars(
  bars: OhlcvBar[],
  timeframe: Timeframe,
): OhlcvBar[] {
  if (timeframe === "1D" || bars.length === 0) return bars;

  const bucketFn =
    timeframe === "1W"
      ? weekKey
      : (date: string) => date.slice(0, 7);

  const buckets = new Map<string, OhlcvBar[]>();
  for (const bar of bars) {
    const key = bucketFn(bar.date);
    const group = buckets.get(key) ?? [];
    group.push(bar);
    buckets.set(key, group);
  }

  const result: OhlcvBar[] = [];
  for (const [, group] of [...buckets.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    result.push({
      date: group[group.length - 1].date,
      open: group[0].open,
      high: Math.max(...group.map((b) => b.high)),
      low: Math.min(...group.map((b) => b.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, b) => sum + b.volume, 0),
    });
  }
  return result;
}

/** Forward-fill higher timeframe values onto daily dates (no lookahead). */
export function alignHigherTimeframe(
  dailyDates: string[],
  htfDates: string[],
  htfValues: (number | null)[],
): (number | null)[] {
  const map = new Map<string, number | null>();
  htfDates.forEach((d, i) => map.set(d, htfValues[i] ?? null));

  const sortedHtf = [...htfDates].sort();
  let ptr = 0;
  let last: number | null = null;

  return dailyDates.map((date) => {
    while (ptr < sortedHtf.length && sortedHtf[ptr] <= date) {
      last = map.get(sortedHtf[ptr]) ?? last;
      ptr++;
    }
    return last;
  });
}

export function barsToSource(
  bars: OhlcvBar[],
  source: "open" | "high" | "low" | "close" | "volume",
): number[] {
  return bars.map((b) => b[source]);
}
