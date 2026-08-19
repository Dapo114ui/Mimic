# Mimic — web

A market data, order-placement, and portfolio dashboard for [Nado](https://www.nado.xyz/).
Next.js (App Router) + Tailwind CSS v4 + wagmi/viem for wallet connection and order signing,
[lightweight-charts](https://github.com/tradingview/lightweight-charts) for the candlestick chart.

## Pages

- **`/`** — market watchlist: price, 24h change, volume, funding rate, open interest across
  Nado's perp markets, sortable. Links into `/portfolio`.
- **`/markets/[symbol]`** — one market: price, candlestick chart, stats, a recent-fills tape,
  and (for BTC-PERP/ETH-PERP) a real order-entry form and a live price badge.
- **`/portfolio`** — account view: equity/margin summary, open positions, trade history.
- **`/vault`** — mint/burn Nado's own native liquidity vault (NLP) — not a Mimic product,
  reached directly through Nado's gateway.

## Layout

```
src/
  app/
    page.tsx                 # markets watchlist (home)
    markets/[symbol]/        # per-market chart, stats, live price, order form
    portfolio/                # account view
    vault/                     # NLP mint/burn
  components/
    terminal/                 # MarketsTable, CandlestickChart, OrderForm, NlpVaultForm,
                               # LivePriceBadge, BetaTradingWarning, SideBadge, SampleDataBanner
    Navbar.tsx, Footer.tsx, ConnectButton.tsx, Providers.tsx
  lib/
    markets.ts                 # sample market list + deterministic candle/fill generation
    portfolio.ts                # sample account summary, positions, trade history
    format.ts                   # shared formatters (USD, price, pct, date/time)
    wagmi.ts                    # wagmi config — Ink mainnet (chain 57073), injected connector
    nado/
      config.ts                 # real gateway endpoints, chain ID, verified contract addresses
      eip712.ts                 # order/MintNlp/BurnNlp signing domains, types, subaccount encoding
      client.ts                 # query()/execute() against the real REST gateway
      useLiveMarket.ts           # live oracle price + open interest (react-query)
```

## Sample data vs. real integration — two different things here

`lib/markets.ts` and `lib/portfolio.ts` are still sample data (no historical/24h/volume feed was
verified — see below), clearly labeled as such (`SampleDataBanner`) on every page that uses them.

`lib/nado/` is **real, and targets mainnet**: verified against Nado's actual TypeScript SDK
([nadohq/nado-typescript-sdk](https://github.com/nadohq/nado-typescript-sdk)) and live-tested
against `gateway.prod.nado.xyz` from this environment — endpoints, EIP-712 domains/types for
`place_order`/`mint_nlp`/`burn_nlp`, and the `endpoint` (sequencer) contract address all came
from the SDK source or a live API response, not invented. `useLiveMarket` pulls real oracle
price + open interest for BTC-PERP/ETH-PERP — those are the only two product IDs identified
with confidence (product 3's spot token is `0x4200...0006`, the canonical WETH predeploy shared
by every OP-Stack chain — about as strong a cross-check as this gets), since the gateway's
`all_products` response has no symbol/ticker field for the rest.

The order `appendix` bitfield and default subaccount encoding — the two riskiest unknowns when
this only targeted testnet — are now backed by Nado/Vertex-family documentation: `appendix = 0`
decodes to version 0, not isolated, order type 0 (DEFAULT/standard limit), not reduce-only, no
trigger, i.e. exactly the plain limit order `OrderForm` places; an empty subaccount name is
explicitly documented as "the default subaccount identifier." What's still genuinely
unverified: **this environment has no funded wallet**, so no signed order/mint/burn has
actually round-tripped through the gateway end to end — real funds are at risk on a real
integration that has only been reasoned about, not tested. `OrderForm` and `NlpVaultForm` both
carry a `BetaTradingWarning` saying exactly this and suggesting a small size to start — the
honesty boundary lives in the UI, not just in this file.

The candle/fill generators in `lib/markets.ts` use a seeded PRNG (`mulberry32`), not
`Math.random()` or `Date.now()` — deterministic output is required here, not just nice-to-have:
anything render-time-dependent produces different values during SSR vs. hydration and throws a
React hydration-mismatch error. `formatDateTime` pins `timeZone: "UTC"` for the same reason.

## Usage

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npx eslint src
```
