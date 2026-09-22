import { isValidYmd, clampToToday } from "@/lib/upstox/date-ranges";
import { normalizeSymbol } from "@/lib/upstox/parse";
import { handleUpstoxDataRequest } from "@/lib/upstox/service";
import type { UpstoxDataRequest } from "@/lib/upstox/types";
import { dedupeTokens, resolveRequestTokens } from "@/lib/upstox/tokens";
import { NextResponse } from "next/server";

function validateBody(raw: unknown): { ok: true; body: UpstoxDataRequest } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, message: "Request body must be JSON." };
  }
  const body = raw as Record<string, unknown>;
  const mode = body.mode;
  if (mode !== "current" && mode !== "historical") {
    return { ok: false, message: "mode must be current or historical." };
  }
  if (!Array.isArray(body.symbols)) {
    return { ok: false, message: "symbols must be an array." };
  }
  const symbols = body.symbols
    .filter((s): s is string => typeof s === "string")
    .map(normalizeSymbol)
    .filter(Boolean);
  if (symbols.length === 0) {
    return { ok: false, message: "At least one symbol is required." };
  }

  const accessToken =
    typeof body.accessToken === "string" ? body.accessToken : undefined;
  const accessTokens = Array.isArray(body.accessTokens)
    ? body.accessTokens.filter((t): t is string => typeof t === "string")
    : undefined;

  if (mode === "current") {
    return {
      ok: true,
      body: { mode: "current", symbols, accessToken, accessTokens },
    };
  }

  const fromDate = typeof body.fromDate === "string" ? body.fromDate : "";
  const toDate = typeof body.toDate === "string" ? body.toDate : "";
  if (!isValidYmd(fromDate) || !isValidYmd(toDate)) {
    return { ok: false, message: "fromDate and toDate must use YYYY-MM-DD." };
  }
  const clampedTo = clampToToday(toDate);
  if (fromDate > clampedTo) {
    return { ok: false, message: "fromDate must be on or before toDate." };
  }

  return {
    ok: true,
    body: {
      mode: "historical",
      symbols,
      fromDate,
      toDate: clampedTo,
      accessToken,
      accessTokens,
    },
  };
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      {
        rows: [],
        errors: [
          {
            symbol: "*",
            stage: "validation",
            message: "Malformed JSON body.",
            retryable: false,
          },
        ],
        fetchedAt: new Date().toISOString(),
        requestCount: 0,
      },
      { status: 400 },
    );
  }

  const validated = validateBody(json);
  if (!validated.ok) {
    return NextResponse.json(
      {
        rows: [],
        errors: [
          {
            symbol: "*",
            stage: "validation",
            message: validated.message,
            retryable: false,
          },
        ],
        fetchedAt: new Date().toISOString(),
        requestCount: 0,
      },
      { status: 400 },
    );
  }

  const tokens = resolveRequestTokens(validated.body);
  if (tokens.length === 0) {
    return NextResponse.json(
      {
        rows: [],
        errors: [
          {
            symbol: "*",
            stage: "validation",
            message:
              "No Upstox access token configured. Add API keys or set UPSTOX_ACCESS_TOKEN_* env vars.",
            retryable: false,
          },
        ],
        fetchedAt: new Date().toISOString(),
        requestCount: 0,
      },
      { status: 401 },
    );
  }

  // Never log tokens; only count lanes.
  const tokenCount = dedupeTokens(tokens).length;
  const result = await handleUpstoxDataRequest(validated.body, tokens);
  return NextResponse.json({ ...result, activeLanes: result.activeLanes ?? tokenCount });
}
