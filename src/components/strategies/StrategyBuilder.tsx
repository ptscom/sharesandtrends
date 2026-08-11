"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { INDICATOR_REGISTRY } from "@/lib/engine/registry";
import { summarizeIndicatorParams } from "@/lib/patterns/optimization";
import {
  getEffectivePreset,
  isBuiltInPresetId,
  listModifiedPresetIds,
  revertPresetToDefault,
} from "@/lib/patterns/preset-store";
import {
  blankPattern,
  buildExpression,
  defaultIndicator,
  describeRule,
  listSeriesRefs,
  parseSimpleRule,
  type RuleOp,
  type SimpleRule,
} from "@/lib/patterns/rule-builder";
import { EMA_CROSS_PATTERN } from "@/lib/patterns/defaults";
import { STRATEGY_PRESETS } from "@/lib/patterns/strategies";
import {
  deletePattern,
  getPattern,
  listPatterns,
  savePattern,
} from "@/lib/storage/patterns";
import type { IndicatorDef, PatternDefinition } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { OptimizationPanel } from "@/components/explore/OptimizationPanel";

const RULE_OPS: { value: RuleOp; label: string }[] = [
  { value: "crosses_above", label: "Crosses above" },
  { value: "crosses_below", label: "Crosses below" },
  { value: "gt", label: "Greater than" },
  { value: "lt", label: "Less than" },
  { value: "gte", label: "Greater or equal" },
  { value: "lte", label: "Less or equal" },
];

export function StrategyBuilder() {
  const router = useRouter();
  const [pattern, setPattern] = useState<PatternDefinition>(EMA_CROSS_PATTERN);
  const [selectedSource, setSelectedSource] = useState("ema-cross");
  const [editingId, setEditingId] = useState<string | null>("ema-cross");
  const [isModified, setIsModified] = useState(false);
  const [modifiedPresetIds, setModifiedPresetIds] = useState<string[]>([]);
  const [savedPatterns, setSavedPatterns] = useState<PatternDefinition[]>([]);
  const [useFilter, setUseFilter] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const entryRule = useMemo(
    () => parseSimpleRule(pattern.entry) ?? defaultRule("crosses_above"),
    [pattern.entry],
  );
  const exitRule = useMemo(
    () => parseSimpleRule(pattern.exit) ?? defaultRule("crosses_below"),
    [pattern.exit],
  );
  const filterRule = useMemo(
    () => parseSimpleRule(pattern.filters),
    [pattern.filters],
  );

  const seriesRefs = useMemo(() => listSeriesRefs(pattern), [pattern]);

  const refreshSaved = useCallback(async () => {
    const [list, modified] = await Promise.all([
      listPatterns(),
      listModifiedPresetIds(),
    ]);
    const presetIds = new Set(STRATEGY_PRESETS.map((s) => s.id));
    setSavedPatterns(list.filter((p) => p.id && !presetIds.has(p.id)));
    setModifiedPresetIds(modified);
  }, []);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    void getEffectivePreset("ema-cross").then(({ pattern, isModified }) => {
      setPattern(structuredClone(pattern));
      setIsModified(isModified);
    });
  }, []);

  useEffect(() => {
    setUseFilter(Boolean(pattern.filters));
  }, [pattern.filters]);

  const isPresetId = useCallback(
    (id: string) => isBuiltInPresetId(id),
    [],
  );

  const loadPreset = async (id: string) => {
    if (id === "__blank") {
      loadBlank();
      return;
    }

    if (isBuiltInPresetId(id)) {
      const { pattern, isModified: modified } = await getEffectivePreset(id);
      setSelectedSource(id);
      setEditingId(id);
      setIsModified(modified);
      setPattern(structuredClone(pattern));
      return;
    }

    const stored =
      savedPatterns.find((p) => p.id === id) ?? (await getPattern(id));
    if (stored) {
      setSelectedSource(id);
      setEditingId(stored.id!);
      setIsModified(false);
      setPattern(structuredClone(stored));
    }
  };

  const loadBlank = () => {
    setSelectedSource("__blank");
    setEditingId(null);
    setIsModified(false);
    setPattern(blankPattern());
  };

  const updateIndicators = (indicators: IndicatorDef[]) => {
    setPattern((p) => ({ ...p, indicators }));
  };

  const updateRule = (
    section: "entry" | "exit" | "filters",
    rule: SimpleRule,
  ) => {
    setPattern((p) => ({
      ...p,
      [section]: buildExpression(rule),
    }));
  };

  const handleSave = async (): Promise<PatternDefinition> => {
    setSaving(true);
    setError(null);
    try {
      const id =
        editingId ??
        (isPresetId(selectedSource) ? selectedSource : uuidv4());
      const savingPreset = isPresetId(id);
      const isUpdate = savingPreset ? isModified || (await getPattern(id)) != null : editingId != null;

      const saved = await savePattern({
        ...pattern,
        id,
        name: pattern.name.trim() || "Untitled strategy",
      });
      setPattern(saved);
      setEditingId(saved.id!);
      setSelectedSource(saved.id!);
      if (savingPreset) setIsModified(true);
      await refreshSaved();
      setStatus(
        savingPreset
          ? `Saved your changes to "${saved.name}".`
          : isUpdate
            ? `Updated "${saved.name}".`
            : `Saved "${saved.name}" as a new custom strategy.`,
      );
      setTimeout(() => setStatus(null), 4000);
      return saved;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save strategy";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsNew = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await savePattern({
        ...pattern,
        id: uuidv4(),
        name: `${pattern.name.trim() || "Strategy"} (copy)`,
      });
      setPattern(saved);
      setEditingId(saved.id!);
      setSelectedSource(saved.id!);
      setIsModified(false);
      await refreshSaved();
      setStatus(`Saved "${saved.name}" as a new custom strategy.`);
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save strategy";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async () => {
    const presetId = editingId ?? (isPresetId(selectedSource) ? selectedSource : null);
    if (!presetId || !isPresetId(presetId)) return;

    setSaving(true);
    setError(null);
    try {
      await revertPresetToDefault(presetId);
      const { pattern: defaults } = await getEffectivePreset(presetId);
      setPattern(structuredClone(defaults));
      setEditingId(presetId);
      setSelectedSource(presetId);
      setIsModified(false);
      await refreshSaved();
      setStatus(`Reverted "${defaults.name}" to factory defaults.`);
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to revert strategy";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      if (!isPresetId(editingId)) {
        await deletePattern(editingId);
        await refreshSaved();
      }
      setEditingId(null);
      setPattern(EMA_CROSS_PATTERN);
      setSelectedSource("ema-cross");
      setStatus("Custom strategy deleted.");
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete strategy";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const isCustomSaved =
    editingId != null &&
    !isPresetId(editingId) &&
    savedPatterns.some((p) => p.id === editingId);

  const canRevertPreset =
    isPresetId(editingId ?? selectedSource) && isModified;

  return (
    <div className="space-y-6">
      <section className="ui-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="ui-eyebrow">Strategy builder</p>
            <h1 className="ui-page-title mt-2">Create & edit strategies</h1>
            <p className="ui-helper mt-2">
              Built-in presets can be customized and saved in your browser.
              Revert to defaults restores the original factory settings.
            </p>
          </div>
          <Link href="/explore" className="ui-btn-secondary">
            ← Back to Explore
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,48fr)_minmax(0,52fr)]">
        <div className="space-y-6">
          <div className="ui-panel p-6">
            <p className="ui-eyebrow">Start from</p>
            <h2 className="ui-section-title mt-2">Strategy template</h2>
            <select
              value={selectedSource}
              onChange={(e) => {
                void loadPreset(e.target.value);
              }}
              className="ui-input mt-3"
            >
              <optgroup label="Built-in presets">
                {STRATEGY_PRESETS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.pattern.name}
                    {modifiedPresetIds.includes(s.id) ? " (customized)" : ""}
                  </option>
                ))}
              </optgroup>
              {savedPatterns.length > 0 && (
                <optgroup label="Your custom strategies">
                  {savedPatterns.map((p) => (
                    <option key={p.id} value={p.id!}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value="__blank">Blank EMA crossover template</option>
            </select>
            <p className="ui-helper mt-2">
              {isPresetId(editingId ?? selectedSource)
                ? isModified
                  ? "This preset has customized settings saved in your browser."
                  : "Using factory defaults — save to keep any changes you make."
                : editingId
                  ? "Editing a saved custom strategy — Save updates this version."
                  : "Unsaved draft — Save creates a new custom strategy."}
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="ui-field-label">Name</span>
                <input
                  value={pattern.name}
                  onChange={(e) =>
                    setPattern((p) => ({ ...p, name: e.target.value }))
                  }
                  className="ui-input mt-2"
                />
              </label>
              <label className="block">
                <span className="ui-field-label">Description</span>
                <textarea
                  value={pattern.description ?? ""}
                  onChange={(e) =>
                    setPattern((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={2}
                  className="ui-input mt-2"
                />
              </label>
            </div>
          </div>

          <div className="ui-panel p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="ui-eyebrow">Indicators</p>
                <h2 className="ui-section-title mt-1">Indicator parameters</h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateIndicators([
                    ...pattern.indicators,
                    defaultIndicator("ema", pattern.indicators.length),
                  ])
                }
                className="ui-btn-link"
              >
                + Add indicator
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {pattern.indicators.map((ind, index) => (
                <div key={`${ind.alias}-${index}`} className="ui-nested-card">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="ui-field-label">Alias</span>
                      <input
                        value={ind.alias}
                        onChange={(e) => {
                          const indicators = pattern.indicators.map((row, i) =>
                            i === index
                              ? { ...row, alias: e.target.value }
                              : row,
                          );
                          updateIndicators(indicators);
                        }}
                        className="ui-input mt-1 font-mono"
                      />
                    </label>
                    <label>
                      <span className="ui-field-label">Type</span>
                      <select
                        value={ind.type}
                        onChange={(e) => {
                          const indicators = pattern.indicators.map((row, i) =>
                            i === index
                              ? defaultIndicator(e.target.value, index)
                              : row,
                          );
                          indicators[index]!.alias = ind.alias;
                          updateIndicators(indicators);
                        }}
                        className="ui-input mt-1"
                      >
                        {INDICATOR_REGISTRY.map((def) => (
                          <option key={def.id} value={def.id}>
                            {def.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {pattern.indicators.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        updateIndicators(
                          pattern.indicators.filter((_, i) => i !== index),
                        )
                      }
                      className="mt-3 text-xs text-danger underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="ui-helper mt-3">
              Params: {summarizeIndicatorParams(pattern.indicators)}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="ui-panel p-6">
            <p className="ui-eyebrow">Signal rules</p>
            <h2 className="ui-section-title mt-2">Entry & exit conditions</h2>
            <p className="ui-helper mt-1">
              Entry: {describeRule(pattern.entry)} · Exit:{" "}
              {pattern.exit ? describeRule(pattern.exit) : "—"}
            </p>

            <RuleEditor
              variant="entry"
              title="Entry"
              rule={entryRule}
              seriesRefs={seriesRefs}
              onChange={(rule) => updateRule("entry", rule)}
            />
            <RuleEditor
              variant="exit"
              title="Exit"
              rule={exitRule}
              seriesRefs={seriesRefs}
              onChange={(rule) => updateRule("exit", rule)}
            />

            <label className="mt-4 flex items-center gap-3 text-sm text-body">
              <input
                type="checkbox"
                checked={useFilter}
                onChange={(e) => {
                  setUseFilter(e.target.checked);
                  setPattern((p) => ({
                    ...p,
                    filters: e.target.checked
                      ? buildExpression(defaultRule("gt"))
                      : undefined,
                  }));
                }}
                className="h-4 w-4 rounded border-border"
              />
              Add filter condition
            </label>

            {useFilter && filterRule && (
              <RuleEditor
                variant="filter"
                title="Filter"
                rule={filterRule}
                seriesRefs={seriesRefs}
                onChange={(rule) => updateRule("filters", rule)}
              />
            )}
          </div>

          <div className="ui-panel p-6">
            <p className="ui-eyebrow">Optimization variables</p>
            <h2 className="ui-section-title mt-2">Tune parameters</h2>
            <p className="ui-helper mt-1">
              Tune parameters here — the same controls appear in Explore when
              you run a scan.
            </p>
            <div className="mt-4">
              <OptimizationPanel pattern={pattern} onChange={setPattern} />
            </div>
          </div>

          <div className="ui-panel p-6">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="ui-btn-primary disabled:opacity-50"
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Save strategy"}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAsNew()}
                disabled={saving}
                className="ui-btn-secondary disabled:opacity-50"
              >
                Save as new
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  void handleSave()
                    .then((saved) => {
                      router.push(
                        `/explore?patternId=${encodeURIComponent(saved.id!)}`,
                      );
                    })
                    .catch(() => {
                      // Error shown via setError in handleSave
                    });
                }}
                className="ui-btn-secondary disabled:opacity-50"
              >
                Save & scan in Explore
              </button>
              {canRevertPreset && (
                <button
                  type="button"
                  onClick={() => void handleRevert()}
                  disabled={saving}
                  className="ui-btn-secondary disabled:opacity-50"
                >
                  Revert to defaults
                </button>
              )}
              {isCustomSaved && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="rounded-full border border-danger/30 px-5 text-sm font-medium text-danger"
                >
                  Delete
                </button>
              )}
            </div>
            {status && (
              <p className="mt-4 rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-text">
                {status}
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function defaultRule(op: RuleOp): SimpleRule {
  return {
    op,
    leftRef: "close",
    rightKind: "value",
    rightValue: 0,
  };
}

function RuleEditor({
  variant,
  title,
  rule,
  seriesRefs,
  onChange,
}: {
  variant: "entry" | "exit" | "filter";
  title: string;
  rule: SimpleRule;
  seriesRefs: string[];
  onChange: (rule: SimpleRule) => void;
}) {
  const panelClass =
    variant === "entry"
      ? "ui-rule-entry"
      : variant === "exit"
        ? "ui-rule-exit"
        : "ui-nested-card";
  const labelClass =
    variant === "entry"
      ? "ui-rule-label-entry"
      : variant === "exit"
        ? "ui-rule-label-exit"
        : "ui-field-label";

  return (
    <div className={`mt-4 ${panelClass}`}>
      <p className={labelClass}>{title}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="ui-field-label">Condition</span>
          <select
            value={rule.op}
            onChange={(e) =>
              onChange({ ...rule, op: e.target.value as RuleOp })
            }
            className="ui-input mt-1"
          >
            {RULE_OPS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="ui-field-label">Left series</span>
          <select
            value={rule.leftRef}
            onChange={(e) => onChange({ ...rule, leftRef: e.target.value })}
            className="ui-input mt-1 font-mono"
          >
            {seriesRefs.map((ref) => (
              <option key={ref} value={ref}>
                {ref}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="ui-field-label">Compare to</span>
          <select
            value={rule.rightKind}
            onChange={(e) =>
              onChange({
                ...rule,
                rightKind: e.target.value as "ref" | "value",
              })
            }
            className="ui-input mt-1"
          >
            <option value="ref">Another series</option>
            <option value="value">Fixed number</option>
          </select>
        </label>
        {rule.rightKind === "ref" ? (
          <label>
            <span className="ui-field-label">Right series</span>
            <select
              value={rule.rightRef ?? seriesRefs[0]}
              onChange={(e) =>
                onChange({ ...rule, rightRef: e.target.value })
              }
              className="ui-input mt-1 font-mono"
            >
              {seriesRefs.map((ref) => (
                <option key={ref} value={ref}>
                  {ref}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span className="ui-field-label">Value</span>
            <input
              type="number"
              value={rule.rightValue ?? 0}
              onChange={(e) =>
                onChange({
                  ...rule,
                  rightValue: Number(e.target.value),
                })
              }
              className="ui-input mt-1"
            />
          </label>
        )}
      </div>
    </div>
  );
}
