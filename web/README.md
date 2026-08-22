# Mimic — web

**Live:** [surgeterminal.vercel.app](https://surgeterminal.vercel.app)

A market data, order-placement, and portfolio dashboard for [Nado](https://www.nado.xyz/).
Next.js (App Router) + Tailwind CSS v4 + wagmi/viem for wallet connection and order signing,
[lightweight-charts](https://github.com/tradingview/lightweight-charts) for the candlestick chart.

## Pages

- **`/`** — market watchlist: price, 24h change, volume, funding rate, open interest across
  Nado's perp markets, sortable. Links into `/portfolio`.
- **`/markets/[symbol]`** — one market: candlestick chart and a recent-trades tape, and for
  BTC-PERP/ETH-PERP specifically: a real order-entry form, a real live order book, a fully live
  header and stats row (price, 24h change, 24h volume, open interest, funding rate), a live
  candlestick chart with a real 1m–1W timeframe selector, and a live recent-trades tape. Other
  markets fall back to sample chart/stats/trades and have no order form or order book.
- **`/portfolio`** — the connected wallet's real Nado account: equity, available margin, margin
  ratio, unrealized PnL, open positions, open orders (with cancel), and fill history. Nothing
  here is sample data — if there's no wallet connected, or the connected wallet has no Nado
  account yet, the page says so rather than showing a placeholder account.
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
                               # LiveTradesTable, OrderForm, OrderBook, NlpVaultForm,
                               # LiveMarketPanel, BetaTradingWarning, SideBadge, SampleDataBanner
    portfolio/                 # PortfolioView (the /portfolio page body), OpenOrdersTable,
                                # AccountSummaryLink (the homepage "Your account" card) — real, client
    vault/                      # NlpVaultStats (price/supply/TVL/your balance) — real, client
    Navbar.tsx, Footer.tsx, ConnectButton.tsx, Providers.tsx
  lib/
    markets.ts                 # sample market list + deterministic candle/fill generation
    format.ts                   # shared formatters (USD, price, pct, date/time)
    wagmi.ts                    # wagmi config — Ink mainnet (chain 57073), injected connector
    nado/
      config.ts                 # real gateway + indexer endpoints, chain ID, verified addresses
      eip712.ts                 # order/MintNlp/BurnNlp/Cancellation signing domains, types,
                                 # subaccount encoding
      client.ts                 # query()/execute() against the real gateway (POST-based)
      indexer.ts                 # funding_rate / market_snapshots / candlesticks /
                                  # matches_and_liquidations / account trade history against the
                                  # real archive service (POST — a different wire format from
                                  # client.ts, to a different host)
      account.ts                 # subaccount_info + the position/equity/margin math derived
                                  # from it, the symbols query (product_id → ticker), NLP
                                  # price/supply/balance (NLP is just spot product 11), tx_nonce,
                                  # and per-product open orders (subaccount_orders)
      orderbook.ts                # market_liquidity → real bid/ask depth
      useLiveMarket.ts           # combines gateway + indexer into one hook: price, OI, funding,
                                  # 24h vol/change
      useLiveChart.ts             # candlestick history (real timeframe param) + recent-trades
                                   # tape, each its own hook
      useOrderBook.ts              # real order book, one hook, 3s refetch
      usePortfolio.ts             # subaccount_info + trade history + symbols, combined, for the
                                   # connected wallet
      useOpenOrders.ts              # subaccount_orders across BTC-PERP/ETH-PERP, merged
      useCancelOrder.ts              # signs + submits a real cancel_orders — unconfirmed, see below
      useNlpVault.ts               # NLP price/supply/TVL (no wallet needed) + your own balance
                                    # and locked/unlocked breakdown (needs one), for /vault
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
silently ignored), so a given timeframe's window is fixed at ~100 buckets of that size. The chart
now has a real, working timeframe selector — 1m/5m/15m/1H/4H/1D/1W, live-tested against
`candlesticks` for each one (30m/6h/12h are asked for too but return zero rows, so they're left
out rather than offered as dead buttons); every switch is a real refetch keyed by granularity, not
a client-side reslice of one fixed dataset. Recent trades come from `matches_and_liquidations` (`product_ids` — plural
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

The order `appendix` bitfield is backed by Nado/Vertex-family documentation: not isolated, order
type 0 (DEFAULT/standard limit), not reduce-only, no trigger, i.e. exactly the plain limit order
`OrderForm` places — except the version sub-field itself has since had to change. Documentation
said version 0; a real order against a real funded account (post subaccount-encoding fix) got
rejected with `"Invalid Order Version: the order version in the appendix, 0, does not match the
expected version: 1"` — confirmed live (not just read off the error message) by reproducing the
exact rejection with `appendix=0` and a throwaway signature, then clearing it with `appendix=1`,
which moved on to an unrelated later validation stage instead. Nado bumped the required version
sometime between this integration's first real order test (which got a real, well-formed
"insufficient collateral" response using version 0) and this one — a concrete reminder that this
kind of encoding constant isn't a "verify once and forget" fact, since the live protocol itself
can move underneath a client that was correct when it was written. The fix itself is verified
live (not guessed from the error text); a full real order with the corrected version hasn't been
retried yet at the time of this note, so "does a real order actually fill/rest now" is still the
next thing to confirm, not something this fix alone proves.

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

Three corrections along the way, all found by a real-money mint attempt against a funded account —
two bugs stacked, and fixing the first is what surfaced the second. First, `nadoExecute`/
`nadoQuery` called `res.json()` unconditionally — but not every gateway error is the
`{status:"failure",...}` JSON envelope; a malformed payload gets a plain-text 4xx body instead
(e.g. "Failed to deserialize..."), and `res.json()` on that throws an opaque "Unexpected token"
`SyntaxError` that hides the real message. Fixed to read the body as text first and only parse it
as JSON if it looks like JSON.

Second, the bug that error handling had been hiding: `mint_nlp`/`burn_nlp`'s execute payload needs
`{tx: {sender, quoteAmount, nonce}, signature}`, a nested `tx` object, not the flat `{sender,
quoteAmount, nonce, signature}` the code was sending — discovered the same empirical way as
everything else in this file (probe with a deliberately incomplete body, follow the "missing
field" errors one at a time), confirmed against the live gateway by sending a full payload with a
dummy signature and getting all the way to a real, well-formed `"malformed signature"` rejection
instead of a deserialize error. `place_order`'s shape was already correct (it round-tripped
successfully earlier), so this was `mint_nlp`/`burn_nlp`-specific.

Third — with the payload shape fixed, a real mint attempt against a funded account got past
signature validation and reached a real on-chain rejection: `"Invalid nonce: expected: 0"`. The
gateway's `nonces` query (param `address` — the plain 20-byte owner address, not an encoded
subaccount, unlike every other account query here) returns *two* independent counters per owner:
`order_nonce`, a large timestamp-shaped value used by `place_order`, and `tx_nonce`, a small
strictly-sequential counter (0, 1, 2, ...) required by every execute that wraps its payload in a
`tx` object. `NlpVaultForm` was generating a timestamp-shaped nonce for a field that needed to
equal the account's current `tx_nonce` exactly — fixed by fetching it fresh from `nonces`
(`account.ts`'s `getTxNonce`) immediately before signing, rather than generating one.

The order nonce turned out to have real internal structure too, which this file previously got
wrong (it claimed any value "greater than last used" works — it doesn't). Its top 44 bits are a
millisecond `recv_time` timestamp and its low 20 bits are random: decoded straight out of real
order nonces in live gateway/indexer data, every one of which shifts down (`>> 20`) to exactly
the wall-clock moment that order was placed. The old `Date.now() * 1000 + jitter` produced the
right *magnitude* but the wrong *shape* — it decoded to a 1970 timestamp, so a real order got
`"Request received after 'recv_time'"`. `recv_time` is a deadline with a window on both sides,
mapped by probing the boundary live: the request is rejected if it arrives after it, and also if
it arrives more than 100 seconds before it. Since the nonce is signed *before* the wallet prompt
appears, that window is effectively the user's time to review and confirm — `generateNonce` uses
90s, taking nearly all of the 100s allowance in both directions (confirm instantly and it still
lands ~90s early, inside the cap; take up to ~90s and it still beats the deadline). An order left
sitting unconfirmed past that will fail and need re-signing, which `OrderForm` says up front
rather than letting it surface as a confusing gateway error.

With both fixes live, a real mint against a real funded account went through — the gateway
accepted it, no error, `nadoExecute` resolved successfully. Mint is confirmed working end to end,
not just mechanically. Burn hasn't been separately tested, but shares the identical `tx`-object
payload shape and the same `tx_nonce` fetch, so there's no known reason it would behave
differently — `BetaTradingWarning`'s vault copy reflects exactly this asymmetry (mint confirmed,
burn not yet tested but expected to work the same way).

A real burn attempt straight after that mint surfaced one more real (non-bug) behavior: it was
rejected with `"Do not have enough unlocked NLP"` even for an amount within the account's total
balance. `nlp_locked_balances` (param `subaccount`, the encoded form — unlike `nonces`, which
takes the plain address) explains why: newly-minted NLP sits locked with its own per-mint
`unlocked_at` cooldown timestamp, and only `balance_unlocked` is actually burnable — confirmed
against the real account, whose entire freshly-minted balance was 100% locked with a ~4-day
cooldown. `getNlpLockStatus` surfaces this on the vault page (`NlpVaultStats`) directly, so the
same rejection doesn't have to happen again to find out why.

That real $1 mint also surfaced a real cost worth calling out on its own: the account's quote
balance dropped by $2.00 for a $1.00 mint, and its total equity (the engine's own figure, not a
display artifact) dropped by $1.00 net. Pulled every `mint_nlp` event off the indexer across many
different real accounts (`event_types: ["mint_nlp"]`, no `subaccounts` filter) to check whether
this was account-specific — it wasn't: every real mint, from $1 to $20,000, has *exactly* $1.00
deducted beyond the NLP's fair value, a flat fee, not a percentage (negligible at $20,000, 100% of
the deposit at $1). `withdraw_fee_x18` — the config field that looked like the culprit, since its
value happens to be exactly 1.0 in Nado's 18-decimal convention — turned out to be a red herring:
confirmed against the SDK that it's decoded from the on-chain ABI but never actually consumed by
the TypeScript client for anything, mint_nlp included (`packages/shared/src/abis/SpotEngine.ts`,
`Querier.ts` — present in the raw struct, absent from `SpotProduct`, the SDK's own typed model).
What the SDK does confirm: `$1` is the protocol's literal minimum mint amount
(`MINT_NLP_AMOUNT_TOO_SMALL`, "below the 1 USDT0 minimum" —
`packages/engine-client/src/types/engineErrorCodes.ts`) — the test mint hit that floor exactly,
which is also almost exactly the flat fee, netting close to nothing. A separate, distinctly-named
burn-side fee is confirmed to exist too (`BURN_NLP_AMOUNT_TOO_SMALL`, "amount is less than or
equal to the burning fee") but its magnitude isn't exposed anywhere client-side — the actual fee
formula for either direction lives in Solidity contracts outside this SDK's repo, unreachable from
here. `NlpVaultForm` now warns in the mint flow: a persistent note that mint fees are flat (so
size matters), and a stronger inline warning once the entered amount is small enough that ~$1
would eat a meaningful share of it.

One correction from before that: gateway queries that take parameters (`subaccount_info`) turned
out to need POST `{type, ...params}` to `/query`, not the GET-with-querystring form `client.ts`
previously used for the zero-param `all_products` case — GET happened to also work live, but POST
is what Nado's own SDK actually sends, so `nadoQuery` now does that uniformly for every query.

The order book (`OrderBook`, `orderbook.ts`) is real, live-refetched every 3s: `market_liquidity`
(params `product_id`, `depth`) returns `[price_x18, size_x18]` tuples per side, already sorted
best-price-first — verified live that `depth` is a real, respected row-count limit (10 → exactly
10 rows, 50 → exactly 50), unlike `candlesticks`' silently-ignored `limit`.

Open orders (`/portfolio`, `OpenOrdersTable`) are real too, from `subaccount_orders` — confirmed
to be per-product (it errors for a missing `product_id` separately from a missing `sender`), so
unlike `subaccount_info` this has to be queried once per market; scoped to BTC-PERP/ETH-PERP,
the only markets this app can place orders in. `unfilled_amount`, not `amount`, is the real
remaining size, since a resting order can be partially filled without leaving the book — found by
inspecting a real order with actual resting size, not assumed. `order_type` comes back as an
already-decoded string ("post_only", etc.) rather than the raw `appendix` bitfield.

Cancel is real signing/submission, structurally: `cancel_orders` follows the same `{tx:{...},
signature}` wire shape as `mint_nlp`/`burn_nlp`, discovered the identical way (probe with an
incomplete body, follow "missing field" errors: `tx` → `sender` → `productIds` → `digests` →
`nonce` → `signature`, confirming the field is literally named `productIds`, camelCase, not
`product_ids`). The EIP-712 type was not guessed, though — confirmed against the SDK's
`getNadoEIP712Types.ts`: the primary type name is **`Cancellation`**, not the more obvious
`CancelOrders`, with `productIds` typed `uint32[]` specifically; verifies against the endpoint
contract, same domain as mint/burn, confirmed against `MarketExecuteAPI.ts`'s `cancelOrders()`.
Like mint/burn before their first real test, this hasn't actually been round-tripped against a
resting order yet — `PortfolioView` says so directly under "Open orders" rather than implying
it's confirmed because it looks the same as something that is.

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
