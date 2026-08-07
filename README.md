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

1. Import the GitHub repo in [Vercel](https://vercel.com/new)
2. **Production branch:** `main`
3. **Root directory:** leave empty (repo root)
4. **Framework preset:** Next.js (auto-detected)
5. **Output directory:** leave empty — do **not** set `out` or `dist`
6. **Build command:** `npm run build` (default)
7. After deploy, open the **Production** URL (e.g. `your-project.vercel.app`)

No database env vars are required.

### If you see `404: NOT_FOUND`

This usually means Vercel has no successful production deployment on that URL yet:

1. In Vercel → **Deployments**, confirm the latest `main` build is **Ready** (green)
2. Click **Redeploy** on the latest successful deployment
3. Under **Settings → General**, verify **Root Directory** is blank
4. Under **Settings → General**, verify **Output Directory** is blank (Next.js default)
5. Visit `/api/health` — you should see `{"ok":true,...}` when the app is live
6. If **Deployment Protection** is on, disable it under **Settings → Deployment Protection** for a public personal app

### Verify locally

```bash
npm run build
```

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
