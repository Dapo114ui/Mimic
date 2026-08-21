"use client";

import { useOrderBook } from "@/lib/nado/useOrderBook";
import { formatPrice } from "@/lib/format";
import type { OrderBookLevel } from "@/lib/nado/orderbook";

const DEPTH = 12;

function withCumulative(levels: OrderBookLevel[]) {
  let running = 0;
  return levels.map((level) => {
    running += level.size;
    return { ...level, cumulative: running };
  });
}

function Row({
  level,
  side,
  maxCumulative,
}: {
  level: OrderBookLevel & { cumulative: number };
  side: "bid" | "ask";
  maxCumulative: number;
}) {
  const fillPct = maxCumulative > 0 ? (level.cumulative / maxCumulative) * 100 : 0;
  const color = side === "bid" ? "text-emerald-400" : "text-rose-400";
  const barColor = side === "bid" ? "bg-emerald-400/10" : "bg-rose-400/10";

  return (
    <div className="relative flex items-center justify-between px-3 py-0.5 font-mono text-xs">
      <div className={`absolute inset-y-0 right-0 ${barColor}`} style={{ width: `${fillPct}%` }} />
      <span className={`relative ${color}`}>{formatPrice(level.price)}</span>
      <span className="relative text-mist-dim">{level.size.toFixed(4)}</span>
    </div>
  );
}

export function OrderBook({ productId }: { productId: number }) {
  const { data, isLoading, isError } = useOrderBook(productId, DEPTH);

  if (isLoading || isError || !data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-foreground">Order book</h2>
        <p className="mt-8 text-center text-sm text-mist-dim">
          {isError ? "Order book unavailable" : "Loading…"}
        </p>
      </div>
    );
  }

  // Asks shown best-first from the API (lowest first); reversed here so the best ask sits just
  // above the spread, matching how every real order-book UI stacks the two sides.
  const asks = withCumulative([...data.asks].reverse());
  const bids = withCumulative(data.bids);
  const maxCumulative = Math.max(asks.at(-1)?.cumulative ?? 0, bids.at(-1)?.cumulative ?? 0);

  const bestBid = data.bids[0]?.price;
  const bestAsk = data.asks[0]?.price;
  const spread = bestBid !== undefined && bestAsk !== undefined ? bestAsk - bestBid : null;
  const spreadPct = spread !== null && bestAsk ? (spread / bestAsk) * 100 : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <h2 className="text-sm font-medium text-foreground">Order book</h2>
      <div className="mt-3 flex justify-between px-3 text-[10px] uppercase tracking-wider text-mist-dim">
        <span>Price</span>
        <span>Size</span>
      </div>

      <div className="mt-1">
        {asks.map((level, i) => (
          <Row key={`ask-${i}`} level={level} side="ask" maxCumulative={maxCumulative} />
        ))}
      </div>

      {spread !== null && (
        <div className="my-1 flex items-center justify-between border-y border-white/10 px-3 py-1.5 font-mono text-xs">
          <span className="text-foreground">{formatPrice((bestBid! + bestAsk!) / 2)}</span>
          <span className="text-mist-dim">
            spread {formatPrice(spread)} ({spreadPct?.toFixed(3)}%)
          </span>
        </div>
      )}

      <div className="mb-1">
        {bids.map((level, i) => (
          <Row key={`bid-${i}`} level={level} side="bid" maxCumulative={maxCumulative} />
        ))}
      </div>
    </div>
  );
}
