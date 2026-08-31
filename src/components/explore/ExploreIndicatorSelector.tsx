"use client";

import type { MouseEvent } from "react";
import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";
import {
  formatIndicatorRule,
  type ExploreIndicatorItem,
} from "@/lib/explore/indicator-models";

interface ExploreIndicatorSelectorProps {
  items: ExploreIndicatorItem[];
  combos: ExploreIndicatorItem[];
  onToggle: (id: string, enabled: boolean) => void;
  onOpenSettings: (id: string, e: MouseEvent) => void;
  onOpenComboBuilder: () => void;
  onRemoveCombo: (id: string) => void;
}

export function ExploreIndicatorSelector({
  items,
  combos,
  onToggle,
  onOpenSettings,
  onOpenComboBuilder,
  onRemoveCombo,
}: ExploreIndicatorSelectorProps) {
  const enabledCount =
    items.filter((i) => i.enabled).length + combos.filter((c) => c.enabled).length;

  return (
    <section className="ui-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Step 2</p>
          <h2 className="ui-section-title mt-2">Select indicators</h2>
          <p className="ui-helper mt-1">
            Check one or more indicators to scan. Each selected indicator produces
            its own result set. Strategy scan is disabled while indicators are
            selected.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenComboBuilder}
          className="ui-btn-secondary flex items-center gap-2"
          title="Build indicator combo"
        >
          <ComboIcon />
          Build combo
        </button>
      </div>

      {combos.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-ink">Custom combos</p>
          <div className="mt-3 space-y-2">
            {combos.map((combo) => (
              <IndicatorRow
                key={combo.id}
                item={combo}
                subtitle={`${combo.comboLogic?.toUpperCase()} combo · ${combo.parts?.length ?? 0} parts`}
                onToggle={onToggle}
                onOpenSettings={onOpenSettings}
                onRemove={() => onRemoveCombo(combo.id)}
                hideSettings
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="text-sm font-medium text-ink">
          Indicators {enabledCount > 0 ? `(${enabledCount} selected)` : ""}
        </p>
        <div className="mt-3 divide-y divide-border rounded-xl border border-border">
          {items.map((item) => (
            <IndicatorRow
              key={item.id}
              item={item}
              subtitle={formatIndicatorRule(item.rule)}
              onToggle={onToggle}
              onOpenSettings={onOpenSettings}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function IndicatorRow({
  item,
  subtitle,
  onToggle,
  onOpenSettings,
  onRemove,
  hideSettings = false,
}: {
  item: ExploreIndicatorItem;
  subtitle: string;
  onToggle: (id: string, enabled: boolean) => void;
  onOpenSettings: (id: string, e: MouseEvent) => void;
  onRemove?: () => void;
  hideSettings?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <input
        type="checkbox"
        checked={item.enabled}
        onChange={(e) => onToggle(item.id, e.target.checked)}
        className="h-4 w-4 shrink-0 rounded border-border"
        aria-label={`Select ${item.name}`}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink leading-snug">{item.name}</p>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted hover:text-ink"
        >
          Remove
        </button>
      )}
      {!hideSettings && (
        <button
          type="button"
          onClick={(e) => onOpenSettings(item.id, e)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-body transition hover:border-brand hover:text-brand-text"
          title={`Configure ${item.name}`}
          aria-label={`Configure ${item.name}`}
        >
          <SettingsIcon />
        </button>
      )}
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.286-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ComboIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM4 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM13 10a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM7 17a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
    </svg>
  );
}

export function formatIndicatorTimeframeLabel(mode: ExploreTimeframeMode): string {
  switch (mode) {
    case "1D":
      return "Daily";
    case "1W":
      return "Weekly";
    case "1M":
      return "Monthly";
    case "mtf":
      return "Multi-timeframe";
  }
}
