import { NADO_INDEXER_REST } from "./config";
import type { Candle, Fill } from "@/lib/types";

type IndexerResponse<T> = T | { reason: string; block: true };

// Unlike the gateway's GET-based query()/execute(), the archive/indexer service takes every
// request as POST to its bare versioned URL (no extra path segment) with a `{[type]: params}`
// body — verified against packages/indexer-client/src/IndexerBaseClient.ts in the SDK, and
// against a live call (a first attempt at `${url}/query` 404'd; this is what actually works).
async function nadoIndexerQuery<T>(type: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(NADO_INDEXER_REST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [type]: params }),
  });
  const json = (await res.json()) as IndexerResponse<T>;
  if (!res.ok || (typeof json === "object" && json !== null && "block" in json)) {
    const reason = typeof json === "object" && json !== null && "reason" in json ? json.reason : res.statusText;
    throw new Error(`Nado indexer query "${type}" failed: ${reason}`);
  }
  return json as T;
}

type FundingRateResponse = { product_id: number; funding_rate_x18: string; update_time: string };

// A real instantaneous rate, not the cumulative accumulator `all_products` exposes — this is
// the dedicated query for exactly this value.
export async function getFundingRatePct(productId: number): Promise<number> {
  const data = await nadoIndexerQuery<FundingRateResponse>("funding_rate", { product_id: productId });
  return (Number(BigInt(data.funding_rate_x18)) / 1e18) * 100;
}

type MarketSnapshot = {
  timestamp: number;
  cumulative_volumes: Record<string, string>;
  oracle_prices: Record<string, string>;
};

type MarketSnapshotsResponse = { snapshots: MarketSnapshot[] };

export type Market24hStats = { volume24hUsd: number; change24hPct: number };

// Hourly snapshots for slightly over a day, then diff "now" against whichever point lands
// closest to exactly 24h back — the archive service only offers fixed-boundary snapshots
// (hourly/daily), not an arbitrary rolling window, so this is the closest approximation to a
// true rolling 24h figure available from it.
export async function getMarket24hStats(productId: number): Promise<Market24hStats> {
  const { snapshots } = await nadoIndexerQuery<MarketSnapshotsResponse>("market_snapshots", {
    product_id: productId,
    interval: { count: 25, granularity: 3600 },
  });
  if (snapshots.length < 2) throw new Error("Not enough snapshot history for a 24h figure");

  const now = snapshots[0];
  const targetTs = now.timestamp - 24 * 60 * 60;
  const dayAgo = snapshots.reduce((closest, s) =>
    Math.abs(s.timestamp - targetTs) < Math.abs(closest.timestamp - targetTs) ? s : closest
  );

  const key = String(productId);
  const volumeNow = Number(BigInt(now.cumulative_volumes[key])) / 1e18;
  const volumeThen = Number(BigInt(dayAgo.cumulative_volumes[key])) / 1e18;
  const priceNow = Number(BigInt(now.oracle_prices[key])) / 1e18;
  const priceThen = Number(BigInt(dayAgo.oracle_prices[key])) / 1e18;

  return {
    volume24hUsd: Math.max(0, volumeNow - volumeThen),
    change24hPct: priceThen > 0 ? ((priceNow - priceThen) / priceThen) * 100 : 0,
  };
}

type CandlestickRow = {
  timestamp: string;
  open_x18: string;
  high_x18: string;
  low_x18: string;
  close_x18: string;
};

type CandlesticksResponse = { candlesticks: CandlestickRow[] };

// Real OHLC history. The archive has no count/range param for this query (confirmed by probing
// with a `limit` field, which is silently ignored) — it just returns its fixed window, ~100
// most-recent buckets at the given granularity, newest first; reversed here since chart series
// need ascending time order. `time` comes back as a unix-second number, not the "YYYY-MM-DD"
// string a chart lib might expect — fine, `Candle.time` accepts both, and
// `CandlestickChart` casts to lightweight-charts' `Time` type at the point it's actually used.
export async function getLiveCandles(productId: number, granularitySec = 3600): Promise<Candle[]> {
  const { candlesticks } = await nadoIndexerQuery<CandlesticksResponse>("candlesticks", {
    product_id: productId,
    granularity: granularitySec,
  });
  return candlesticks
    .map((c) => ({
      time: Number(c.timestamp),
      open: Number(BigInt(c.open_x18)) / 1e18,
      high: Number(BigInt(c.high_x18)) / 1e18,
      low: Number(BigInt(c.low_x18)) / 1e18,
      close: Number(BigInt(c.close_x18)) / 1e18,
    }))
    .sort((a, b) => a.time - b.time);
}

type MatchRow = { base_filled: string; quote_filled: string; submission_idx: string; is_taker: boolean };
type TxRow = { submission_idx: string; timestamp: string };
type MatchesAndLiquidationsResponse = { matches: MatchRow[]; txs: TxRow[] };

// Real trade tape. `matches` (one row per side of a fill — taker leg and maker leg share a
// `submission_idx`) carries no wall-clock time on its own; `matches_and_liquidations` also
// returns a `txs` array with one row per trade that does — `submission_idx` is the join key
// between the two (verified 1:1 against a live response), exactly the pattern Nado's own SDK
// uses internally (`IndexerBaseClient.getMatchEvents`). Only the taker leg is kept, since a
// trade tape shows one row per trade, not per side.
export async function getRecentTrades(productId: number, limit = 40): Promise<Fill[]> {
  const { matches, txs } = await nadoIndexerQuery<MatchesAndLiquidationsResponse>("matches_and_liquidations", {
    product_ids: [productId],
    limit,
  });

  const timestampByIdx = new Map(txs.map((tx) => [tx.submission_idx, Number(tx.timestamp)]));

  return matches
    .filter((m) => m.is_taker && timestampByIdx.has(m.submission_idx))
    .map((m) => {
      const baseFilled = Number(BigInt(m.base_filled)) / 1e18;
      const quoteFilled = Number(BigInt(m.quote_filled)) / 1e18;
      const ts = timestampByIdx.get(m.submission_idx)!;
      return {
        side: baseFilled >= 0 ? ("Long" as const) : ("Short" as const),
        price: Math.abs(quoteFilled / baseFilled),
        sizeUsd: Math.abs(quoteFilled),
        timestamp: new Date(ts * 1000).toISOString(),
      };
    })
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export type AccountTrade = {
  market: string;
  side: "Long" | "Short";
  sizeUsd: number;
  pnlUsd: number;
  pnlPct: number;
  closedAt: string;
};

type AccountMatchRow = {
  base_filled: string;
  quote_filled: string;
  realized_pnl: string;
  submission_idx: string;
  post_balance: { base: { perp: { product_id: number } } | null };
};

type MatchesResponse = { matches: AccountMatchRow[]; txs: TxRow[] };

// One specific account's fill history — the market-wide `getRecentTrades` above keeps only the
// taker leg per trade (to dedupe two rows into one), but here every row IS this account's own
// distinct fill (as maker or taker), so all of them are kept. `realized_pnl` comes straight from
// the protocol's own accounting per fill — not recomputed here — and product/market comes from
// `post_balance.base.perp.product_id`, the same field Nado's own SDK derives it from
// (`IndexerBaseClient.getMatchEvents`), since match rows carry no direct product_id field.
export async function getAccountTradeHistory(
  subaccountHex: string,
  symbolMap: Map<number, string>,
  limit = 30
): Promise<AccountTrade[]> {
  const { matches, txs } = await nadoIndexerQuery<MatchesResponse>("matches", {
    subaccounts: [subaccountHex],
    limit,
  });

  const timestampByIdx = new Map(txs.map((tx) => [tx.submission_idx, Number(tx.timestamp)]));

  return matches
    .filter((m) => m.post_balance.base?.perp && timestampByIdx.has(m.submission_idx))
    .map((m) => {
      const baseFilled = Number(BigInt(m.base_filled)) / 1e18;
      const quoteFilled = Number(BigInt(m.quote_filled)) / 1e18;
      const realizedPnl = Number(BigInt(m.realized_pnl)) / 1e18;
      const productId = m.post_balance.base!.perp.product_id;
      const ts = timestampByIdx.get(m.submission_idx)!;
      const notional = Math.abs(quoteFilled);
      return {
        market: symbolMap.get(productId) ?? `Product #${productId}`,
        side: baseFilled >= 0 ? ("Long" as const) : ("Short" as const),
        sizeUsd: notional,
        pnlUsd: realizedPnl,
        pnlPct: notional > 0 ? (realizedPnl / notional) * 100 : 0,
        closedAt: new Date(ts * 1000).toISOString(),
      };
    })
    .sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1));
}
