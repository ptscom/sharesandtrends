const STORAGE_KEY = "exploration-favorites";

export function presetFavoriteKey(presetId: string): string {
  return `preset:${presetId}`;
}

export function savedFavoriteKey(savedId: string): string {
  return `saved:${savedId}`;
}

export function loadExplorationFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveExplorationFavorites(keys: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}
