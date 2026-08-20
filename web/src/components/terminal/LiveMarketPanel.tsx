"use client";

import { useLiveMarket } from "@/lib/nado/useLiveMarket";
import { formatFundingRate, formatPrice, formatSignedPct, formatUsd } from "@/lib/format";

export function LiveMarketHeader({ productId }: { productId: number }) {
  const { data, isLoading, isError } = useLiveMarket(productId);

  if (isLoading || isError || !data) {
    return (
      <div className="self-start text-right">
        <p className="font-mono text-lg text-mist-dim">{isError ? "Live price unavailable" : "Loading…"}</p>
      </div>
    );
  }

  const isUp = (data.change24hPct ?? 0) >= 0;

  return (
    <div className="self-start text-right">
      <p className="font-mono text-3xl font-medium text-foreground">${formatPrice(data.price)}</p>
      <p className={`mt-1 font-mono text-sm font-medium ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
        {data.change24hPct === null ? "24h change —" : `${formatSignedPct(data.change24hPct)} 24h`}
      </p>
    </div>
  );
}

export function LiveMarketStats({ productId }: { productId: number }) {
  const { data, isLoading, isError } = useLiveMarket(productId);

  const volume = isLoading ? "…" : isError || data?.volume24hUsd == null ? "—" : formatUsd(data.volume24hUsd);
  const openInterest = isLoading ? "…" : isError || !data ? "—" : formatUsd(data.openInterestUsd);
  const funding = isLoading ? "…" : isError || data?.fundingRatePct == null ? "—" : formatFundingRate(data.fundingRatePct);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <Stat label="24h volume" value={volume} />
      <Stat label="Open interest" value={openInterest} />
      <Stat label="Funding rate" value={funding} />
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
