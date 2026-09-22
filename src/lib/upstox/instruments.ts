import { gunzipSync } from "node:zlib";
import { normalizeSymbol } from "@/lib/upstox/parse";
import type { ResolvedInstrument } from "@/lib/upstox/types";
import { upstoxFetch } from "@/lib/upstox/retry-fetch";

const COMPLETE_URL =
  "https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz";

const SEARCH_URL = "https://api.upstox.com/v2/market/instruments/search";

type BodRow = {
  segment?: string;
  instrument_type?: string;
  trading_symbol?: string;
  instrument_key?: string;
  isin?: string;
  name?: string;
};

type InstrumentCacheState = {
  cacheDate: string;
  map: Map<string, ResolvedInstrument>;
};

let serverCache: InstrumentCacheState | null = null;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isNseEquity(row: BodRow): boolean {
  return (
    row.segment === "NSE_EQ" &&
    row.instrument_type === "EQ" &&
    Boolean(row.trading_symbol) &&
    Boolean(row.instrument_key)
  );
}

export function buildInstrumentMap(rows: BodRow[]): Map<string, ResolvedInstrument> {
  const map = new Map<string, ResolvedInstrument>();
  for (const row of rows) {
    if (!isNseEquity(row)) continue;
    const symbol = normalizeSymbol(row.trading_symbol!);
    if (map.has(symbol)) continue;
    map.set(symbol, {
      symbol,
      instrumentKey: row.instrument_key!,
      isin: row.isin,
      name: row.name,
    });
  }
  return map;
}

export async function loadInstrumentMap(_token?: string): Promise<Map<string, ResolvedInstrument>> {
  const today = todayKey();
  if (serverCache && serverCache.cacheDate === today) {
    return serverCache.map;
  }

  const res = await fetch(COMPLETE_URL);
  if (!res.ok) {
    throw new Error(`Failed to download Upstox instrument file (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const jsonText = gunzipSync(buffer).toString("utf8");
  const rows = JSON.parse(jsonText) as BodRow[];
  const map = buildInstrumentMap(rows);
  serverCache = { cacheDate: today, map };
  return map;
}

export function setInstrumentMapForTests(
  map: Map<string, ResolvedInstrument>,
  cacheDate = todayKey(),
): void {
  serverCache = { cacheDate, map };
}

export function clearInstrumentCache(): void {
  serverCache = null;
}

async function searchInstrument(
  symbol: string,
  token: string,
): Promise<ResolvedInstrument | null> {
  const params = new URLSearchParams();
  params.set("query", symbol);
  const url = `${SEARCH_URL}?${params.toString()}`;
  const { response } = await upstoxFetch(url, { method: "GET", token });
  if (!response.ok) return null;
  const data = (await response.json()) as { data?: BodRow[] };
  const rows = data.data ?? [];
  const exact = rows.find(
    (row) =>
      isNseEquity(row) && normalizeSymbol(row.trading_symbol!) === symbol,
  );
  if (!exact?.instrument_key) return null;
  return {
    symbol,
    instrumentKey: exact.instrument_key,
    isin: exact.isin,
    name: exact.name,
  };
}

export async function resolveInstruments(
  symbols: string[],
  token: string,
  options?: { allowSearchFallback?: boolean },
): Promise<{
  resolved: Map<string, ResolvedInstrument>;
  errors: Array<{ symbol: string; message: string }>;
}> {
  const normalized = symbols.map(normalizeSymbol);
  const map = await loadInstrumentMap(token);
  const resolved = new Map<string, ResolvedInstrument>();
  const errors: Array<{ symbol: string; message: string }> = [];

  for (const symbol of normalized) {
    const hit = map.get(symbol);
    if (hit) {
      resolved.set(symbol, hit);
      continue;
    }
    if (options?.allowSearchFallback && normalized.length <= 5) {
      const searched = await searchInstrument(symbol, token);
      if (searched) {
        resolved.set(symbol, searched);
        continue;
      }
    }
    errors.push({ symbol, message: "Instrument not found for NSE equity symbol." });
  }

  return { resolved, errors };
}
