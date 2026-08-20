import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllMarkets, getCandles, getMarketBySymbol, getRecentFills } from "@/lib/markets";
import { formatFundingRate, formatPrice, formatSignedPct, formatUsd } from "@/lib/format";
import { KNOWN_PRODUCTS } from "@/lib/nado/config";
import { CandlestickChart } from "@/components/terminal/CandlestickChart";
import { LiveCandlestickChart } from "@/components/terminal/LiveCandlestickChart";
import { TradesTable } from "@/components/terminal/TradesTable";
import { LiveTradesTable } from "@/components/terminal/LiveTradesTable";
import { SampleDataBanner } from "@/components/terminal/SampleDataBanner";
import { LiveMarketHeader, LiveMarketStats } from "@/components/terminal/LiveMarketPanel";
import { OrderForm } from "@/components/terminal/OrderForm";

export function generateStaticParams() {
  return getAllMarkets().map((market) => ({ symbol: market.symbol }));
}

export async function generateMetadata({ params }: PageProps<"/markets/[symbol]">) {
  const { symbol } = await params;
  const market = getMarketBySymbol(symbol);
  return { title: market ? `${market.symbol} — Mimic` : "Market not found — Mimic" };
}

export default async function MarketDetailPage({ params }: PageProps<"/markets/[symbol]">) {
  const { symbol } = await params;
  const market = getMarketBySymbol(symbol);
  if (!market) notFound();

  const candles = getCandles(market);
  const fills = getRecentFills(market);
  const isUp = market.change24hPct >= 0;
  const productId = (KNOWN_PRODUCTS as Record<string, number>)[market.symbol];

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-mist-dim transition hover:text-mist">
          ← Back to markets
        </Link>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {productId === undefined && <SampleDataBanner>Sample chart & stats</SampleDataBanner>}
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {market.symbol}
            </h1>
            <p className="mt-1 text-sm text-mist-dim">{market.name}</p>
          </div>
          {productId !== undefined ? (
            <LiveMarketHeader productId={productId} />
          ) : (
            <div className="self-start text-right">
              <p className="font-mono text-3xl font-medium text-foreground">${formatPrice(market.price)}</p>
              <p className={`mt-1 font-mono text-sm font-medium ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                {formatSignedPct(market.change24hPct)} 24h
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          {productId !== undefined ? (
            <LiveCandlestickChart productId={productId} />
          ) : (
            <CandlestickChart candles={candles} />
          )}
        </div>

        <div className="mt-8">
          {productId !== undefined ? (
            <LiveMarketStats productId={productId} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="24h volume" value={formatUsd(market.volume24hUsd)} />
              <Stat label="Open interest" value={formatUsd(market.openInterestUsd)} />
              <Stat label="Funding rate" value={formatFundingRate(market.fundingRatePct)} />
            </div>
          )}
        </div>

        {productId !== undefined ? (
          <div className="mt-10">
            <OrderForm productId={productId} />
          </div>
        ) : (
          <p className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-mist-dim">
            Order placement isn&apos;t available for {market.symbol} — its Nado product ID
            couldn&apos;t be confidently identified from the gateway&apos;s market list.
          </p>
        )}

        <section className="mt-10">
          <h2 className="text-lg font-medium text-foreground">Recent trades</h2>
          {productId !== undefined ? <LiveTradesTable productId={productId} /> : <TradesTable fills={fills} />}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs uppercase tracking-wider text-mist-dim">{label}</p>
      <p className="mt-1 font-mono text-lg text-foreground">{value}</p>
    </div>
  );
}
