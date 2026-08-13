"use client";

import type { ExploreTimeframeMode } from "@/lib/patterns/mtf-combine";
import { formatTimeframeModeLabel } from "@/lib/patterns/mtf-combine";

const MODES: ExploreTimeframeMode[] = ["1D", "1W", "1M", "mtf"];

interface ExploreTimeframeTabsProps {
  mode: ExploreTimeframeMode;
  onChange: (mode: ExploreTimeframeMode) => void;
}

export function ExploreTimeframeTabs({
  mode,
  onChange,
}: ExploreTimeframeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Timeframe"
      className="flex flex-wrap gap-1 rounded-xl border border-border bg-bg p-1"
    >
      {MODES.map((item) => {
        const active = mode === item;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {formatTimeframeModeLabel(item)}
          </button>
        );
      })}
    </div>
  );
}
