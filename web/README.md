# Nadoterminal — web

**Live:** [nadoterminal.xyz](https://nadoterminal.xyz)

A market data, order-placement, and portfolio dashboard for [Nado](https://www.nado.xyz/).
Next.js (App Router) + Tailwind CSS v4 + wagmi/viem for wallet connection and order signing,
[lightweight-charts](https://github.com/tradingview/lightweight-charts) for the candlestick chart.

## Pages

- **`/`** — live watchlist of **every** perp market on Nado (~75): price, 24h change, volume,
  funding, open interest, searchable and sortable. All real, no sample rows.
- **`/markets/[symbol]`** — one market: live header and stats (price, 24h change, volume, open
  interest, funding, maker/taker fees), candlestick chart with a real 1m–1W timeframe selector,
  live order book, order entry, and a live recent-trades tape. Works for any market Nado lists —
  the product id is resolved from Nado's own `symbols` query at runtime, so a market added later
  needs no code change.
- **`/portfolio`** — the connected wallet's real Nado account: equity, available margin, margin
  ratio, unrealized PnL, open positions, open orders (with cancel), and fill history. Nothing
  here is sample data — if there's no wallet connected, or the connected wallet has no Nado
  account yet, the page says so rather than showing a placeholder account.
- **`/vault`** — mint/burn Nado's own native liquidity vault (NLP) — not a Nadoterminal product,
  reached directly through Nado's gateway. Real NLP price, total supply, TVL, and (once
  connected) your own NLP balance, lock status, and measured mint/burn fees. Mint and burn are
  both confirmed working end to end.

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
                               # LiveMarketPanel, MarketDetail, LiveMarketsTable,
                               # BetaTradingWarning, SideBadge
    portfolio/                 # PortfolioView (the /portfolio page body), OpenOrdersTable,
                                # PendingTriggerOrders (TP/SL, explicit-refresh not polled),
                                # AccountSummaryLink (the homepage "Your account" card) — real, client
    vault/                      # NlpVaultStats (price/supply/TVL/your balance) — real, client
    Navbar.tsx, Footer.tsx, ConnectButton.tsx, Providers.tsx
  lib/
    types.ts                    # shared Candle / Fill shapes
    format.ts                   # shared formatters (USD, price, pct, date/time)
    wagmi.ts                    # wagmi config — Ink mainnet (chain 57073), injected connector
    nado/
      config.ts                 # real gateway + indexer endpoints, chain ID, verified addresses
      eip712.ts                 # order/MintNlp/BurnNlp/Cancellation/ListTriggerOrders signing
                                 # domains, types, subaccount encoding, buildAppendix() (order
                                 # type, reduce-only, trigger type, composable)
      client.ts                 # query()/execute() against the real gateway (POST-based)
      triggerClient.ts           # query()/execute() against the separate trigger service
                                  # (trigger.prod.nado.xyz) — same wire shape as client.ts
      triggerOrders.ts            # TP/SL business logic: place/cancel/list trigger orders,
                                   # the long/short-aware price-requirement direction, the
                                   # slippage-capped execution price for a triggered order
      useTriggerOrders.ts          # place-on-demand (not polled — see below), list, cancel
      indexer.ts                 # funding_rate / market_snapshots / candlesticks /
                                  # matches_and_liquidations / account trade history against the
                                  # real archive service (POST — a different wire format from
                                  # client.ts, to a different host)
      account.ts                 # subaccount_info + the position/equity/margin math derived
                                  # from it, the symbols query (product_id → ticker), NLP
                                  # price/supply/balance (NLP is just spot product 11), tx_nonce,
                                  # and open orders across all markets (bulk `orders` query)
      orderbook.ts                # market_liquidity → real bid/ask depth
      useLiveMarket.ts           # combines gateway + indexer into one hook: price, OI, funding,
                                  # 24h vol/change
      useLiveChart.ts             # candlestick history (real timeframe param) + recent-trades
                                   # tape, each its own hook
      useOrderBook.ts              # real order book, one hook, 3s refetch
      usePortfolio.ts             # subaccount_info + trade history + symbols, combined, for the
                                   # connected wallet
      markets.ts                   # every Nado perp market, assembled from 4 bulk calls
      useLiveMarkets.ts             # the market list, for the home page and symbol resolution
      fees.ts / useFeeRates.ts       # real per-account trading + flat fee schedule
      useOpenOrders.ts              # resting orders across every market, one call
      useCancelOrder.ts              # signs + submits a real cancel_orders — confirmed working
      useNlpVault.ts               # NLP price/supply/TVL (no wallet needed) + your own balance
                                    # and locked/unlocked breakdown (needs one), for /vault
```

## Everything here is real data

There is no sample data left. `lib/markets.ts` — a hand-written list of six markets with invented
prices, four of which (SOL, ARB, OP, DOGE) weren't wired to anything — has been deleted, along
with its seeded candle/fill generators and the `SampleDataBanner` that labelled them. The market
list now comes from Nado itself (`lib/nado/markets.ts`).

That mattered more than it sounds: the homepage was the front door, and it showed six markets
with authoritative-looking prices that were all wrong (BTC at $98,650 while the real market was
~$79k). A banner said "sample data", but a price table on a trading site is read as fact.

Assembling ~75 markets naively would mean ~150 requests, since `funding_rate` and
`market_snapshots` each take a single `product_id`. Four bulk calls cover it instead:
`symbols` and `all_products` (gateway) for tickers, prices and open interest;
`market_snapshots` with **no** `product_id` — its `cumulative_volumes`/`oracle_prices` maps then
span all ~90 products at once; and `funding_rates` (plural), which takes `product_ids[]`. The two
indexer calls are best-effort, so a failure degrades those columns to "—" rather than emptying
the page.

`lib/nado/` is **real, and targets mainnet**: verified against Nado's actual TypeScript SDK
([nadohq/nado-typescript-sdk](https://github.com/nadohq/nado-typescript-sdk)) and live-tested
against `gateway.prod.nado.xyz` from this environment — endpoints, EIP-712 domains/types for
`place_order`/`mint_nlp`/`burn_nlp`, and the `endpoint` (sequencer) contract address all came
from the SDK source or a live API response, not invented.

Market coverage was for a long time limited to BTC-PERP/ETH-PERP, because `all_products` carries
no ticker field and those two were the only product ids identifiable from price alone (plus
product 3's spot token being `0x4200...0006`, the WETH predeploy every OP-Stack chain shares).
The `symbols` query solved that — it returns real ticker names for every product — and every
market is now listed and tradeable through it.

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

The candlestick chart and recent-trades tape are real too, for every market, from the same
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
site shows for that wallet. The write side has since been confirmed too — a real order placed,
rested and cancelled, and a real NLP mint and burn — all covered further down. `OrderForm` and
`NlpVaultForm` still carry a `BetaTradingWarning`, now covering the fee economics rather than
unverified signing: the honesty boundary lives in the UI, not just in this file.

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

Past that, the next real order surfaced a plain arithmetic bug of this codebase's own making —
not a protocol quirk. Scaling a user's input with `BigInt(Math.round(value * 1e18))` looks
harmless but float64 has ~15-17 significant digits and an 18-decimal-scaled price needs far more,
so the low digits were silently garbage: a clean price of `79064` went out as
`79063999999999993708544` and the gateway rejected it as "not divisible by the
`price_increment_x18`". The input was valid; the arithmetic wasn't — worth stressing because the
error message points at the price, which makes it read like user error. Both `OrderForm` and
`NlpVaultForm` now scale with viem's `parseUnits(str, 18)` straight off the input string, with no
float step anywhere: exact for every case checked (`79064`, `1.1`, `0.001`, `0.00005`, `0.3`),
where the old path was wrong for `79064` and `1.1` among others. Re-verified end to end by
replaying the exact rejected order (0.001 @ 79064) against the live gateway with the corrected
scaling — it now clears every validation stage and stops only at signature verification, which is
as far as an unsigned probe can reach.

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
equal to the burning fee"). Neither magnitude is exposed by any query — the fee logic lives in
Solidity outside the SDK's repo — so both were measured from real transactions instead, read off
the indexer's own `events` ledger for the account:

```
deposit_collateral  quote  0.000000 -> 5.000000   (+5.000000)
mint_nlp            quote  5.000019 -> 3.000019   (-2.000000)   for ~$1.00 of NLP
mint_nlp            NLP    0.000000 -> 0.938700   (+0.938700)
burn_nlp            quote  3.000210 -> 2.003271   (-0.996939)
burn_nlp            NLP    0.938700 -> 0.000000   (-0.938700)
```

So: **minting cost $1.00 in fees; burning cost $2.00** — the burn destroyed ~$1.00 of NLP *and*
took a further ~$1.00 out of quote. A $1 mint-then-burn round trip cost **$3.00 total**, taking a
$5.00 balance to $2.00. Both fees are flat, not proportional: immaterial on a large position,
ruinous on a small one.

One thing deliberately not modelled: the rejection threshold and the actual charge disagree. A
0.9 NLP (~$0.96) burn was rejected as "less than or equal to the burning fee", while 0.9387 NLP
(~$1.00) was accepted and then charged $2.00 — so the minimum-size check and the fee itself use
different constants. Both are invisible from outside, so `NlpVaultForm` states the observed
numbers and their provenance rather than a tidy formula that can't be verified.

One correction from before that: gateway queries that take parameters (`subaccount_info`) turned
out to need POST `{type, ...params}` to `/query`, not the GET-with-querystring form `client.ts`
previously used for the zero-param `all_products` case — GET happened to also work live, but POST
is what Nado's own SDK actually sends, so `nadoQuery` now does that uniformly for every query.

The order book (`OrderBook`, `orderbook.ts`) is real, live-refetched every 3s: `market_liquidity`
(params `product_id`, `depth`) returns `[price_x18, size_x18]` tuples per side, already sorted
best-price-first — verified live that `depth` is a real, respected row-count limit (10 → exactly
10 rows, 50 → exactly 50), unlike `candlesticks`' silently-ignored `limit`.

Open orders (`/portfolio`, `OpenOrdersTable`) are real too, covering every market in one call via
the gateway's plural `orders` query (see the note further down on why the singular
`subaccount_orders` and the indexer's same-named query both fall short).
`unfilled_amount`, not `amount`, is the real
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

The shared payload shape then produced one genuinely wrong inference: because `cancel_orders`
looks like `mint_nlp`/`burn_nlp` on the wire, this code originally used their sequential
`tx_nonce` too. It doesn't — `cancel_orders` takes the ORDER-style recv_time-encoded nonce. A
real cancel on a real resting order failed with "Request received after 'recv_time'" (the
account's actual `tx_nonce` of `1` decodes as a 1970 timestamp). Verified both ways live against
that same resting order before changing anything: `tx_nonce` reproduces the exact rejection, a
recv_time nonce clears through to signature verification. The lesson worth keeping: **payload
shape does not predict nonce class**, and three of this integration's bugs came from inferring
one unverified property from a neighbouring verified one.

With that fixed, the full order lifecycle is confirmed end to end on mainnet: place → rest on the
real book → read back through `subaccount_orders` → cancel → gone. Verified independently from
the gateway rather than from this app's own UI (order count 1 → 0, no position opened, equity
unchanged at ~$4.00 across the round trip).

Open orders needed rethinking once every market was listed: the gateway's `subaccount_orders`
takes one `product_id`, which would be ~75 requests. The plural `orders` query takes
`product_ids[]` and returns a `product_orders` array — one call for the whole book. The
indexer's own `orders` query is *not* a substitute despite the name: it returns order history
(every row carries fills and realized PnL) and omits never-filled orders entirely — verified
against an account where the gateway reported 2 resting orders on a product while the indexer
returned 100 rows, none unfilled. Only the gateway sees the live book.

`formatDateTime` pins `timeZone: "UTC"` to avoid SSR/hydration mismatches. That class of bug is
mostly moot now — every data path fetches client-side inside `"use client"` components, so
there's no server render to diverge from — but the pin costs nothing and the failure mode is
obscure enough to be worth keeping.

`OrderForm` places market orders now, not just limit — Nado's own UI offers Market/Limit/Advanced
tabs; this app matches the first two. The `appendix` bitfield's 2-bit order-type field (bits 9-10)
has two directly-confirmed values: every plain order this form has ever placed used `appendix=1`
(order type 0) and came back `order_type: "default"`; a real resting order was separately observed
with `order_type: "post_only"` *and* `appendix: "1537"` in the same gateway response — 1537 =
version(1) | 3<<9, confirming both the bit position and that order type 3 is post-only. The other
two values (1, 2) are inferred, not directly observed on any account this session has touched:
Nado is a Vertex protocol fork (already relied on elsewhere here — the `Cancellation` EIP-712 type
name, the `[initial, maintenance, unweighted]` health group order) and Vertex's own `OrderType`
enum is exactly `{DEFAULT, IOC, FOK, POST_ONLY}` in that order, which matches both confirmed
endpoints exactly. IOC (immediate-or-cancel — cross whatever's available right now, cancel the
rest instead of resting) is the standard way this family of CLOB implements "market" orders, so
that's what a market order here submits (`APPENDIX.IOC` in `eip712.ts`).

`appendix=513` (IOC) has since been confirmed live, using the same throwaway-signature replay
technique this file has relied on all along: a real `place_order` — a real product, a real
sender, a real nonce/expiration, and a price computed by this app's own `marketLimitPriceX18`
against BTC-PERP's real live order book — signed by an unrelated, freshly generated key and
submitted straight to the gateway. It came back `"The provided signature does not match with
the sender's or the linked signer's"` (error_code 2028) — the exact stage a fully valid order
would also have to clear, not an order-type or version complaint. A control run, same
throwaway-signing shape but a deliberately wrong appendix (version 99 instead of 1), came back
`"Invalid Order Version"` instead — proving appendix content is validated *before* that signer
check, so IOC sailing through it means order type 1 is genuinely accepted, not merely unreached.
Both sides were checked (buy against the real best ask, sell against the real best bid), and both
cleared to the same signer-mismatch stage. What that still doesn't confirm is Nado's own runtime
*behavior* for it — whether it truly fills-and-cancels rather than resting — since that needs a
real wallet to actually sign and a real fill or cancellation to observe, which this sandbox has
no way to do (see the `OrderBook`/candlestick note above on why: the sandboxed headless Chromium
can't reach either Nado service through this environment's outbound proxy at all, so this
"submit a real payload with a throwaway signature straight to the gateway" method is what real
verification looks like here, not a UI screenshot).

A market order still needs *a* price to sign, since the order struct has no separate
"market" flag — Vertex-family CLOBs implement it as an aggressively-priced limit order with an
IOC time-in-force. This app computes that price client-side: best available book level
(`market_liquidity`, depth 1, on whichever side the order crosses) plus/minus a 1% slippage cap,
rounded to the product's real `price_increment_x18` tick size. All of that arithmetic
(`marketLimitPriceX18` in `OrderForm.tsx`) stays in BigInt, never float — the same corruption a
real limit order hit once already (a clean price of 79064 went out as
79063999999999993708544 via `Number(x) * 1e18`, rejected as "not divisible by the
price_increment_x18") would reappear here if the book price were rounded through `Number` before
being scaled. The 1% cap is this app's own choice, not something read off Nado — Nado's UI doesn't
expose a number for it, and there's no query that would reveal one; it exists only so a thin book
can't make an IOC "market" order chase price arbitrarily far before giving up and cancelling the
remainder. `price_increment_x18` itself is real, though: it was already sitting unused in the
`symbols` gateway response (`getLiveMarkets` now threads it through as `LiveMarket.priceIncrementX18`,
a raw BigInt for the same exact-math reason).

One consequence worth calling out: a market order always takes, never rests, so it only ever pays
the taker fee rate — `OrderForm` drops the maker-fee line entirely when the Market tab is active
rather than showing a maker rate that order type can never actually earn.

`OrderForm` now has Reduce Only and TP/SL too, closing the last visible gap against Nado's own
order form. Unlike the market-order work above, this wasn't reverse-engineered from live
probing — Nado's own docs (docs.nado.xyz) turned out to have a complete, current Order Appendix
spec, found while researching an unrelated builder-fee question. It confirms, word for word, what
this codebase had already independently verified live: orderType `{0:DEFAULT, 1:IOC, 2:FOK,
3:POST_ONLY}`, and adds two fields that weren't needed until now — reduceOnly (bit 11, a plain
flag) and a 2-bit trigger type (`{0:NONE, 1:PRICE, 2:TWAP, 3:TWAP_CUSTOM_AMOUNTS}`) at bits
12-13. `buildAppendix()` in `eip712.ts` replaced the old flat `APPENDIX.DEFAULT/IOC/FOK/POST_ONLY`
constants with a composable version so these can combine with order type instead of only ever
appearing alone.

TP/SL turned out to be a materially bigger integration than a bitfield, though: trigger orders
(stop, take-profit, TWAP) don't go through the gateway at all — they're a genuinely separate
service, `https://trigger.prod.nado.xyz/v1`, with its own `/execute` and `/query` endpoints
(`triggerClient.ts`, mirroring `client.ts`'s request/response shape exactly since the wire format
turned out identical). Placing one signs the *same* `Order` EIP-712 type through the *same*
per-product domain the gateway uses — confirmed live, not assumed, by replaying a throwaway-signed
trigger `place_order` (reduce-only + price-trigger appendix) straight at that endpoint and getting
the same "signer does not match" rejection a fully valid order would, the identical technique
used earlier for the market-order appendix. That same probe resolved a real discrepancy between
two of Nado's own doc pages: the general Order Appendix page's manual bit-math example uses
version 1 for every appendix, but the separate Trigger > Place Order page's own example hardcodes
"version 0" for trigger orders specifically — stale, from before the same version bump this
codebase already had to work around once for the gateway (that page is stamped "updated 9 months
ago"). Version 1 reached the same signer-mismatch stage live; version 0 was never tested against
production since the general spec page — the one that's current — already said 1.

Viewing and cancelling pending TP/SL orders needed a new EIP-712 type, `ListTriggerOrders`
(`sender`, `recvTime`), signed against the same endpoint domain everything except place_order
uses. One real constraint this surfaced: unlike the gateway's open-orders query, listing trigger
orders requires a *freshly signed* transaction every single call — the `recvTime` deadline can't
be more than 100 seconds out. `useOpenOrders` polls silently every 10s; doing that here would mean
a wallet signature popup every few seconds, which is why `useTriggerOrders` deliberately doesn't
auto-poll — it loads once on mount and otherwise waits for an explicit Refresh click
(`PendingTriggerOrders`, under Portfolio).

Placing a TP/SL order is, structurally, placing an *additional*, fully independent order per
leg: a reduce-only, IOC, price-triggered `Order` closing the full position in the opposite
direction once triggered, each needing its own nonce and its own wallet signature — so setting
both take-profit and stop-loss on one trade means up to three separate signature prompts (the
main order, then each leg), and the form's copy says so rather than surprising the user with a
third popup. The triggered order still needs a real limit price to execute at once it fires, and
there's no live order book to check against ahead of time the way a market order can — so
`triggerExecutionPriceX18` applies the same fixed 1% slippage cap past the trigger price itself
that the market-order path applies past the live best bid/ask, tick-rounded the same exact-BigInt
way.

What isn't verified yet, and can't be from this sandbox any more than the market order's fill
semantics could: whether a placed trigger order actually fires and closes the position when its
price condition is hit. That needs a real wallet, a real open position, and either patience or a
price move — the natural next check once this is used for real, the same honest gap the market
order work left open.

## Usage

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npx eslint src
```
