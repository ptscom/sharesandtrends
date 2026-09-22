import { assignSymbolsToLanes, laneForSymbol } from "@/lib/upstox/distribute";
import { splitHistoricalChunks } from "@/lib/upstox/date-ranges";
import { resolveInstruments } from "@/lib/upstox/instruments";
import { normalizeSymbol, parseHistoricalCandle, parseLiveOhlc } from "@/lib/upstox/parse";
import { upstoxFetch } from "@/lib/upstox/retry-fetch";
import { RATE_LIMITS } from "@/lib/upstox/rate-limiter";
import {
  activeLanes,
  createTokenLanes,
  type TokenLane,
} from "@/lib/upstox/tokens";
import type {
  CurrentPriceRow,
  HistoricalPriceRow,
  UpstoxDataError,
  UpstoxDataRequest,
  UpstoxDataResponse,
} from "@/lib/upstox/types";

const QUOTE_BATCH_SIZE = 500;
const OHLC_URL = "https://api.upstox.com/v3/market-quote/ohlc";

function authErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "Upstox access token is invalid, expired, or not authorized.";
  }
  return `Upstox request failed (${status}).`;
}

async function fetchCurrentBatch(
  lane: TokenLane,
  instruments: Array<{ symbol: string; instrumentKey: string }>,
  requestCount: { value: number },
): Promise<{ rows: CurrentPriceRow[]; errors: UpstoxDataError[] }> {
  const rows: CurrentPriceRow[] = [];
  const errors: UpstoxDataError[] = [];
  const keys = instruments.map((i) => i.instrumentKey).join(",");
  const params = new URLSearchParams();
  params.set("instrument_key", keys);
  params.set("interval", "1d");
  const url = `${OHLC_URL}?${params.toString()}`;

  const result = await lane.limiter.run(async () => {
    requestCount.value += 1;
    return upstoxFetch(url, { method: "GET", token: lane.token });
  });

  const { response } = result;
  if (response.status === 401 || response.status === 403) {
    lane.markInvalid(authErrorMessage(response.status));
    for (const inst of instruments) {
      errors.push({
        symbol: inst.symbol,
        stage: "quote",
        message: authErrorMessage(response.status),
        retryable: false,
      });
    }
    return { rows, errors };
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    for (const inst of instruments) {
      errors.push({
        symbol: inst.symbol,
        stage: "quote",
        message: `Quote request failed (${response.status}).`,
        retryable,
      });
    }
    return { rows, errors };
  }

  const payload = (await response.json()) as {
    data?: Record<string, { live_ohlc?: Record<string, unknown> }>;
  };
  const data = payload.data ?? {};
  for (const inst of instruments) {
    const entry = data[inst.instrumentKey];
    rows.push(parseLiveOhlc(inst.symbol, entry?.live_ohlc));
  }
  return { rows, errors };
}

export async function fetchCurrentDay(
  symbols: string[],
  tokens: string[],
): Promise<UpstoxDataResponse<CurrentPriceRow>> {
  const lanes = createTokenLanes(tokens);
  const requestCount = { value: 0 };
  const errors: UpstoxDataError[] = [];
  const rows: CurrentPriceRow[] = [];

  if (lanes.length === 0) {
    return {
      rows: [],
      errors: [
        {
          symbol: "*",
          stage: "validation",
          message: "No Upstox access token configured.",
          retryable: false,
        },
      ],
      fetchedAt: new Date().toISOString(),
      requestCount: 0,
      activeLanes: 0,
    };
  }

  const primary = lanes[0];
  const { resolved, errors: instrumentErrors } = await resolveInstruments(
    symbols,
    primary.token,
    { allowSearchFallback: symbols.length <= 5 },
  );
  for (const err of instrumentErrors) {
    errors.push({
      symbol: err.symbol,
      stage: "instrument",
      message: err.message,
      retryable: false,
    });
  }

  const instruments = [...resolved.values()];
  const assignment = assignSymbolsToLanes(
    instruments.map((i) => i.symbol),
    lanes.length,
  );

  const batches: Array<Array<{ symbol: string; instrumentKey: string }>> = [];
  for (let i = 0; i < instruments.length; i += QUOTE_BATCH_SIZE) {
    batches.push(instruments.slice(i, i + QUOTE_BATCH_SIZE));
  }

  let laneIndex = 0;
  const active = () => activeLanes(lanes);

  for (const batch of batches) {
    const laneList = active();
    if (laneList.length === 0) {
      for (const inst of batch) {
        errors.push({
          symbol: inst.symbol,
          stage: "quote",
          message: "All Upstox token lanes are invalid.",
          retryable: false,
        });
      }
      continue;
    }
    const lane = laneList[laneIndex % laneList.length];
    laneIndex += 1;
    const out = await fetchCurrentBatch(lane, batch, requestCount);
    rows.push(...out.rows);
    errors.push(...out.errors);

    if (out.errors.some((e) => !e.retryable && e.message.includes("token"))) {
      for (const inst of batch) {
        const reassigned = laneForSymbol(lanes, inst.symbol, assignment, true);
        if (reassigned && reassigned !== lane && !reassigned.invalid) {
          const retry = await fetchCurrentBatch(reassigned, [inst], requestCount);
          rows.push(...retry.rows.filter((r) => r.symbol === inst.symbol));
        }
      }
    }
  }

  return {
    rows,
    errors,
    fetchedAt: new Date().toISOString(),
    requestCount: requestCount.value,
    activeLanes: active().length,
  };
}

async function fetchHistoricalForSymbol(
  lane: TokenLane,
  symbol: string,
  instrumentKey: string,
  fromDate: string,
  toDate: string,
  requestCount: { value: number },
): Promise<{ rows: HistoricalPriceRow[]; error?: UpstoxDataError }> {
  const chunks = splitHistoricalChunks(fromDate, toDate);
  const rows: HistoricalPriceRow[] = [];

  for (const chunk of chunks) {
    const pathKey = encodeURIComponent(instrumentKey);
    const url = `https://api.upstox.com/v3/historical-candle/${pathKey}/days/1/${chunk.toDate}/${chunk.fromDate}`;

    const { response } = await lane.limiter.run(async () => {
      requestCount.value += 1;
      return upstoxFetch(url, { method: "GET", token: lane.token });
    });

    if (response.status === 401 || response.status === 403) {
      lane.markInvalid(authErrorMessage(response.status));
      return {
        rows,
        error: {
          symbol,
          stage: "historical",
          message: authErrorMessage(response.status),
          retryable: false,
        },
      };
    }

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      return {
        rows,
        error: {
          symbol,
          stage: "historical",
          message: `Historical request failed (${response.status}).`,
          retryable,
        },
      };
    }

    const payload = (await response.json()) as {
      data?: { candles?: unknown[] };
    };
    const candles = payload.data?.candles ?? [];
    for (const candle of candles) {
      const row = parseHistoricalCandle(symbol, candle);
      if (row) rows.push(row);
    }
  }

  const byKey = new Map<string, HistoricalPriceRow>();
  for (const row of rows) {
    byKey.set(`${row.symbol}|${row.date}`, row);
  }
  return { rows: [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export async function fetchHistoricalEod(
  symbols: string[],
  fromDate: string,
  toDate: string,
  tokens: string[],
): Promise<UpstoxDataResponse<HistoricalPriceRow>> {
  const lanes = createTokenLanes(tokens);
  const requestCount = { value: 0 };
  const errors: UpstoxDataError[] = [];
  const rows: HistoricalPriceRow[] = [];

  if (lanes.length === 0) {
    return {
      rows: [],
      errors: [
        {
          symbol: "*",
          stage: "validation",
          message: "No Upstox access token configured.",
          retryable: false,
        },
      ],
      fetchedAt: new Date().toISOString(),
      requestCount: 0,
      activeLanes: 0,
    };
  }

  const primary = lanes[0];
  const { resolved, errors: instrumentErrors } = await resolveInstruments(
    symbols,
    primary.token,
    { allowSearchFallback: symbols.length <= 5 },
  );
  for (const err of instrumentErrors) {
    errors.push({
      symbol: err.symbol,
      stage: "instrument",
      message: err.message,
      retryable: false,
    });
  }

  const assignment = assignSymbolsToLanes(symbols.map(normalizeSymbol), lanes.length);

  const tasks = [...resolved.entries()].map(([symbol, inst]) => async () => {
    let lane = laneForSymbol(lanes, symbol, assignment);
    if (!lane) {
      errors.push({
        symbol,
        stage: "historical",
        message: "No valid Upstox token lane available.",
        retryable: false,
      });
      return;
    }
    let result = await fetchHistoricalForSymbol(
      lane,
      symbol,
      inst.instrumentKey,
      fromDate,
      toDate,
      requestCount,
    );
    if (result.error && !result.error.retryable && lane.invalid) {
      lane = laneForSymbol(lanes, symbol, assignment, true);
      if (lane) {
        result = await fetchHistoricalForSymbol(
          lane,
          symbol,
          inst.instrumentKey,
          fromDate,
          toDate,
          requestCount,
        );
      }
    }
    if (result.error) {
      errors.push(result.error);
    }
    rows.push(...result.rows);
  });

  const laneCount = Math.max(1, lanes.length);
  const concurrency = Math.min(32, laneCount * RATE_LIMITS.maxHistoricalInFlight);
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < tasks.length) {
      const current = index;
      index += 1;
      await tasks[current]();
    }
  });
  await Promise.all(workers);

  return {
    rows,
    errors,
    fetchedAt: new Date().toISOString(),
    requestCount: requestCount.value,
    activeLanes: activeLanes(lanes).length,
  };
}

export async function handleUpstoxDataRequest(
  body: UpstoxDataRequest,
  tokens: string[],
): Promise<UpstoxDataResponse<CurrentPriceRow | HistoricalPriceRow>> {
  if (!body.symbols?.length) {
    return {
      rows: [],
      errors: [
        {
          symbol: "*",
          stage: "validation",
          message: "Symbol list is empty.",
          retryable: false,
        },
      ],
      fetchedAt: new Date().toISOString(),
      requestCount: 0,
    };
  }

  const symbols = body.symbols.map(normalizeSymbol);

  if (body.mode === "current") {
    return fetchCurrentDay(symbols, tokens);
  }

  if (!body.fromDate || !body.toDate) {
    return {
      rows: [],
      errors: [
        {
          symbol: "*",
          stage: "validation",
          message: "Historical mode requires fromDate and toDate.",
          retryable: false,
        },
      ],
      fetchedAt: new Date().toISOString(),
      requestCount: 0,
    };
  }

  return fetchHistoricalEod(symbols, body.fromDate, body.toDate, tokens);
}
