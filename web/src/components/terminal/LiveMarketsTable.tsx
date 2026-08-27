"use client";

import { useLiveMarkets } from "@/lib/nado/useLiveMarkets";
import { MarketsTable } from "@/components/terminal/MarketsTable";

export function LiveMarketsTable() {
  const { data, isLoading, isError } = useLiveMarkets();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-16 text-center text-sm text-mist-dim">
        Loading markets…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-16 text-center text-sm text-mist-dim">
        Couldn&apos;t load markets from Nado — try again in a moment.
      </div>
    );
  }

  return <MarketsTable markets={data} />;
}
