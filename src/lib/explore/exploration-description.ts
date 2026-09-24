import type { ExplorationFilter } from "@/lib/explore/exploration-models";
import { getExplorationPreset } from "@/lib/explore/exploration-presets";

export const EXPLORATION_DESCRIPTION_MAX = 100;

export function normalizeExplorationDescription(value: string): string {
  return value.trim().slice(0, EXPLORATION_DESCRIPTION_MAX);
}

export function defaultPresetDescription(presetId: string): string {
  const preset = getExplorationPreset(presetId);
  return preset?.description?.trim() ?? "";
}

export function resolveExplorationDescription(filter: ExplorationFilter): string {
  const edited = filter.description?.trim();
  if (edited) return edited;

  if (filter.source === "preset" && filter.presetId) {
    const preset = getExplorationPreset(filter.presetId);
    if (preset?.description?.trim()) return preset.description.trim();
  }

  return filter.name;
}

export function snapshotDescriptionText(description: string): string {
  const trimmed = description.trim();
  if (trimmed.length <= EXPLORATION_DESCRIPTION_MAX) return trimmed;
  return `${trimmed.slice(0, EXPLORATION_DESCRIPTION_MAX - 1)}…`;
}
