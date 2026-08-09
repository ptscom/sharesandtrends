import type { PatternDefinition } from "@/lib/types";
import { getPattern, deletePattern, listPatterns } from "@/lib/storage/patterns";
import {
  STRATEGY_PRESETS,
  type StrategyPreset,
} from "@/lib/patterns/strategies";

export function isBuiltInPresetId(id: string): boolean {
  return STRATEGY_PRESETS.some((s) => s.id === id);
}

export function getBuiltInPreset(presetId: string): StrategyPreset | undefined {
  return STRATEGY_PRESETS.find((s) => s.id === presetId);
}

export function getDefaultPresetPattern(presetId: string): PatternDefinition {
  const preset = getBuiltInPreset(presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }
  return structuredClone(preset.pattern);
}

/** Load a built-in preset, applying any browser-stored overrides. */
export async function getEffectivePreset(presetId: string): Promise<{
  preset: StrategyPreset;
  pattern: PatternDefinition;
  isModified: boolean;
}> {
  const preset = getBuiltInPreset(presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }

  const override = await getPattern(presetId);
  if (override) {
    return {
      preset,
      pattern: structuredClone(override),
      isModified: true,
    };
  }

  return {
    preset,
    pattern: structuredClone(preset.pattern),
    isModified: false,
  };
}

export async function listModifiedPresetIds(): Promise<string[]> {
  const presetIds = new Set(STRATEGY_PRESETS.map((s) => s.id));
  const stored = await listPatterns();
  return stored
    .filter((p) => p.id && presetIds.has(p.id))
    .map((p) => p.id!);
}

export async function revertPresetToDefault(presetId: string): Promise<void> {
  if (!isBuiltInPresetId(presetId)) {
    throw new Error(`Cannot revert non-preset id: ${presetId}`);
  }
  await deletePattern(presetId);
}
