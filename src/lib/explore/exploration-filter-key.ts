import type { ExplorationFilter } from "@/lib/explore/exploration-models";
import { normalizeBuilderState } from "@/lib/explore/exploration-to-pattern";

function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function presetFilterKey(presetId: string): string {
  return `preset:${presetId}`;
}

export function savedFilterKey(savedId: string): string {
  return `saved:${savedId}`;
}

export function explorationFilterKey(filter: ExplorationFilter): string {
  if (filter.source === "preset" && filter.presetId) {
    return presetFilterKey(filter.presetId);
  }
  if (filter.savedId) {
    return savedFilterKey(filter.savedId);
  }
  if (filter.builder) {
    const normalized = normalizeBuilderState(filter.builder);
    return `builder:${stableHash(JSON.stringify(normalized))}`;
  }
  return `name:${filter.name.trim().toLowerCase()}`;
}
