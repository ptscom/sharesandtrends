import {
  defaultParamsForPreset,
  type ExplorationFilter,
  type IndicatorScanRun,
} from "@/lib/explore/exploration-models";
import { getExplorationPreset } from "@/lib/explore/exploration-presets";
import {
  explorationFilterToPattern,
  normalizeBuilderState,
} from "@/lib/explore/exploration-to-pattern";
import { getExploration } from "@/lib/storage/explorations";
import type { PatternDefinition } from "@/lib/types";

export async function resolveExplorationFilterFromScan(
  scan: IndicatorScanRun,
): Promise<ExplorationFilter | null> {
  if (scan.filter) {
    return scan.filter;
  }

  const { filterKey } = scan;

  if (filterKey.startsWith("preset:")) {
    const presetId = filterKey.slice("preset:".length);
    const preset = getExplorationPreset(presetId);
    if (!preset) return null;
    return {
      source: "preset",
      name: scan.filterName,
      timeframeMode: scan.timeframeMode,
      presetId,
      params: defaultParamsForPreset(preset),
    };
  }

  if (filterKey.startsWith("saved:")) {
    const savedId = filterKey.slice("saved:".length);
    const saved = await getExploration(savedId);
    if (!saved) return null;
    return {
      source: "builder",
      name: saved.name,
      timeframeMode: scan.timeframeMode,
      builder: saved.builder,
      savedId,
    };
  }

  if (filterKey.startsWith("builder:")) {
    return {
      source: "builder",
      name: scan.filterName,
      timeframeMode: scan.timeframeMode,
      builder: { rows: [] },
    };
  }

  return null;
}

export async function resolveExplorationPatternFromScan(
  scan: IndicatorScanRun,
): Promise<PatternDefinition | null> {
  const filter = await resolveExplorationFilterFromScan(scan);
  if (!filter) return null;

  if (filter.source === "builder" && filter.builder) {
    const normalized = normalizeBuilderState(filter.builder);
    if (normalized.rows.length === 0 && !filter.presetId) {
      return null;
    }
  }

  try {
    return explorationFilterToPattern(filter);
  } catch {
    return null;
  }
}
