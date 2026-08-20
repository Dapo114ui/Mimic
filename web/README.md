# Mimic — web

A market data, order-placement, and portfolio dashboard for [Nado](https://www.nado.xyz/).
Next.js (App Router) + Tailwind CSS v4 + wagmi/viem for wallet connection and order signing,
[lightweight-charts](https://github.com/tradingview/lightweight-charts) for the candlestick chart.

## Pages

- **`/`** — market watchlist: price, 24h change, volume, funding rate, open interest across
  Nado's perp markets, sortable. Links into `/portfolio`.
- **`/markets/[symbol]`** — one market: candlestick chart and a recent-trades tape, and for
  BTC-PERP/ETH-PERP specifically: a real order-entry form, a fully live header and stats row
  (price, 24h change, 24h volume, open interest, funding rate), a live hourly candlestick chart,
  and a live recent-trades tape. Other markets fall back to sample chart/stats/trades.
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
    terminal/                 # MarketsTable, CandlestickChart, LiveCandlestickChart, TradesTable,
                               # LiveTradesTable, OrderForm, NlpVaultForm, LiveMarketPanel,
                               # BetaTradingWarning, SideBadge, SampleDataBanner
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
      indexer.ts                 # funding_rate / market_snapshots / candlesticks /
                                  # matches_and_liquidations against the real archive service
                                  # (POST-based — a different wire format from client.ts)
      useLiveMarket.ts           # combines gateway + indexer into one hook: price, OI, funding,
                                  # 24h vol/change
      useLiveChart.ts             # candlestick history + recent-trades tape, each its own hook
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

The candlestick chart and recent-trades tape are real too, for BTC-PERP/ETH-PERP, from the same
archive service. `candlesticks` (`product_id`, `granularity` in seconds) returns a fixed window
of ~100 recent buckets, newest first — there's no count/range parameter (a `limit` field is
silently ignored), so this is hourly, ~4 days back, reversed to the ascending order chart
libraries expect. Recent trades come from `matches_and_liquidations` (`product_ids` — plural
array, confirmed against the SDK's own `IndexerServerMatchEventsParams` type after an initial
probe with the singular `product_id` silently matched nothing): its `matches` array has one row
per side of a fill (taker + maker) with real fill amounts but no wall-clock time, and its sibling
`txs` array has one row per trade with a real unix timestamp — joined by `submission_idx`, the
same pattern Nado's own SDK uses internally (`IndexerBaseClient.getMatchEvents`). Only the taker
leg is kept per trade, since a trade tape shows one row per trade, not per side; price is
`|quote_filled / base_filled|` rather than the order's `priceX18`, to reflect what the fill
actually cleared at. Verified by replicating this exact logic against live captured responses:
ascending/descending ordering held, all OHLC bars satisfied `high ≥ max(open,close)` and
`low ≤ min(open,close)`, computed BTC trade prices landed in a sane $50–90k band, and every
trade's derived timestamp fell within the last few minutes of a live request — matching what an
active order book actually looks like. (The sandbox's headless Chromium can't reach either Nado
service through this environment's outbound proxy — confirmed again here, now for GET as well as
POST — so this was validated by replicating the browser-side logic in Node against live captured
JSON rather than an actual rendered screenshot; `npm run build`/`eslint` are clean.)

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

The candle/fill generators in `lib/markets.ts` — still used for every market other than
BTC-PERP/ETH-PERP — use a seeded PRNG (`mulberry32`), not `Math.random()` or `Date.now()` —
deterministic output is required here, not just nice-to-have: anything render-time-dependent
produces different values during SSR vs. hydration and throws a React hydration-mismatch error.
`formatDateTime` pins `timeZone: "UTC"` for the same reason. (This doesn't apply to the live
Nado data: `useLiveMarket`/`useLiveChart` fetch client-side only, inside `"use client"`
components, so there's no SSR render to mismatch against.)

## Usage

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npx eslint src
```
