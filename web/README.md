# Mimic — web

A market data and portfolio dashboard for [Nado](https://www.nado.xyz/). Next.js (App Router) +
Tailwind CSS v4 + wagmi/viem for wallet connection, [lightweight-charts](https://github.com/tradingview/lightweight-charts)
for the candlestick chart.

## Pages

- **`/`** — market watchlist: price, 24h change, volume, funding rate, open interest across
  Nado's perp markets, sortable. Links into `/portfolio`.
- **`/markets/[symbol]`** — one market: price, candlestick chart, stats, and a recent-fills tape.
- **`/portfolio`** — account view: equity/margin summary, open positions, trade history.

## Layout

```
src/
  app/
    page.tsx                 # markets watchlist (home)
    markets/[symbol]/        # per-market chart + stats
    portfolio/                # account view
  components/
    terminal/                 # MarketsTable, CandlestickChart, SideBadge, SampleDataBanner
    Navbar.tsx, Footer.tsx, ConnectButton.tsx, Providers.tsx
  lib/
    markets.ts                 # sample market list + deterministic candle/fill generation
    portfolio.ts                # sample account summary, positions, trade history
    format.ts                   # shared formatters (USD, price, pct, date/time)
    wagmi.ts                    # wagmi config — Ink mainnet (chain 57073), injected connector
```

## Sample data, on purpose

There's no live connection to Nado's API/websocket feed in this environment, so `lib/markets.ts`
and `lib/portfolio.ts` are sample data — every page says so explicitly (`SampleDataBanner`), and
the portfolio page never implies that connecting a wallet makes the numbers real. `getAllMarkets`
/ `getCandles` / `getRecentFills` are structured to be a drop-in swap for real Nado API calls
without touching the UI.

The candle and fill generators use a seeded PRNG (`mulberry32`), not `Math.random()` or
`Date.now()` — deterministic output is required here, not just nice-to-have: anything
render-time-dependent will produce different values during SSR vs. hydration and throw a
React hydration-mismatch error. `formatDateTime` pins `timeZone: "UTC"` for the same reason.

## Usage

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npx eslint src
```
