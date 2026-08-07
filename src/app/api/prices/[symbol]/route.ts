import { NextResponse } from "next/server";
import type { OhlcvBar } from "@/lib/types";

interface YahooChartResult {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { description?: string };
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await context.params;
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "10y";
  const interval = searchParams.get("interval") ?? "1d";

  const upper = symbol.toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upper)}?interval=${interval}&range=${range}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SharesAndTrends/1.0)",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Yahoo Finance returned ${response.status}` },
        { status: response.status },
      );
    }

    const data = (await response.json()) as YahooChartResult;
    const result = data.chart?.result?.[0];
    if (!result?.timestamp?.length) {
      return NextResponse.json(
        { error: data.chart?.error?.description ?? "No data returned" },
        { status: 404 },
      );
    }

    const quote = result.indicators?.quote?.[0];
    if (!quote) {
      return NextResponse.json({ error: "Missing quote data" }, { status: 404 });
    }

    const bars: OhlcvBar[] = [];
    for (let i = 0; i < result.timestamp.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      const volume = quote.volume?.[i];
      if (
        open == null ||
        high == null ||
        low == null ||
        close == null ||
        volume == null
      ) {
        continue;
      }
      bars.push({
        date: new Date(result.timestamp[i]! * 1000).toISOString().slice(0, 10),
        open,
        high,
        low,
        close,
        volume,
      });
    }

    return NextResponse.json({ symbol: upper, bars, count: bars.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
