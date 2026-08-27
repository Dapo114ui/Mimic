import { nadoQuery } from "./client";
import { NADO_INDEXER_REST } from "./config";

// Every Nado perp market, assembled from four bulk calls rather than per-market ones. That
// matters: with ~75 perps, the obvious per-product approach (`funding_rate` and
// `market_snapshots` each take a single `product_id`) would mean ~150 requests to render one
// page. All four of these return every product at once:
//   symbols        (gateway)  real tickers + product ids + tick sizes + trading status
//   all_products   (gateway)  live oracle price + open interest
//   market_snapshots (indexer) 24h volume/change — omit product_id and the response's
//                              cumulative_volumes/oracle_prices maps cover all ~90 products
//   funding_rates  (indexer)  plural form, takes product_ids[] and returns a map
export type LiveMarket = {
  symbol: string;
  productId: number;
  price: number;
  change24hPct: number | null;
  volume24hUsd: number | null;
  fundingRatePct: number | null;
  openInterestUsd: number;
  isLive: boolean;
};

const fromX18 = (v: string) => Number(BigInt(v)) / 1e18;

type SymbolsResponse = {
  symbols: Record<
    string,
    { product_id: number; symbol: string; type: string; trading_status?: string }
  >;
};

type AllProductsResponse = {
  perp_products: { product_id: number; oracle_price_x18: string; state: { open_interest: string } }[];
};

type MarketSnapshot = {
  timestamp: number;
  cumulative_volumes: Record<string, string>;
  oracle_prices: Record<string, string>;
};

async function indexerQuery<T>(type: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(NADO_INDEXER_REST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [type]: params }),
  });
  if (!res.ok) throw new Error(`Nado indexer "${type}" failed: ${res.statusText}`);
  return (await res.json()) as T;
}

export async function getLiveMarkets(): Promise<LiveMarket[]> {
  const [symbolsRes, products] = await Promise.all([
    nadoQuery<SymbolsResponse>("symbols"),
    nadoQuery<AllProductsResponse>("all_products"),
  ]);

  const perpBySymbol = Object.values(symbolsRes.symbols).filter((s) => s.type === "perp");
  const productById = new Map(products.perp_products.map((p) => [p.product_id, p]));
  const perpIds = products.perp_products.map((p) => p.product_id);

  // These two are best-effort: the market list is still useful without funding or 24h figures,
  // so a failure here degrades those columns to "—" instead of emptying the whole page.
  const [snapshots, funding] = await Promise.all([
    indexerQuery<{ snapshots: MarketSnapshot[] }>("market_snapshots", {
      interval: { count: 25, granularity: 3600 },
    }).catch(() => null),
    indexerQuery<Record<string, { funding_rate_x18: string }>>("funding_rates", {
      product_ids: perpIds,
    }).catch(() => null),
  ]);

  let now: MarketSnapshot | undefined;
  let dayAgo: MarketSnapshot | undefined;
  if (snapshots && snapshots.snapshots.length >= 2) {
    now = snapshots.snapshots[0];
    const target = now.timestamp - 24 * 60 * 60;
    dayAgo = snapshots.snapshots.reduce((closest, s) =>
      Math.abs(s.timestamp - target) < Math.abs(closest.timestamp - target) ? s : closest
    );
  }

  const markets: LiveMarket[] = [];
  for (const s of perpBySymbol) {
    const product = productById.get(s.product_id);
    if (!product) continue; // listed as a symbol but not currently a tradeable perp product

    const price = fromX18(product.oracle_price_x18);
    const key = String(s.product_id);

    let volume24hUsd: number | null = null;
    let change24hPct: number | null = null;
    if (now && dayAgo && now.cumulative_volumes[key] && dayAgo.cumulative_volumes[key]) {
      volume24hUsd = Math.max(0, fromX18(now.cumulative_volumes[key]) - fromX18(dayAgo.cumulative_volumes[key]));
      const priceThen = fromX18(dayAgo.oracle_prices[key] ?? "0");
      const priceNow = fromX18(now.oracle_prices[key] ?? "0");
      if (priceThen > 0) change24hPct = ((priceNow - priceThen) / priceThen) * 100;
    }

    const rate = funding?.[key]?.funding_rate_x18;

    markets.push({
      symbol: s.symbol,
      productId: s.product_id,
      price,
      change24hPct,
      volume24hUsd,
      fundingRatePct: rate ? fromX18(rate) * 100 : null,
      openInterestUsd: fromX18(product.state.open_interest) * price,
      isLive: s.trading_status ? s.trading_status === "live" : true,
    });
  }

  return markets.sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
}
