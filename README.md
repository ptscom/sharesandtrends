# Shares & Trends

Personal stock exploration, backtesting, and pattern scanning — **all in your browser**.

No server database. Price data is stored locally in **IndexedDB** (same philosophy as a browser-only pair trading setup).

## Features

- **Local price storage** — download daily OHLCV via Yahoo Finance proxy, store in IndexedDB
- **Technical indicators** — EMA, SMA, RSI, MACD, Bollinger Bands, ATR
- **Pattern engine** — composable entry/exit conditions (crossovers, comparisons)
- **Multi-timeframe capable** — optional weekly/monthly indicators (derived from daily bars)
- **Backtest** — win rate, avg return, Sharpe, trade log
- **Universe scan** — filter by min win rate, min trades, signal-today; runs in a Web Worker
- **Charts** — TradingView Lightweight Charts with signal markers
- **Social sharing** — copy post captions, export scan JSON, saved scan history

## Getting started

```bash
npm install
npm run dev
```

1. Open [http://localhost:3000/data](http://localhost:3000/data) and download price data for your watchlist
2. Go to [http://localhost:3000/explore](http://localhost:3000/explore) to backtest and scan patterns
3. View saved scans at [http://localhost:3000/scans](http://localhost:3000/scans)
4. Click any symbol in scan results for detail view

## Deploy on Vercel

```bash
npm run build
```

Push to GitHub and import the repo in Vercel. No database env vars required — only optional API usage for the Yahoo Finance proxy route.

## Architecture

```
Browser (Next.js on Vercel)
  ├── IndexedDB (Dexie) — prices, patterns, scan results
  ├── Web Worker — universe scans (keeps UI responsive)
  ├── Engine — indicators, conditions, backtest, scanner
  └── API route — Yahoo Finance fetch proxy only (no DB)
```

## Tech stack

- Next.js 16 · React 19 · Tailwind CSS 4
- Dexie (IndexedDB)
- technicalindicators
- lightweight-charts
