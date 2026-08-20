"use client";

import { useLiveCandles } from "@/lib/nado/useLiveChart";
import { CandlestickChart } from "@/components/terminal/CandlestickChart";

export function LiveCandlestickChart({ productId }: { productId: number }) {
  const { data, isLoading, isError } = useLiveCandles(productId);

  if (isLoading || isError || !data || data.length === 0) {
    return (
      <div className="flex h-[360px] w-full items-center justify-center text-sm text-mist-dim">
        {isError ? "Chart data unavailable" : "Loading…"}
      </div>
    );
  }

  return <CandlestickChart candles={data} />;
}
