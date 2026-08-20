"use client";

import { useLiveTrades } from "@/lib/nado/useLiveChart";
import { TradesTable } from "@/components/terminal/TradesTable";

export function LiveTradesTable({ productId }: { productId: number }) {
  const { data, isLoading, isError } = useLiveTrades(productId);

  if (isLoading || isError || !data) {
    return (
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
        {isError ? "Recent trades unavailable" : "Loading…"}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
        No recent trades
      </div>
    );
  }

  return <TradesTable fills={data} />;
}
