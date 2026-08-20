"use client";

import { useState } from "react";
import { useLiveCandles } from "@/lib/nado/useLiveChart";
import { CandlestickChart } from "@/components/terminal/CandlestickChart";

// Every value here was confirmed live against the archive's `candlesticks` query — it only
// serves specific pre-computed bucket sizes (30m/6h/12h all return zero rows), so this list is
// exactly the working set, not a guess at "reasonable" trading-terminal intervals.
const TIMEFRAMES = [
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "15m", seconds: 900 },
  { label: "1H", seconds: 3600 },
  { label: "4H", seconds: 14400 },
  { label: "1D", seconds: 86400 },
  { label: "1W", seconds: 604800 },
] as const;

export function LiveCandlestickChart({ productId }: { productId: number }) {
  const [granularity, setGranularity] = useState<number>(3600);
  const { data, isLoading, isError } = useLiveCandles(productId, granularity);

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.seconds}
            type="button"
            onClick={() => setGranularity(tf.seconds)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              granularity === tf.seconds
                ? "bg-accent/15 text-accent"
                : "text-mist-dim hover:bg-white/5 hover:text-mist"
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {isLoading || isError || !data || data.length === 0 ? (
        <div className="flex h-[360px] w-full items-center justify-center text-sm text-mist-dim">
          {isError ? "Chart data unavailable" : "Loading…"}
        </div>
      ) : (
        <CandlestickChart candles={data} />
      )}
    </div>
  );
}
