import { listExplorationEvents } from "@/lib/explore/exploration-events";
import type { HorizonKey } from "@/lib/explore/exploration-snapshot";
import type {
  IndicatorScanResultRow,
  IndicatorScanRun,
} from "@/lib/explore/exploration-models";
import { resolveExplorationPatternFromScan } from "@/lib/explore/resolve-exploration-scan";
import { prepareScanBarsAndPattern } from "@/lib/engine/scan-timeframe";
import { getPriceBarsBatch } from "@/lib/storage/prices";

export interface SnapshotRowExtras {
  subtitle: string;
  /** Last up to 5 signal outcomes (true = positive return). */
  last5: boolean[];
}

export function formatSymbolSubtitle(symbol: string): string {
  const base = symbol.replace(/\.(NS|BO|NSE|BSE)$/i, "").replace(/_/g, " ");
  if (!base) return symbol;

  const words = base.split(/(?=[A-Z])/).filter(Boolean);
  if (words.length > 1) {
    return words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
  }

  const lower = base.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function formatSnapshotClose(price: number): string {
  return price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function buildSnapshotRowExtras(
  scan: IndicatorScanRun,
  rows: IndicatorScanResultRow[],
  horizonKey: HorizonKey = "d5",
): Promise<Map<string, SnapshotRowExtras>> {
  const extras = new Map<string, SnapshotRowExtras>();
  for (const row of rows) {
    extras.set(row.symbol, {
      subtitle: formatSymbolSubtitle(row.symbol),
      last5: [],
    });
  }

  const pattern = await resolveExplorationPatternFromScan(scan);
  if (!pattern) return extras;

  const symbols = rows.map((row) => row.symbol);
  const priceData = await getPriceBarsBatch(symbols);
  const timeframeMode = scan.timeframeMode === "mtf" ? "1D" : scan.timeframeMode;

  for (const row of rows) {
    const dailyBars = priceData[row.symbol];
    if (!dailyBars || dailyBars.length < 10) continue;

    const { bars, pattern: scanPattern } = prepareScanBarsAndPattern(
      dailyBars,
      pattern,
      timeframeMode,
    );
    const events = listExplorationEvents(bars, scanPattern);
    const outcomes = events
      .map((event) => event.horizons[horizonKey].returnPct)
      .filter((value): value is number => value !== null)
      .slice(-5)
      .map((value) => value > 0);

    extras.set(row.symbol, {
      subtitle: formatSymbolSubtitle(row.symbol),
      last5: outcomes,
    });
  }

  return extras;
}
