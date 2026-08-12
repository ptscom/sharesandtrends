"use client";

import type { TradeSettings } from "@/lib/engine/trade-settings";

interface TradeSettingsPanelProps {
  settings: TradeSettings;
  onChange: (settings: TradeSettings) => void;
}

export function TradeSettingsPanel({
  settings,
  onChange,
}: TradeSettingsPanelProps) {
  const patch = (partial: Partial<TradeSettings>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <section className="ui-panel p-6">
      <p className="ui-eyebrow">Step 3</p>
      <h2 className="ui-section-title mt-2">Trade settings</h2>
      <p className="ui-helper mt-1">
        Optional exits that apply to every backtest run. When override is on,
        strategy exit signals are ignored and only these rules close trades.
      </p>

      <label className="mt-6 flex items-start gap-3 rounded-xl border border-border-subtle bg-input/40 p-4">
        <input
          type="checkbox"
          checked={settings.overrideSignalExit}
          onChange={(e) => patch({ overrideSignalExit: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-border"
        />
        <span>
          <span className="block text-sm font-medium text-ink">
            Override strategy exit signals
          </span>
          <span className="mt-0.5 block text-xs text-body">
            When enabled, trades exit only via the rules below (or at end of
            data), not via the strategy&apos;s opposite-signal exit.
          </span>
        </span>
      </label>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <TradeRuleField
          label="Max hold (days)"
          description="Exit after this many bars in the trade."
          enabled={settings.maxHoldDaysEnabled}
          onEnabledChange={(maxHoldDaysEnabled) =>
            patch({ maxHoldDaysEnabled })
          }
          value={settings.maxHoldDays}
          onValueChange={(maxHoldDays) => patch({ maxHoldDays })}
          min={1}
          max={500}
          step={1}
          suffix="days"
        />
        <TradeRuleField
          label="Take profit"
          description="Exit when unrealized gain reaches this level."
          enabled={settings.takeProfitEnabled}
          onEnabledChange={(takeProfitEnabled) => patch({ takeProfitEnabled })}
          value={settings.takeProfitPct}
          onValueChange={(takeProfitPct) => patch({ takeProfitPct })}
          min={0.1}
          max={500}
          step={0.1}
          suffix="%"
        />
        <TradeRuleField
          label="Stop loss"
          description="Exit when unrealized loss reaches this level."
          enabled={settings.stopLossEnabled}
          onEnabledChange={(stopLossEnabled) => patch({ stopLossEnabled })}
          value={settings.stopLossPct}
          onValueChange={(stopLossPct) => patch({ stopLossPct })}
          min={0.1}
          max={100}
          step={0.1}
          suffix="%"
        />
      </div>
    </section>
  );
}

function TradeRuleField({
  label,
  description,
  enabled,
  onEnabledChange,
  value,
  onValueChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <span className="text-sm font-medium text-ink">{label}</span>
      </label>
      <p className="ui-helper mt-2">{description}</p>
      <label className="mt-3 block">
        <span className="ui-field-label">Value</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            disabled={!enabled}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onValueChange(Number(e.target.value))}
            className="ui-input disabled:opacity-50"
          />
          <span className="text-sm text-muted">{suffix}</span>
        </div>
      </label>
    </div>
  );
}
