import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />

      <section className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">
          Personal market lab
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Explore patterns. Backtest history. Post with confidence.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Shares & Trends is a browser-based scanner and backtester. Price data
          lives in IndexedDB on your machine — no database server required.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/data"
            className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-bg"
          >
            1. Download price data
          </Link>
          <Link
            href="/explore"
            className="rounded-full border border-border px-6 py-3 text-sm text-muted hover:text-ink"
          >
            2. Explore & scan
          </Link>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Browser storage",
              body: "OHLCV history stored locally via IndexedDB. Works offline after download.",
            },
            {
              title: "Flexible indicators",
              body: "EMA, RSI, MACD, Bollinger Bands, ATR — composable pattern rules.",
            },
            {
              title: "Scan + backtest",
              body: "Filter by win rate and trade count. Preview charts with entry markers.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-3xl border border-border bg-surface p-6"
            >
              <h2 className="text-xl font-semibold">{card.title}</h2>
              <p className="mt-3 text-sm text-muted">{card.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
