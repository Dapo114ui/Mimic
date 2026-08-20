import { NADO_INDEXER_REST } from "./config";

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
