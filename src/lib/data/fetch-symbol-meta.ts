export interface SymbolNameResult {
  symbol: string;
  name: string | null;
  error?: string;
}

const NAME_FETCH_BATCH = 6;
const NAME_FETCH_DELAY_MS = 80;

export async function fetchSymbolName(symbol: string): Promise<SymbolNameResult> {
  const upper = symbol.trim().toUpperCase();
  try {
    const res = await fetch(`/api/symbols/${encodeURIComponent(upper)}`);
    const data = (await res.json()) as { name?: string; error?: string };
    if (!res.ok) {
      return {
        symbol: upper,
        name: null,
        error: data.error ?? "Failed to fetch company name",
      };
    }
    return { symbol: upper, name: data.name?.trim() || null };
  } catch (error) {
    return {
      symbol: upper,
      name: null,
      error: error instanceof Error ? error.message : "Failed to fetch company name",
    };
  }
}

export async function fetchSymbolNamesBatch(
  symbols: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, string>> {
  const unique = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()))];
  const names: Record<string, string> = {};
  let done = 0;

  for (let i = 0; i < unique.length; i += NAME_FETCH_BATCH) {
    const batch = unique.slice(i, i + NAME_FETCH_BATCH);
    const results = await Promise.all(batch.map((symbol) => fetchSymbolName(symbol)));
    for (const result of results) {
      if (result.name) names[result.symbol] = result.name;
    }
    done = Math.min(i + batch.length, unique.length);
    onProgress?.(done, unique.length);
    if (i + NAME_FETCH_BATCH < unique.length) {
      await new Promise((resolve) => setTimeout(resolve, NAME_FETCH_DELAY_MS));
    }
  }

  return names;
}
