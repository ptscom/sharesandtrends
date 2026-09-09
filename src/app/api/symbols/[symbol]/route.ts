import { NextResponse } from "next/server";

interface YahooChartResult {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        longName?: string;
        shortName?: string;
      };
    }>;
    error?: { description?: string };
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await context.params;
  const upper = symbol.toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upper)}?interval=1d&range=5d`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SharesAndTrends/1.0)",
      },
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Yahoo Finance returned ${response.status}` },
        { status: response.status },
      );
    }

    const data = (await response.json()) as YahooChartResult;
    const meta = data.chart?.result?.[0]?.meta;
    const name = meta?.longName?.trim() || meta?.shortName?.trim();

    if (!name) {
      return NextResponse.json(
        { error: data.chart?.error?.description ?? "Company name not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ symbol: upper, name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
