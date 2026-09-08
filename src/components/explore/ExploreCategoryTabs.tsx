"use client";

import {
  EXPLORATION_CATEGORY_TABS,
  type ExplorationCategoryId,
} from "@/lib/explore/exploration-presets";

interface ExploreCategoryTabsProps {
  category: ExplorationCategoryId;
  onChange: (category: ExplorationCategoryId) => void;
}

export function ExploreCategoryTabs({
  category,
  onChange,
}: ExploreCategoryTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Exploration category"
      className="flex flex-wrap gap-1 rounded-xl border border-border-subtle bg-bg/70 p-1"
    >
      {EXPLORATION_CATEGORY_TABS.map((item) => {
        const active = category === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
