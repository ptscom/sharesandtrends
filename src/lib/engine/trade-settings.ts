export interface TradeSettings {
  overrideSignalExit: boolean;
  maxHoldDaysEnabled: boolean;
  maxHoldDays: number;
  takeProfitEnabled: boolean;
  takeProfitPct: number;
  stopLossEnabled: boolean;
  stopLossPct: number;
}

export const DEFAULT_TRADE_SETTINGS: TradeSettings = {
  overrideSignalExit: true,
  maxHoldDaysEnabled: false,
  maxHoldDays: 10,
  takeProfitEnabled: false,
  takeProfitPct: 10,
  stopLossEnabled: false,
  stopLossPct: 5,
};

export function hasActiveTradeRules(settings: TradeSettings): boolean {
  return (
    settings.maxHoldDaysEnabled ||
    settings.takeProfitEnabled ||
    settings.stopLossEnabled
  );
}

export function formatTradeSettingsSummary(settings: TradeSettings): string {
  if (!hasActiveTradeRules(settings)) {
    return "Strategy exit signals";
  }

  const parts: string[] = [];
  if (settings.overrideSignalExit) parts.push("Override signals");
  if (settings.maxHoldDaysEnabled) {
    parts.push(`${settings.maxHoldDays} day max`);
  }
  if (settings.takeProfitEnabled) {
    parts.push(`+${settings.takeProfitPct}% target`);
  }
  if (settings.stopLossEnabled) {
    parts.push(`-${settings.stopLossPct}% stop`);
  }
  return parts.join(" · ");
}
