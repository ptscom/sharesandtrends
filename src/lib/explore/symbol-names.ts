import { fetchSymbolNamesBatch } from "@/lib/data/fetch-symbol-meta";
import { getSymbolNames, setSymbolNames } from "@/lib/storage/prices";

export function formatSymbolSubtitle(symbol: string): string {
  const base = symbol.replace(/\.(NS|BO|NSE|BSE)$/i, "").replace(/_/g, " ");
  if (!base) return symbol;

  const words = base.split(/(?=[A-Z])/).filter(Boolean);
  if (words.length > 1) {
    return words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
  }

  const lower = base.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export async function resolveSymbolDisplayNames(
  symbols: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  const fromDb = await getSymbolNames(unique);
  const missing = unique.filter((symbol) => !fromDb[symbol]);

  let fetched: Record<string, string> = {};
  if (missing.length > 0) {
    fetched = await fetchSymbolNamesBatch(missing);
    if (Object.keys(fetched).length > 0) {
      await setSymbolNames(fetched);
    }
  }

  const resolved: Record<string, string> = {};
  for (const symbol of unique) {
    resolved[symbol] =
      fromDb[symbol] ?? fetched[symbol] ?? formatSymbolSubtitle(symbol);
  }
  return resolved;
}
