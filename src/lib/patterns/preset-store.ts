import type { PatternDefinition, ScanRun } from "@/lib/types";
import { deletePattern, getPattern, listPatterns, getScanRun } from "@/lib/storage/patterns";
import { EMA_CROSS_PATTERN } from "@/lib/patterns/defaults";
import { isMtfCombinedPattern } from "@/lib/patterns/mtf-combine";
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
    if (isMtfCombinedPattern(override)) {
      await deletePattern(presetId);
      return {
        preset,
        pattern: structuredClone(preset.pattern),
        isModified: false,
      };
    }
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

  for (const p of stored) {
    if (p.id && presetIds.has(p.id) && isMtfCombinedPattern(p)) {
      await deletePattern(p.id);
    }
  }

  const fresh = await listPatterns();
  return fresh
    .filter((p) => p.id && presetIds.has(p.id))
    .map((p) => p.id!);
}

export async function revertPresetToDefault(presetId: string): Promise<void> {
  if (!isBuiltInPresetId(presetId)) {
    throw new Error(`Cannot revert non-preset id: ${presetId}`);
  }
  await deletePattern(presetId);
}

async function resolvePatternById(
  patternId: string,
  patternName?: string,
): Promise<PatternDefinition | undefined> {
  if (isBuiltInPresetId(patternId)) {
    const { pattern } = await getEffectivePreset(patternId);
    return pattern;
  }

  const stored = await getPattern(patternId);
  if (stored) return stored;

  if (patternName) {
    const byName = STRATEGY_PRESETS.find((s) => s.pattern.name === patternName);
    if (byName) {
      const { pattern } = await getEffectivePreset(byName.id);
      return pattern;
    }
  }

  const preset = getBuiltInPreset(patternId);
  if (preset) {
    const { pattern } = await getEffectivePreset(patternId);
    return pattern;
  }

  return undefined;
}

/** Resolve which pattern to use on the symbol detail page. */
export async function resolveSymbolPattern(options: {
  scanId?: string;
  patternId?: string;
}): Promise<{ pattern: PatternDefinition; scan: ScanRun | null }> {
  const { scanId, patternId } = options;

  if (scanId) {
    const scan = await getScanRun(scanId);
    if (scan) {
      const pattern = await resolvePatternById(scan.patternId, scan.patternName);
      if (pattern) return { pattern, scan };
      return { pattern: EMA_CROSS_PATTERN, scan };
    }
  }

  if (patternId) {
    const pattern = await resolvePatternById(patternId);
    if (pattern) return { pattern, scan: null };
  }

  return { pattern: EMA_CROSS_PATTERN, scan: null };
}
