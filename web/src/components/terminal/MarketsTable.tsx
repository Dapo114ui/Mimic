"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LiveMarket } from "@/lib/nado/markets";
import { formatFundingRate, formatPrice, formatSignedPct, formatUsd } from "@/lib/format";

type SortKey = "change24hPct" | "volume24hUsd" | "openInterestUsd";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "volume24hUsd", label: "Volume" },
  { key: "change24hPct", label: "24h change" },
  { key: "openInterestUsd", label: "Open interest" },
];

export function MarketsTable({ markets }: { markets: LiveMarket[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("volume24hUsd");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Real keyboard shortcut, not just a decorative hint next to the input — ⌘K/Ctrl+K jumps
  // straight to the search box, same as the hint implies.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toUpperCase();
    const filtered = q ? markets.filter((m) => m.symbol.toUpperCase().includes(q)) : markets;
    // Markets with no data for the active sort sink to the bottom rather than sorting as 0,
    // which would otherwise scatter them through the middle of the table.
    return [...filtered].sort((a, b) => (b[sortKey] ?? -Infinity) - (a[sortKey] ?? -Infinity));
  }, [markets, sortKey, query]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${markets.length} markets…`}
            className="w-full rounded-full border border-white/10 bg-ink-950 py-2 pl-4 pr-14 text-sm text-foreground outline-none placeholder:text-mist-dim focus:border-accent/50"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-mist-dim">
            ⌘K
          </kbd>
        </div>
        <div className="flex items-center gap-1 text-xs text-mist-dim">
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
              const isUp = (market.change24hPct ?? 0) >= 0;
              return (
                <tr key={market.productId} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-5 py-4 align-middle">
                    <Link href={`/markets/${market.symbol}`} className="group flex flex-col">
                      <span className="font-medium text-foreground group-hover:text-accent">{market.symbol}</span>
                      {!market.isLive && <span className="text-xs text-amber-300/70">not trading</span>}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-right align-middle font-mono text-foreground">
                    ${formatPrice(market.price)}
                  </td>
                  <td
                    className={`px-5 py-4 text-right align-middle font-mono font-medium ${
                      market.change24hPct === null ? "text-mist-dim" : isUp ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {market.change24hPct === null ? "—" : formatSignedPct(market.change24hPct)}
                  </td>
                  <td className="px-5 py-4 text-right align-middle font-mono text-mist">
                    {market.volume24hUsd === null ? "—" : formatUsd(market.volume24hUsd)}
                  </td>
                  <td
                    className={`px-5 py-4 text-right align-middle font-mono text-xs ${
                      market.fundingRatePct === null
                        ? "text-mist-dim"
                        : market.fundingRatePct >= 0
                          ? "text-emerald-400/80"
                          : "text-rose-400/80"
                    }`}
                  >
                    {market.fundingRatePct === null ? "—" : formatFundingRate(market.fundingRatePct)}
                  </td>
                  <td className="px-5 py-4 text-right align-middle font-mono text-mist">
                    {formatUsd(market.openInterestUsd)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-mist-dim">
                  No markets match &ldquo;{query}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
