const STORAGE_KEY = "upstox-access-tokens-v1";

export function loadSessionTokens(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 4);
  } catch {
    return [];
  }
}

export function saveSessionTokens(tokens: string[]): void {
  if (typeof window === "undefined") return;
  const cleaned = tokens.map((t) => t.trim()).filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const t of cleaned) {
    if (seen.has(t)) continue;
    seen.add(t);
    unique.push(t);
    if (unique.length >= 4) break;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
}

export function clearSessionTokens(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function activeTokenCount(): number {
  return loadSessionTokens().length;
}
