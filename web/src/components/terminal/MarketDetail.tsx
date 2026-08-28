"use client";

import Link from "next/link";
import { useLiveMarkets } from "@/lib/nado/useLiveMarkets";
import { LiveCandlestickChart } from "@/components/terminal/LiveCandlestickChart";
import { LiveTradesTable } from "@/components/terminal/LiveTradesTable";
import { LiveMarketHeader, LiveMarketStats } from "@/components/terminal/LiveMarketPanel";
import { OrderForm } from "@/components/terminal/OrderForm";
import { OrderBook } from "@/components/terminal/OrderBook";

export function MarketDetail({ symbol }: { symbol: string }) {
  const { data: markets, isLoading, isError } = useLiveMarkets();

  const market = markets?.find((m) => m.symbol.toUpperCase() === symbol.toUpperCase());

  if (isLoading) {
    return <p className="mt-16 text-center text-sm text-mist-dim">Loading {symbol}…</p>;
  }

  if (isError) {
    return (
      <p className="mt-16 text-center text-sm text-mist-dim">
        Couldn&apos;t load markets from Nado — try again in a moment.
      </p>
    );
  }

  if (!market) {
    return (
      <div className="mt-16 text-center">
        <p className="text-sm text-mist">No market called &ldquo;{symbol}&rdquo; on Nado.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-accent hover:underline">
          ← Browse all markets
        </Link>
      </div>
    );
  }

  const { productId } = market;

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {market.symbol}
          </h1>
          {!market.isLive && (
            <p className="mt-1 text-sm text-amber-300/80">This market isn&apos;t currently trading.</p>
          )}
        </div>
        <LiveMarketHeader productId={productId} />
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <LiveCandlestickChart productId={productId} />
      </div>

      <div className="mt-8">
        <LiveMarketStats productId={productId} />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <OrderForm productId={productId} priceIncrementX18={market.priceIncrementX18} />
        <OrderBook productId={productId} />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-foreground">Recent trades</h2>
        <LiveTradesTable productId={productId} />
      </section>
    </>
  );
}
