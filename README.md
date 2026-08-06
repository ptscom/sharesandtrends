# Shares & Trends

Personal stock exploration, backtesting, and pattern scanning — **all in your browser**.

No server database. Price data is stored locally in **IndexedDB** (same philosophy as a browser-only pair trading setup).

## Features

- **Local price storage** — download daily OHLCV via Yahoo Finance proxy, store in IndexedDB
- **Technical indicators** — EMA, SMA, RSI, MACD, Bollinger Bands, ATR
- **Pattern engine** — composable entry/exit conditions (crossovers, comparisons)
- **Backtest** — win rate, avg return, Sharpe, trade log
- **Universe scan** — filter symbols by min win rate and min trades
- **Charts** — TradingView Lightweight Charts with signal markers

## Getting started

```bash
npm install
npm run dev
```

1. Open [http://localhost:3000/data](http://localhost:3000/data) and download price data for your watchlist
2. Go to [http://localhost:3000/explore](http://localhost:3000/explore) to backtest and scan patterns
3. Click any symbol in scan results for detail view

## Architecture

```
Browser (Next.js)
  ├── IndexedDB (Dexie) — prices, patterns, scan results
  ├── Engine — indicators, conditions, backtest, scanner
  └── API route — Yahoo Finance fetch proxy only (no DB)
```

## Tech stack

- Next.js 16 · React 19 · Tailwind CSS 4
- Dexie (IndexedDB)
- technicalindicators
- lightweight-charts
