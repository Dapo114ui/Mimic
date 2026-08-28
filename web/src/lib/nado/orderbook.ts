import { nadoQuery } from "./client";

type MarketLiquidityResponse = { bids: [string, string][]; asks: [string, string][] };

// `priceX18` keeps the raw integer alongside the display-friendly `price` float — a market
// order's submitted price is derived from the best level and has to stay exact BigInt math
// (the same float-precision lesson `OrderForm` already learned for user-typed limit prices),
// while every existing display use (the book UI, spread calc) only ever wanted `price`.
export type OrderBookLevel = { price: number; priceX18: bigint; size: number };
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
    bids: bids.map(([price, size]) => ({ price: fromX18(price), priceX18: BigInt(price), size: fromX18(size) })),
    asks: asks.map(([price, size]) => ({ price: fromX18(price), priceX18: BigInt(price), size: fromX18(size) })),
  };
}
