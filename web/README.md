# Mimic — web

A market data, order-placement, and portfolio dashboard for [Nado](https://www.nado.xyz/).
Next.js (App Router) + Tailwind CSS v4 + wagmi/viem for wallet connection and order signing,
[lightweight-charts](https://github.com/tradingview/lightweight-charts) for the candlestick chart.

## Pages

- **`/`** — market watchlist: price, 24h change, volume, funding rate, open interest across
  Nado's perp markets, sortable. Links into `/portfolio`.
- **`/markets/[symbol]`** — one market: candlestick chart and a recent-fills tape (both sample
  data), and for BTC-PERP/ETH-PERP specifically: a real order-entry form plus a fully live
  header and stats row (price, 24h change, 24h volume, open interest, funding rate).
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
      config.ts                 # real gateway + indexer endpoints, chain ID, verified addresses
      eip712.ts                 # order/MintNlp/BurnNlp signing domains, types, subaccount encoding
      client.ts                 # query()/execute() against the real gateway (GET-based)
      indexer.ts                 # funding_rate / market_snapshots against the real archive
                                  # service (POST-based — a different wire format from client.ts)
      useLiveMarket.ts           # combines both into one hook: price, OI, funding, 24h vol/change
```

## Sample data vs. real integration — two different things here

`lib/markets.ts` and `lib/portfolio.ts` are still sample data (no historical/24h/volume feed was
verified — see below), clearly labeled as such (`SampleDataBanner`) on every page that uses them.

`lib/nado/` is **real, and targets mainnet**: verified against Nado's actual TypeScript SDK
([nadohq/nado-typescript-sdk](https://github.com/nadohq/nado-typescript-sdk)) and live-tested
against `gateway.prod.nado.xyz` from this environment — endpoints, EIP-712 domains/types for
`place_order`/`mint_nlp`/`burn_nlp`, and the `endpoint` (sequencer) contract address all came
from the SDK source or a live API response, not invented. `useLiveMarket` pulls real price,
open interest, funding rate, and 24h volume/change for BTC-PERP/ETH-PERP — those are the only
two product IDs identified with confidence (product 3's spot token is `0x4200...0006`, the
canonical WETH predeploy shared by every OP-Stack chain — about as strong a cross-check as this
gets), since the gateway's `all_products` response has no symbol/ticker field for the rest. (It
turns out a `symbols` query type does exist and returns real ticker names for every product —
found while probing the gateway for this feature — but expanding market coverage with it is a
separate, not-yet-done piece of work.)

Price and open interest come from the low-latency gateway (`client.ts`); funding rate and 24h
volume/change do not exist there at all — probing the gateway with an invalid query type
surfaces the full list of valid ones, and there's no 24h/volume/candle entry in it. They come
from Nado's separate archive/indexer service instead (`indexer.ts`, `archive.prod.nado.xyz`),
which uses a different wire format (POST to the bare versioned URL, not GET with a query
string) discovered the same empirical way: read the SDK's request-building code, then confirm
against a live call. Funding rate is `funding_rate`, a real per-product instantaneous rate, not
the cumulative accumulator `all_products` exposes. 24h volume/change come from `market_snapshots`
— the archive only offers fixed hourly/daily snapshots, not an arbitrary rolling window, so this
fetches ~25 hourly points and diffs the current one against whichever lands closest to exactly
24h back. Both were spot-checked against real, independently-observed data: the computed 24h
price change matched an actual ~7.5%/~18% BTC/ETH move that happened during this session, and
the resulting 24h volume figures ($436M BTC, $114M ETH) are the right order of magnitude for an
active perp market.

The order `appendix` bitfield and default subaccount encoding — the two riskiest unknowns when
this only targeted testnet — are backed by Nado/Vertex-family documentation: `appendix = 0`
decodes to version 0, not isolated, order type 0 (DEFAULT/standard limit), not reduce-only, no
trigger, i.e. exactly the plain limit order `OrderForm` places; an empty subaccount name is
explicitly documented as "the default subaccount identifier." A real order has since been signed
and submitted through `OrderForm` from a real browser and got back a real gateway response (an
insufficient-collateral rejection, since that wallet had never deposited) — confirming the
sign → submit → real-API-response path genuinely works end to end, not just in theory.
`OrderForm` and `NlpVaultForm` both carry a `BetaTradingWarning` making clear that mint/burn in
particular has not been round-tripped the same way, and suggesting a small size to start — the
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
