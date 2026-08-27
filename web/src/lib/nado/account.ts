import type { Address } from "viem";
import { nadoQuery } from "./client";
import { encodeSubaccount } from "./eip712";
import { NLP_PRODUCT_ID } from "./config";

// Real per-subaccount state from the gateway (`subaccount_info`) — confirmed against
// EngineQueryClient.getSubaccountSummary() in Nado's SDK (packages/engine-client/src). Every
// numeric field here, `_x18`-suffixed or not, is an 18-decimal fixed-point string: verified by
// checking real converted magnitudes against what an active account should plausibly look like
// (e.g. a `perp_balances[].balance.amount` of "3176150000000000000" is a nonsensical ~3.2e18 BTC
// unless divided by 1e18, at which point it's a completely ordinary 3.176 BTC position) — this
// contradicts an SDK-reading research pass that claimed non-`_x18` fields skip the ÷1e18 step;
// real observed numbers won here over that reading.
type PerpBalance = {
  product_id: number;
  balance: { amount: string; v_quote_balance: string; last_cumulative_funding_x18: string };
};

type PerpProductInfo = { product_id: number; oracle_price_x18: string };
type SpotBalance = { product_id: number; balance: { amount: string } };

type HealthGroup = { assets: string; liabilities: string; health: string };

type SubaccountInfoResponse = {
  exists: boolean;
  healths: [HealthGroup, HealthGroup, HealthGroup]; // [initial, maintenance, unweighted]
  perp_balances: PerpBalance[];
  perp_products: PerpProductInfo[];
  spot_balances: SpotBalance[];
};

const X18 = 1e18;
const fromX18 = (v: string) => Number(BigInt(v)) / X18;

export async function getSubaccountInfo(owner: Address): Promise<SubaccountInfoResponse> {
  const subaccount = encodeSubaccount(owner);
  return nadoQuery<SubaccountInfoResponse>("subaccount_info", { subaccount });
}

type NoncesResponse = { tx_nonce: string; order_nonce: string };

// Nado has two independent nonce counters per owner address (not per subaccount — confirmed by
// this query's own param, `address`, a plain 20-byte address, unlike every other account query
// here which takes an encoded 32-byte subaccount): `order_nonce`, a large timestamp-shaped value
// place_order already generates correctly (any greater value than last-used works), and
// `tx_nonce`, a small strictly-sequential counter (0, 1, 2, ...) required by every execute that
// wraps its payload in a `tx` object (mint_nlp, burn_nlp, ...). Discovered after a real mint_nlp
// attempt against a funded account was rejected on-chain with "Invalid nonce: expected: 0" —
// generateNonce()'s timestamp-based value is wrong for this class of execute; the correct value
// has to be read from here immediately before signing.
export async function getTxNonce(owner: Address): Promise<bigint> {
  const { tx_nonce } = await nadoQuery<NoncesResponse>("nonces", { address: owner });
  return BigInt(tx_nonce);
}

export type AccountSummary = {
  equityUsd: number;
  availableMarginUsd: number;
  marginRatioPct: number; // 0 = no margin used (safe), 100 = at the maintenance threshold (liquidatable)
  unrealizedPnlUsd: number;
};

export type OpenPosition = {
  productId: number;
  market: string;
  side: "Long" | "Short";
  sizeUsd: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnlUsd: number;
};

// PnL formula confirmed against Nado's own `calcPerpBalanceValue`
// (packages/shared/src/utils/balanceValue.ts): unrealizedPnl = amount * oraclePrice + vQuoteBalance.
// v_quote_balance already has settled funding folded in — no separate funding netting needed.
// entryPrice has no SDK helper; -vQuoteBalance/amount is the standard break-even-price-ignoring-
// funding derivation for this balance model.
export function derivePositions(info: SubaccountInfoResponse, symbolMap: Map<number, string>): OpenPosition[] {
  const priceByProduct = new Map(info.perp_products.map((p) => [p.product_id, fromX18(p.oracle_price_x18)]));

  return info.perp_balances
    .filter((b) => BigInt(b.balance.amount) !== 0n)
    .map((b): OpenPosition => {
      const amount = fromX18(b.balance.amount);
      const vQuote = fromX18(b.balance.v_quote_balance);
      const markPrice = priceByProduct.get(b.product_id) ?? 0;
      return {
        productId: b.product_id,
        market: symbolMap.get(b.product_id) ?? `Product #${b.product_id}`,
        side: amount >= 0 ? "Long" : "Short",
        sizeUsd: Math.abs(amount) * markPrice,
        entryPrice: amount !== 0 ? -vQuote / amount : 0,
        markPrice,
        unrealizedPnlUsd: amount * markPrice + vQuote,
      };
    });
}

// `healths` is server-computed from the same balances using each product's risk weights — using
// it directly avoids re-deriving Nado's own risk-weighting logic. health = assets - liabilities
// (verified against real numbers); group order [initial, maintenance, unweighted] is Vertex-
// lineage convention, confirmed against the SDK's EngineServerSubaccountInfoState type.
export function deriveAccountSummary(info: SubaccountInfoResponse, positions: OpenPosition[]): AccountSummary {
  const [initial, maintenance, unweighted] = info.healths;
  const equityUsd = fromX18(unweighted.health);
  const maintenanceHealthUsd = fromX18(maintenance.health);
  const marginRatioPct =
    equityUsd > 0 ? Math.max(0, Math.min(100, (1 - maintenanceHealthUsd / equityUsd) * 100)) : equityUsd < 0 ? 100 : 0;

  return {
    equityUsd,
    availableMarginUsd: Math.max(0, fromX18(initial.health)),
    marginRatioPct,
    unrealizedPnlUsd: positions.reduce((sum, p) => sum + p.unrealizedPnlUsd, 0),
  };
}

type SymbolsResponse = { symbols: Record<string, { product_id: number; symbol: string }> };

// Product-id → ticker, for every Nado market (not just BTC/ETH) — needed here because a real
// account's positions/trades can be in any of Nado's ~90 products, and silently hiding or
// mislabeling a position because it isn't in `KNOWN_PRODUCTS` would misrepresent a user's real
// money, unlike the market-list page where showing fewer markets is just an incomplete feature.
export async function getSymbolMap(): Promise<Map<number, string>> {
  const { symbols } = await nadoQuery<SymbolsResponse>("symbols");
  return new Map(Object.values(symbols).map((s) => [s.product_id, s.symbol]));
}

type SpotProductInfo = {
  product_id: number;
  oracle_price_x18: string;
  state: { total_deposits_normalized: string; cumulative_deposits_multiplier_x18: string };
};

type AllProductsResponse = { spot_products: SpotProductInfo[] };

export type NlpStats = { priceUsd: number; totalSupply: number; totalValueUsd: number };

// Total supply = normalized deposits × the deposit multiplier (a Compound-style exchange-rate
// accumulator that starts at 1.0 and grows as the vault earns — same shape as every other Nado
// spot-lending-market product, just reused for NLP's issuance accounting). Formula and NLP-price-
// is-just-oracle_price_x18 both confirmed against the SDK's own `calcTotalDeposited`
// (packages/shared/src/utils/interest.ts) and `mapEngineServerSpotProduct`
// (packages/engine-client/src/utils/queryDataMappers.ts) — no NLP-specific price/supply helper
// exists; NLP is mapped through the exact same generic spot-product path as any other product.
// An APR figure is deliberately not shown: the SDK's own depositor-APY formula
// (`calcRealizedDepositRateForTimeRange`) needs a protocol fee-share constant that has zero call
// sites anywhere in the SDK — there's no reliable source for it here, so it's omitted rather
// than guessed.
export async function getNlpStats(): Promise<NlpStats> {
  const { spot_products } = await nadoQuery<AllProductsResponse>("all_products");
  const product = spot_products.find((p) => p.product_id === NLP_PRODUCT_ID);
  if (!product) throw new Error("NLP product not found in all_products");

  const priceUsd = fromX18(product.oracle_price_x18);
  const totalSupply = fromX18(product.state.total_deposits_normalized) * fromX18(product.state.cumulative_deposits_multiplier_x18);

  return { priceUsd, totalSupply, totalValueUsd: totalSupply * priceUsd };
}

// A subaccount's NLP holding is just its spot balance for the NLP product — same field every
// other spot balance uses, nothing NLP-specific about reading it.
export function deriveNlpBalance(info: SubaccountInfoResponse): number {
  const balance = info.spot_balances.find((b) => b.product_id === NLP_PRODUCT_ID);
  return balance ? fromX18(balance.balance.amount) : 0;
}

type NlpBalanceEntry = { product_id: number; balance: { amount: string } };
type NlpLockEntry = { balance: NlpBalanceEntry; unlocked_at: number };
type NlpLockedBalancesResponse = {
  balance_locked: NlpBalanceEntry;
  balance_unlocked: NlpBalanceEntry;
  locked_balances: NlpLockEntry[];
};

export type NlpLock = { amount: number; unlocksAt: string };
export type NlpLockStatus = { lockedAmount: number; unlockedAmount: number; locks: NlpLock[] };

// Real cooldown after minting: a real burn attempt against a real, fully-minted balance was
// rejected with "Do not have enough unlocked NLP" even though the requested amount was well
// within the total held — `nlp_locked_balances` (param `subaccount`, the encoded 32-byte form,
// unlike `nonces`) is what actually explains that: newly-minted NLP sits in `locked_balances`
// with its own per-mint `unlocked_at` timestamp until a cooldown period passes, and only
// `balance_unlocked` is actually burnable. Each mint gets its own lock entry, so `locks` is an
// array, not a single date.
export async function getNlpLockStatus(owner: Address): Promise<NlpLockStatus> {
  const subaccount = encodeSubaccount(owner);
  const data = await nadoQuery<NlpLockedBalancesResponse>("nlp_locked_balances", { subaccount });
  return {
    lockedAmount: fromX18(data.balance_locked.balance.amount),
    unlockedAmount: fromX18(data.balance_unlocked.balance.amount),
    locks: data.locked_balances.map((l) => ({
      amount: fromX18(l.balance.balance.amount),
      unlocksAt: new Date(l.unlocked_at * 1000).toISOString(),
    })),
  };
}

type SubaccountOrderRow = {
  price_x18: string;
  amount: string;
  unfilled_amount: string;
  order_type: string;
  expiration: string;
  placed_at: number;
  digest: string;
};

type BulkOrdersResponse = {
  product_orders: { product_id: number; orders: SubaccountOrderRow[] }[];
};

export type OpenOrder = {
  productId: number;
  market: string;
  side: "Long" | "Short";
  price: number;
  size: number;
  orderType: string;
  placedAt: string;
  expiresAt: string;
  digest: string;
};

// Resting orders across every market in one call. The singular `subaccount_orders` query takes
// one `product_id`, which would mean ~75 requests now that all of Nado's markets are listed; the
// plural `orders` query takes `product_ids[]` and returns a `product_orders` array instead.
//
// The indexer has an `orders` query too, but it is NOT a substitute: it returns order *history*
// (every row carries fills, realized_pnl, closed_amount) and omits never-filled orders entirely —
// checked against an account where the gateway reported 2 resting orders on one product while
// the indexer returned 100 rows, none of them unfilled. Only the gateway sees the live book.
//
// `unfilled_amount` (not `amount`) is the real remaining size, since a resting order can be
// partially filled without leaving the book. `order_type` arrives already decoded ("post_only",
// "default", …) rather than as the raw `appendix` bitfield.
export async function getAllOpenOrders(
  owner: Address,
  productIds: number[],
  symbolMap: Map<number, string>
): Promise<OpenOrder[]> {
  if (productIds.length === 0) return [];
  const sender = encodeSubaccount(owner);
  const { product_orders } = await nadoQuery<BulkOrdersResponse>("orders", {
    sender,
    product_ids: productIds,
  });

  return product_orders
    .flatMap(({ product_id, orders }) =>
      orders.map((o) => {
        const amount = fromX18(o.amount);
        return {
          productId: product_id,
          market: symbolMap.get(product_id) ?? `Product #${product_id}`,
          side: amount >= 0 ? ("Long" as const) : ("Short" as const),
          price: fromX18(o.price_x18),
          size: Math.abs(fromX18(o.unfilled_amount)),
          orderType: o.order_type,
          placedAt: new Date(o.placed_at * 1000).toISOString(),
          expiresAt: new Date(Number(o.expiration) * 1000).toISOString(),
          digest: o.digest,
        };
      })
    )
    .sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1));
}
