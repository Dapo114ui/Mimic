"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Market } from "@/lib/markets";
import { formatFundingRate, formatPrice, formatSignedPct, formatUsd } from "@/lib/format";

type SortKey = "change24hPct" | "volume24hUsd" | "openInterestUsd";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "change24hPct", label: "24h change" },
  { key: "volume24hUsd", label: "Volume" },
  { key: "openInterestUsd", label: "Open interest" },
];

export function MarketsTable({ markets }: { markets: Market[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("volume24hUsd");

  const rows = useMemo(() => [...markets].sort((a, b) => b[sortKey] - a[sortKey]), [markets, sortKey]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-1 text-xs text-mist-dim">
        <span className="mr-1">Sort by</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortKey(opt.key)}
            className={`rounded-full px-3 py-1.5 font-medium transition ${
              sortKey === opt.key ? "bg-white/10 text-foreground" : "hover:text-mist"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-mist-dim">
              <th className="px-5 py-4 font-medium">Market</th>
              <th className="px-5 py-4 text-right font-medium">Price</th>
              <th className="px-5 py-4 text-right font-medium">24h change</th>
              <th className="px-5 py-4 text-right font-medium">24h volume</th>
              <th className="px-5 py-4 text-right font-medium">Funding</th>
              <th className="px-5 py-4 text-right font-medium">Open interest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((market) => {
              const isUp = market.change24hPct >= 0;
              return (
                <tr key={market.symbol} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-5 py-4 align-middle">
                    <Link href={`/markets/${market.symbol}`} className="group flex flex-col">
                      <span className="font-medium text-foreground group-hover:text-accent">{market.symbol}</span>
                      <span className="text-xs text-mist-dim">{market.name}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-right align-middle font-mono text-foreground">
                    ${formatPrice(market.price)}
                  </td>
                  <td
                    className={`px-5 py-4 text-right align-middle font-mono font-medium ${
                      isUp ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {formatSignedPct(market.change24hPct)}
                  </td>
                  <td className="px-5 py-4 text-right align-middle font-mono text-mist">
                    {formatUsd(market.volume24hUsd)}
                  </td>
                  <td
                    className={`px-5 py-4 text-right align-middle font-mono text-xs ${
                      market.fundingRatePct >= 0 ? "text-emerald-400/80" : "text-rose-400/80"
                    }`}
                  >
                    {formatFundingRate(market.fundingRatePct)}
                  </td>
                  <td className="px-5 py-4 text-right align-middle font-mono text-mist">
                    {formatUsd(market.openInterestUsd)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
