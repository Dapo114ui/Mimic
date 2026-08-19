import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllMarkets, getCandles, getMarketBySymbol, getRecentFills } from "@/lib/markets";
import { formatDateTime, formatFundingRate, formatPrice, formatSignedPct, formatUsd } from "@/lib/format";
import { KNOWN_PRODUCTS } from "@/lib/nado/config";
import { CandlestickChart } from "@/components/terminal/CandlestickChart";
import { SideBadge } from "@/components/terminal/SideBadge";
import { SampleDataBanner } from "@/components/terminal/SampleDataBanner";
import { LivePriceBadge } from "@/components/terminal/LivePriceBadge";
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
            <div className="flex flex-wrap items-center gap-2">
              <SampleDataBanner>Sample chart &amp; stats</SampleDataBanner>
              {productId !== undefined && <LivePriceBadge productId={productId} />}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {market.symbol}
            </h1>
            <p className="mt-1 text-sm text-mist-dim">{market.name}</p>
          </div>
          <div className="self-start text-right">
            <p className="font-mono text-3xl font-medium text-foreground">${formatPrice(market.price)}</p>
            <p className={`mt-1 font-mono text-sm font-medium ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
              {formatSignedPct(market.change24hPct)} 24h
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <CandlestickChart candles={candles} />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="24h volume" value={formatUsd(market.volume24hUsd)} />
          <Stat label="Open interest" value={formatUsd(market.openInterestUsd)} />
          <Stat label="Funding (8h)" value={formatFundingRate(market.fundingRatePct)} />
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
          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-mist-dim">
                  <th className="px-5 py-3 font-medium">Side</th>
                  <th className="px-5 py-3 text-right font-medium">Price</th>
                  <th className="px-5 py-3 text-right font-medium">Size</th>
                  <th className="px-5 py-3 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {fills.map((fill, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="px-5 py-3 align-middle">
                      <SideBadge side={fill.side} />
                    </td>
                    <td className="px-5 py-3 text-right align-middle font-mono text-mist">
                      ${formatPrice(fill.price)}
                    </td>
                    <td className="px-5 py-3 text-right align-middle font-mono text-mist">
                      {formatUsd(fill.sizeUsd)}
                    </td>
                    <td className="px-5 py-3 text-right align-middle text-xs text-mist-dim">
                      {formatDateTime(fill.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
