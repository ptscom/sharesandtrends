import type { OhlcvBar } from "@/lib/types";

export interface BacktestRunSettings {
  /** Inclusive ISO date (YYYY-MM-DD), or null for no lower bound */
  dateFrom: string | null;
  /** Inclusive ISO date (YYYY-MM-DD), or null for no upper bound */
  dateTo: string | null;
}

export const DEFAULT_BACKTEST_RUN_SETTINGS: BacktestRunSettings = {
  dateFrom: null,
  dateTo: null,
};

export function filterBarsForBacktest(
  bars: OhlcvBar[],
  settings: BacktestRunSettings,
): OhlcvBar[] {
  if (!settings.dateFrom && !settings.dateTo) return bars;
  return bars.filter((bar) => {
    if (settings.dateFrom && bar.date < settings.dateFrom) return false;
    if (settings.dateTo && bar.date > settings.dateTo) return false;
    return true;
  });
}

export function formatBacktestRunSettingsSummary(
  settings: BacktestRunSettings,
): string {
  if (!settings.dateFrom && !settings.dateTo) {
    return "All stored history";
  }
  if (settings.dateFrom && settings.dateTo) {
    return `${settings.dateFrom} – ${settings.dateTo}`;
  }
  if (settings.dateFrom) {
    return `From ${settings.dateFrom}`;
  }
  return `Through ${settings.dateTo}`;
}
