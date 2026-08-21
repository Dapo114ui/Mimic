import { nadoQuery } from "./client";

type MarketLiquidityResponse = { bids: [string, string][]; asks: [string, string][] };

export type OrderBookLevel = { price: number; size: number };
export type OrderBook = { bids: OrderBookLevel[]; asks: OrderBookLevel[] };

const X18 = 1e18;
const fromX18 = (v: string) => Number(BigInt(v)) / X18;

// Real depth from the gateway's `market_liquidity` query — `[price_x18, size_x18]` tuples per
// side, already sorted best-price-first (bids descending, asks ascending toward the spread).
// `depth` genuinely limits row count (verified: 10 → 10 rows, 50 → 50 rows), unlike
// `candlesticks`' silently-ignored `limit`.
export async function getOrderBook(productId: number, depth = 15): Promise<OrderBook> {
  const { bids, asks } = await nadoQuery<MarketLiquidityResponse>("market_liquidity", { product_id: productId, depth });
  return {
    bids: bids.map(([price, size]) => ({ price: fromX18(price), size: fromX18(size) })),
    asks: asks.map(([price, size]) => ({ price: fromX18(price), size: fromX18(size) })),
  };
}
