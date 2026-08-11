import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-brand-light blur-3xl" />

      <PageContainer className="relative pb-20 pt-12 md:pt-16">
        <p className="ui-eyebrow">Personal market lab</p>
        <h1 className="ui-page-title mt-4 max-w-3xl">
          Explore patterns. Backtest history. Post with confidence.
        </h1>
        <p className="ui-helper mt-5 max-w-2xl text-base">
          Shares & Trends is a browser-based scanner and backtester. Price data
          lives in IndexedDB on your machine — no database server required.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/data" className="ui-btn-primary">
            1. Download price data
          </Link>
          <Link href="/explore" className="ui-btn-secondary">
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
            <div key={card.title} className="ui-card p-6">
              <h2 className="ui-card-title text-lg">{card.title}</h2>
              <p className="ui-helper mt-3">{card.body}</p>
            </div>
          ))}
        </div>
      </PageContainer>
    </div>
  );
}
