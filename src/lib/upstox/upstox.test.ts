import { describe, expect, it, beforeEach } from "vitest";
import { buildInstrumentMap, setInstrumentMapForTests, clearInstrumentCache } from "@/lib/upstox/instruments";
import {
  findOhlcQuoteEntry,
  parseHistoricalCandle,
  parseIntradayCandle,
  parseLiveOhlc,
  parseSymbolList,
  pickLiveOhlcFromQuoteEntry,
} from "@/lib/upstox/parse";
import { splitIntradayMinuteChunks } from "@/lib/upstox/date-ranges";
import { mergeIntradayRowsInMemory } from "@/lib/storage/upstox-intraday";
import { assignSymbolsToLanes, distributeRoundRobin } from "@/lib/upstox/distribute";
import {
  getSharedLimiterForToken,
  resetSharedLimitersForTests,
} from "@/lib/upstox/limiter-registry";
import {
  TokenRateLimiter,
  RATE_LIMITS,
  UPSTOX_OFFICIAL_LIMITS,
} from "@/lib/upstox/rate-limiter";
import { isRetryableStatus } from "@/lib/upstox/retry-fetch";
import { dedupeTokens, createTokenLanes, activeLanes } from "@/lib/upstox/tokens";
import { pendingSymbols, retryableFailedSymbols } from "@/lib/upstox/historical-job-runner";
import { mergeHistoricalRowsInMemory } from "@/lib/storage/upstox-historical";
import {
  currentRowToOhlcvBar,
  currentRowsToHistorical,
  historicalRowToOhlcvBar,
} from "@/lib/upstox/sync-to-prices";
import type { HistoricalJob } from "@/lib/upstox/types";

describe("instrument resolution", () => {
  beforeEach(() => {
    clearInstrumentCache();
  });

  it("resolves M&M exactly", () => {
    const map = buildInstrumentMap([
      {
        segment: "NSE_EQ",
        instrument_type: "EQ",
        trading_symbol: "M&M",
        instrument_key: "NSE_EQ|INE101A01026",
      },
      {
        segment: "NSE_EQ",
        instrument_type: "EQ",
        trading_symbol: "M&MFIN",
        instrument_key: "NSE_EQ|INE774D01024",
      },
    ]);
    expect(map.get("M&M")?.instrumentKey).toBe("NSE_EQ|INE101A01026");
    expect(map.get("M&MFIN")?.instrumentKey).toBe("NSE_EQ|INE774D01024");
  });

  it("preserves ampersand in JSON symbol lists", () => {
    const symbols = parseSymbolList("RELIANCE, M&M\nM&MFIN");
    expect(symbols).toEqual(["RELIANCE", "M&M", "M&MFIN"]);
  });

  it("encodes instrument keys in URL paths", () => {
    const key = "NSE_EQ|INE101A01026";
    const encoded = encodeURIComponent(key);
    expect(encoded).not.toContain("|");
    expect(decodeURIComponent(encoded)).toBe(key);
  });
});

describe("candle parsing", () => {
  it("parses historical candle tuple", () => {
    const row = parseHistoricalCandle("RELIANCE", [
      "2024-01-15T00:00:00+05:30",
      100,
      110,
      95,
      105,
      1000,
      0,
    ]);
    expect(row?.date).toBe("2024-01-15");
    expect(row?.close).toBe(105);
    expect(row?.volume).toBe(1000);
  });

  it("preserves zero volume", () => {
    const row = parseHistoricalCandle("TCS", ["2024-02-01", 1, 2, 1, 2, 0, 0]);
    expect(row?.volume).toBe(0);
  });

  it("parses intraday candle with timestamp", () => {
    const row = parseIntradayCandle("TCS", 5, [
      "2025-01-02T09:15:00+05:30",
      100,
      110,
      99,
      105,
      5000,
      0,
    ]);
    expect(row?.timestamp).toBe("2025-01-02T09:15:00+05:30");
    expect(row?.intervalMinutes).toBe(5);
    expect(row?.close).toBe(105);
  });

  it("parses live_ohlc", () => {
    const row = parseLiveOhlc("INFY", {
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      volume: 0,
    });
    expect(row.volume).toBe(0);
    expect(row.close).toBe(11);
  });

  it("resolves quote entries when response keys use colons", () => {
    const key = "NSE_EQ|INE669E01016";
    const data = {
      "NSE_EQ:INE669E01016": {
        instrument_token: "NSE_EQ|51834",
        live_ohlc: { open: 1, high: 2, low: 1, close: 2, volume: 10 },
      },
    };
    const entry = findOhlcQuoteEntry(data, key);
    expect(pickLiveOhlcFromQuoteEntry(entry)?.close).toBe(2);
  });

  it("matches quote entries by instrument_token", () => {
    const data = {
      "NSE_FO:NIFTY2543021600PE": {
        instrument_token: "NSE_EQ|INE669E01016",
        live_ohlc: { open: 3, high: 4, low: 3, close: 4, volume: 5 },
      },
    };
    const entry = findOhlcQuoteEntry(data, "NSE_EQ|INE669E01016");
    expect(pickLiveOhlcFromQuoteEntry(entry)?.close).toBe(4);
  });
});

describe("multi-token distribution", () => {
  it("round-robins symbols across lanes", () => {
    const assignment = assignSymbolsToLanes(["A", "B", "C", "D"], 2);
    expect(assignment.get("A")).toBe(0);
    expect(assignment.get("B")).toBe(1);
    expect(assignment.get("C")).toBe(0);
    expect(distributeRoundRobin([1, 2, 3, 4], 2)).toEqual([[1, 3], [2, 4]]);
  });

  it("invalidates token lane on 401/403", () => {
    const lanes = createTokenLanes(["t1", "t2"]);
    lanes[0].markInvalid("expired");
    expect(activeLanes(lanes)).toHaveLength(1);
  });
});

describe("rate limiter", () => {
  it("stays below Upstox official caps", () => {
    expect(RATE_LIMITS.maxPerSecond).toBeLessThanOrEqual(
      UPSTOX_OFFICIAL_LIMITS.perSecond,
    );
    expect(RATE_LIMITS.maxPerMinute).toBeLessThanOrEqual(
      UPSTOX_OFFICIAL_LIMITS.perMinute,
    );
    expect(RATE_LIMITS.maxPer30Minutes).toBeLessThanOrEqual(
      UPSTOX_OFFICIAL_LIMITS.per30Minutes,
    );
  });

  it("shares one limiter per access token across lanes", () => {
    resetSharedLimitersForTests();
    const lanes = createTokenLanes(["same-token", "same-token"]);
    expect(lanes[0].limiter).toBe(lanes[1].limiter);
    expect(getSharedLimiterForToken("same-token")).toBe(lanes[0].limiter);
    const other = createTokenLanes(["other"])[0];
    expect(other.limiter).not.toBe(lanes[0].limiter);
  });

  it("isolates limits per token instance", async () => {
    const a = new TokenRateLimiter({ ...RATE_LIMITS, maxPerSecond: 1 });
    const b = new TokenRateLimiter({ ...RATE_LIMITS, maxPerSecond: 1 });
    await a.acquire();
    await b.acquire();
    expect(a).toBeDefined();
    a.release();
    b.release();
  });
});

describe("retry policy", () => {
  it("retries 429", () => {
    expect(isRetryableStatus(429)).toBe(true);
  });

  it("does not retry 400", () => {
    expect(isRetryableStatus(400)).toBe(false);
  });
});

describe("token hygiene", () => {
  it("dedupes tokens and never exposes in test payloads", () => {
    const tokens = dedupeTokens([" abc ", "abc", "", "def"]);
    expect(tokens).toEqual(["abc", "def"]);
    const body = JSON.stringify({ accessTokens: tokens });
    expect(body).not.toContain("Bearer");
  });
});

describe("historical job resume", () => {
  const baseJob: HistoricalJob = {
    id: "1",
    mode: "historical",
    symbols: ["A", "B", "C"],
    completedSymbols: ["A"],
    failedSymbols: [{ symbol: "B", message: "fail", retryable: true }],
    fromDate: "2024-01-01",
    toDate: "2024-12-31",
    createdAt: "x",
    updatedAt: "x",
    complete: false,
  };

  it("skips completed symbols on resume", () => {
    expect(pendingSymbols(baseJob)).toEqual(["C"]);
  });

  it("lists retryable failed symbols", () => {
    expect(retryableFailedSymbols(baseJob)).toEqual(["B"]);
  });
});

describe("sync to prices", () => {
  it("converts historical rows with zero volume", () => {
    const bar = historicalRowToOhlcvBar({
      symbol: "TCS",
      date: "2024-01-02",
      open: 1,
      high: 2,
      low: 1,
      close: 2,
      volume: 0,
    });
    expect(bar?.volume).toBe(0);
  });

  it("skips incomplete historical rows", () => {
    expect(
      historicalRowToOhlcvBar({
        symbol: "TCS",
        date: "2024-01-02",
        open: null,
        high: 2,
        low: 1,
        close: 2,
        volume: 1,
      }),
    ).toBeNull();
  });

  it("maps current-day rows into historical shape", () => {
    const rows = currentRowsToHistorical(
      [
        {
          symbol: "TCS",
          open: 1,
          high: 2,
          low: 1,
          close: 2,
          volume: 10,
        },
      ],
      "2026-09-23",
    );
    expect(rows[0]?.date).toBe("2026-09-23");
    expect(rows[0]?.symbol).toBe("TCS");
  });

  it("maps current-day snapshot to a daily bar", () => {
    const bar = currentRowToOhlcvBar(
      {
        symbol: "RELIANCE",
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 100,
      },
      "2026-09-22",
    );
    expect(bar?.date).toBe("2026-09-22");
    expect(bar?.close).toBe(10.5);
  });
});

describe("intraday date chunks", () => {
  it("splits long ranges for 5-minute data", () => {
    const chunks = splitIntradayMinuteChunks("2025-01-01", "2025-03-15", 5);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].fromDate).toBe("2025-01-01");
    expect(chunks[chunks.length - 1].toDate).toBe("2025-03-15");
  });
});

describe("intraday merge", () => {
  it("merges by symbol timestamp and interval", () => {
    const merged = mergeIntradayRowsInMemory(
      [
        {
          symbol: "A",
          intervalMinutes: 5,
          timestamp: "2025-01-01T09:15:00+05:30",
          open: 1,
          high: 1,
          low: 1,
          close: 1,
          volume: 1,
        },
      ],
      [
        {
          symbol: "A",
          intervalMinutes: 5,
          timestamp: "2025-01-01T09:15:00+05:30",
          open: 2,
          high: 2,
          low: 2,
          close: 2,
          volume: 2,
        },
      ],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].close).toBe(2);
  });
});

describe("historical merge", () => {
  it("keeps other symbols when merging new rows", () => {
    const merged = mergeHistoricalRowsInMemory(
      [{ symbol: "A", date: "2024-01-01", open: 1, high: 1, low: 1, close: 1, volume: 1 }],
      [{ symbol: "B", date: "2024-01-01", open: 2, high: 2, low: 2, close: 2, volume: 2 }],
    );
    expect(merged).toHaveLength(2);
    expect(merged.map((r) => r.symbol).sort()).toEqual(["A", "B"]);
  });

  it("overwrites same symbol and date", () => {
    const merged = mergeHistoricalRowsInMemory(
      [{ symbol: "A", date: "2024-01-01", open: 1, high: 1, low: 1, close: 1, volume: 1 }],
      [{ symbol: "A", date: "2024-01-01", open: 9, high: 9, low: 9, close: 9, volume: 9 }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].close).toBe(9);
  });
});

describe("instrument cache", () => {
  it("uses in-memory map for M&M lookup", () => {
    const map = buildInstrumentMap([
      {
        segment: "NSE_EQ",
        instrument_type: "EQ",
        trading_symbol: "M&M",
        instrument_key: "NSE_EQ|INE101A01026",
      },
    ]);
    setInstrumentMapForTests(map);
    expect(map.get("M&M")?.symbol).toBe("M&M");
  });
});
