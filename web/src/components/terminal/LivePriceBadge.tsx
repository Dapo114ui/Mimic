"use client";

import { useLiveMarket } from "@/lib/nado/useLiveMarket";
import { formatPrice, formatUsd } from "@/lib/format";

export function LivePriceBadge({ productId }: { productId: number }) {
  const { data, isLoading, isError } = useLiveMarket(productId);

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-mist-dim">
        Loading live price…
      </span>
    );
  }

  if (isError || !data) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-mist-dim">
        Live price unavailable
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Live from Nado: ${formatPrice(data.price)} · {formatUsd(data.openInterestUsd)} OI
    </span>
  );
}
