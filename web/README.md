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
- **`/portfolio`** — the connected wallet's real Nado account: equity, available margin, margin
  ratio, unrealized PnL, open positions, and fill history. Nothing here is sample data — if
  there's no wallet connected, or the connected wallet has no Nado account yet, the page says so
  rather than showing a placeholder account.
- **`/vault`** — mint/burn Nado's own native liquidity vault (NLP) — not a Mimic product,
  reached directly through Nado's gateway. Real NLP price, total supply, TVL, and (once
  connected) your own NLP balance; mint/burn itself is unconfirmed — see below.

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
    portfolio/                 # PortfolioView (the /portfolio page body), AccountSummaryLink
                                # (the homepage "Your account" card) — both real, both client
    vault/                      # NlpVaultStats (price/supply/TVL/your balance) — real, client
    Navbar.tsx, Footer.tsx, ConnectButton.tsx, Providers.tsx
  lib/
    markets.ts                 # sample market list + deterministic candle/fill generation
    format.ts                   # shared formatters (USD, price, pct, date/time)
    wagmi.ts                    # wagmi config — Ink mainnet (chain 57073), injected connector
    nado/
      config.ts                 # real gateway + indexer endpoints, chain ID, verified addresses
      eip712.ts                 # order/MintNlp/BurnNlp signing domains, types, subaccount encoding
      client.ts                 # query()/execute() against the real gateway (POST-based)
      indexer.ts                 # funding_rate / market_snapshots / candlesticks /
                                  # matches_and_liquidations / account trade history against the
                                  # real archive service (POST — a different wire format from
                                  # client.ts, to a different host)
      account.ts                 # subaccount_info + the position/equity/margin math derived
                                  # from it, the symbols query (product_id → ticker), and NLP
                                  # price/supply/balance (NLP is just spot product 11)
      useLiveMarket.ts           # combines gateway + indexer into one hook: price, OI, funding,
                                  # 24h vol/change
      useLiveChart.ts             # candlestick history + recent-trades tape, each its own hook
      usePortfolio.ts             # subaccount_info + trade history + symbols, combined, for the
                                   # connected wallet
      useNlpVault.ts               # NLP price/supply/TVL (no wallet needed) + your own balance
                                    # (needs one), for the /vault page
```

## Sample data vs. real integration — two different things here

`lib/markets.ts` is still sample data for markets other than BTC-PERP/ETH-PERP (no historical/
24h/volume feed was verified for them — see below), clearly labeled as such (`SampleDataBanner`)
on every page that uses it. The account/portfolio data (`lib/nado/account.ts`, `usePortfolio.ts`)
is real for any connected wallet, in any market — see its own section below.

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

The order `appendix` bitfield is backed by Nado/Vertex-family documentation: `appendix = 0`
decodes to version 0, not isolated, order type 0 (DEFAULT/standard limit), not reduce-only, no
trigger, i.e. exactly the plain limit order `OrderForm` places. A real order has since been signed
and submitted through `OrderForm` from a real browser and got back a real gateway response —
confirming the sign → submit → real-API-response path genuinely works end to end, not just in
theory.

That test's rejection was originally attributed to "the wallet had never deposited" — that
explanation turned out to be unverified and probably wrong. `encodeSubaccount`'s default name was
`""` (empty string), sourced from a documentation read claiming an all-zero name is "the default
subaccount identifier." Building the portfolio page surfaced a real, funded account showing as
`exists: false`, which led to decoding real `sender` hexes from live order/match data all session:
every one has its trailing 12 bytes as ASCII `"default"` + zero padding, never all zeros. An
empty name is a *different, real-but-uninvolved* subaccount — not a fallback or an error, just
the wrong address entirely, confirmed by reconstructing a known real subaccount hash byte-for-byte
with the corrected default and getting a mismatch with the old one. This affected all four call
sites sharing `encodeSubaccount`'s default (`OrderForm`, `NlpVaultForm`, and both new portfolio
queries), now fixed by changing the default to `"default"`. It means the earlier test's rejection
almost certainly wasn't about deposits at all — it was signed against a subaccount that was never
going to have any. The read side of the fix is confirmed against a real funded account — a real
user's `/portfolio` page went from showing "no Nado account" to the exact equity figure Nado's own
site shows for that wallet. The write side (an order or mint/burn actually landing correctly
post-fix) has not — `OrderForm` and `NlpVaultForm` both carry a `BetaTradingWarning` reflecting
exactly this, and mint/burn remains fully unconfirmed on top of it — the honesty boundary lives in
the UI, not just in this file.

`/portfolio` and the homepage's "Your account" card are real for any connected wallet, from the
gateway's `subaccount_info` query plus the indexer's `matches` query — both confirmed against
Nado's SDK source (`EngineQueryClient.getSubaccountSummary()`, `IndexerBaseClient.getMatchEvents()`)
and cross-checked against a real active account's live response. `subaccount_info` returns
everything needed in one call: spot/perp balances, live oracle prices for every product the
account holds, and three pre-weighted `{assets, liabilities, health}` groups (`[initial,
maintenance, unweighted]`, Vertex-lineage convention) the engine itself computes from those
balances using each product's risk weights — equity is read directly from the unweighted group
rather than re-deriving Nado's own risk-weighting logic. Per-position entry price and unrealized
PnL use the SDK's own formula (`calcPerpBalanceValue`): `unrealizedPnl = amount * oraclePrice +
vQuoteBalance`, `entryPrice = -vQuoteBalance / amount` — verified against a real position where
`spotBalance + unrealizedPnl` matched the engine's own equity figure to the cent. Trade history
joins the indexer's `matches` (filtered by `subaccounts: [hex]`) against its sibling `txs` array
for real timestamps, the same pattern used for the market-wide recent-trades tape, but keeping
every row (not just the taker leg) since each one is this account's own distinct fill; realized
PnL comes straight from the protocol's own `realized_pnl` field per fill, not recomputed.

Every position and trade is labeled with a real ticker via the gateway's `symbols` query — a
product-id → name map, and (unlike the market-list page) *not optional* here: this is real
account data, and silently hiding or mislabeling a position outside `KNOWN_PRODUCTS` would
misrepresent a user's actual money, not just show an incomplete market list. One known gap:
`subaccount_info`'s balances appear to be the cross-margin bucket only — isolated positions
(there's a separate `isolated_positions` query type, not wired up) aren't shown, disclosed
directly under "Open positions" in the UI rather than silently omitted.

`/vault`'s stats are real too. NLP has no ticker in the `symbols` query, but is a real spot
product (id 11) with its own live `oracle_price_x18` and lending-market-shaped state — identified
first by cross-checking two independently-computed live figures against each other (a pool's spot
balance vs. its own liability, computed two different ways), then confirmed as an SDK-wide
hardcoded constant (`packages/shared/src/consts/productIds.ts`), not something derived from
deployment config. Price is that oracle price directly — no NLP-specific price helper exists
anywhere in the SDK, it's mapped through the exact same generic spot-product path as any other
product. Total supply is `calcTotalDeposited`'s own formula (`packages/shared/src/utils/
interest.ts`): normalized deposits × a Compound-style exchange-rate multiplier that starts at 1.0
and grows as the vault earns fees — the same accounting every other Nado spot-lending-market
product uses, just reused for NLP issuance. Your own balance is just your spot balance for
product 11, from the same `subaccount_info` call the portfolio page already makes. One figure is
deliberately *not* shown: an APR. The SDK's own depositor-APY formula needs a protocol fee-share
constant that has zero call sites anywhere in the codebase — there's no reliable source for it,
so it's omitted rather than guessed at for something tied to a real mint/burn decision.

Two corrections along the way, both found by an actual real-money mint attempt against a funded
account. First, `nadoExecute`/`nadoQuery` called `res.json()` unconditionally — but not every
gateway error is the `{status:"failure",...}` JSON envelope; a malformed payload gets a plain-text
4xx body instead (e.g. "Failed to deserialize..."), and `res.json()` on that throws an opaque
"Unexpected token" `SyntaxError` that hides the real message. Fixed to read the body as text first
and only parse it as JSON if it looks like JSON. Second — the actual real bug that error handling
had been hiding: `mint_nlp`/`burn_nlp`'s execute payload needs `{tx: {sender, quoteAmount, nonce},
signature}`, a nested `tx` object, not the flat `{sender, quoteAmount, nonce, signature}` the code
was sending — discovered the same empirical way as everything else in this file (probe with a
deliberately incomplete body, follow the "missing field" errors one at a time), then confirmed
against the live gateway by sending a full payload with a dummy signature and getting all the way
to a real, well-formed `"malformed signature"` rejection instead of a deserialize error. This is
the reason a real test mint got the opaque JSON-parse error above, not a real gateway response —
`place_order`'s shape was already correct (it round-tripped successfully earlier), so this is a
`mint_nlp`/`burn_nlp`-specific fix, and `BetaTradingWarning` now says explicitly, in the vault
context, that mint/burn hasn't completed a real round trip yet at all, not even against the wrong
subaccount the way orders had.

One correction from before that: gateway queries that take parameters (`subaccount_info`) turned
out to need POST `{type, ...params}` to `/query`, not the GET-with-querystring form `client.ts`
previously used for the zero-param `all_products` case — GET happened to also work live, but POST
is what Nado's own SDK actually sends, so `nadoQuery` now does that uniformly for every query.

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
