import type { CurrentPriceRow, HistoricalPriceRow } from "@/lib/upstox/types";
import type { OhlcvBar } from "@/lib/types";
import { mergeHistoricalRows } from "@/lib/storage/upstox-historical";
import { mergePriceBars } from "@/lib/storage/prices";

export function historicalRowToOhlcvBar(row: HistoricalPriceRow): OhlcvBar | null {
  if (
    row.open === null ||
    row.high === null ||
    row.low === null ||
    row.close === null
  ) {
    return null;
  }
  return {
    date: row.date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume ?? 0,
  };
}

export function currentRowToOhlcvBar(
  row: CurrentPriceRow,
  tradingDate: string,
): OhlcvBar | null {
  if (
    row.open === null ||
    row.high === null ||
    row.low === null ||
    row.close === null
  ) {
    return null;
  }
  return {
    date: tradingDate,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume ?? 0,
  };
}

/** Merge Upstox rows into the shared `prices` store used by backtest/explore. */
export async function syncHistoricalRowsToPrices(
  rows: HistoricalPriceRow[],
): Promise<number> {
  const bySymbol = new Map<string, OhlcvBar[]>();
  for (const row of rows) {
    const bar = historicalRowToOhlcvBar(row);
    if (!bar) continue;
    const list = bySymbol.get(row.symbol) ?? [];
    list.push(bar);
    bySymbol.set(row.symbol, list);
  }

  let barCount = 0;
  for (const [symbol, bars] of bySymbol) {
    await mergePriceBars(symbol, bars);
    barCount += bars.length;
  }
  return barCount;
}

export function currentRowsToHistorical(
  rows: CurrentPriceRow[],
  tradingDate: string,
): HistoricalPriceRow[] {
  const out: HistoricalPriceRow[] = [];
  for (const row of rows) {
    if (
      row.open === null ||
      row.high === null ||
      row.low === null ||
      row.close === null
    ) {
      continue;
    }
    out.push({
      symbol: row.symbol,
      date: tradingDate,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    });
  }
  return out;
}

/**
 * Current-day snapshot → EOD archive + shared `prices` store.
 * Same (symbol, date) is overwritten when a later historical download includes that day.
 */
export async function syncCurrentRowsToStores(
  rows: CurrentPriceRow[],
  tradingDate: string,
): Promise<number> {
  const historical = currentRowsToHistorical(rows, tradingDate);
  if (historical.length === 0) return 0;
  return mergeHistoricalRows(historical);
}

/** @deprecated Use syncCurrentRowsToStores */
export async function syncCurrentRowsToPrices(
  rows: CurrentPriceRow[],
  tradingDate: string,
): Promise<number> {
  let count = 0;
  for (const row of rows) {
    const bar = currentRowToOhlcvBar(row, tradingDate);
    if (!bar) continue;
    await mergePriceBars(row.symbol, [bar]);
    count += 1;
  }
  return count;
}
