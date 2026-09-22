"use client";

import { useCallback, useEffect, useState } from "react";
import {
  activeTokenCount,
  clearSessionTokens,
  loadSessionTokens,
  saveSessionTokens,
} from "@/lib/upstox/client-tokens";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (count: number) => void;
};

export function UpstoxApiKeysDialog({ open, onClose, onSaved }: Props) {
  const [fields, setFields] = useState<string[]>(["", "", "", ""]);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    const existing = loadSessionTokens();
    setSavedCount(existing.length);
    const next = ["", "", "", ""];
    existing.forEach((token, index) => {
      next[index] = token;
    });
    setFields(next);
  }, [open]);

  const updateField = (index: number, value: string) => {
    setFields((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const addField = () => {
    setFields((prev) => (prev.length >= 4 ? prev : [...prev, ""]));
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = useCallback(() => {
    saveSessionTokens(fields);
    const count = activeTokenCount();
    setSavedCount(count);
    setFields((prev) => prev.map((_, i) => (i < count ? "••••••••" : "")));
    onSaved?.(count);
  }, [fields, onSaved]);

  const handleClear = useCallback(() => {
    clearSessionTokens();
    setFields(["", "", "", ""]);
    setSavedCount(0);
    onSaved?.(0);
  }, [onSaved]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-labelledby="upstox-keys-title"
    >
      <div className="ui-panel max-h-[90vh] w-full max-w-lg overflow-auto p-6 shadow-lg">
        <h2 id="upstox-keys-title" className="ui-section-title">
          Upstox API keys
        </h2>
        <p className="ui-helper mt-2">
          Add up to four access tokens. Tokens from different Upstox accounts
          provide independent API quotas. Multiple tokens on the same account
          still share one quota. Keys are kept in session storage only for this
          browser tab session — never in IndexedDB or server logs.
        </p>
        {savedCount > 0 && (
          <p className="mt-3 text-sm text-success">
            {savedCount} active token{savedCount === 1 ? "" : "s"} saved for
            this session.
          </p>
        )}
        <div className="mt-4 space-y-3">
          {fields.map((value, index) => (
            <div key={index} className="flex gap-2">
              <label className="sr-only" htmlFor={`upstox-token-${index}`}>
                Token {index + 1}
              </label>
              <input
                id={`upstox-token-${index}`}
                type="password"
                autoComplete="off"
                placeholder={`Access token ${index + 1}`}
                value={value.startsWith("••") ? "" : value}
                onChange={(e) => updateField(index, e.target.value)}
                className="ui-input flex-1 font-mono text-sm"
              />
              {fields.length > 1 && (
                <button
                  type="button"
                  className="ui-btn-secondary shrink-0"
                  onClick={() => removeField(index)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {fields.length < 4 && (
          <button type="button" className="ui-btn-link mt-3" onClick={addField}>
            Add another token
          </button>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="ui-btn-primary" onClick={handleSave}>
            Save keys
          </button>
          <button type="button" className="ui-btn-secondary" onClick={handleClear}>
            Clear saved keys
          </button>
          <button type="button" className="ui-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
