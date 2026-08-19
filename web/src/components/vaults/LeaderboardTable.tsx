"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { StrategyTag, Vault } from "@/lib/vaults";
import { formatSignedPct, formatUsd, truncateAddress } from "@/lib/format";

type SortKey = "allTimeReturnPct" | "tvlUsd" | "followers";

const TAGS: (StrategyTag | "All")[] = ["All", "Perps", "Market Neutral", "Spot + Perps", "Momentum"];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "allTimeReturnPct", label: "Return" },
  { key: "tvlUsd", label: "TVL" },
  { key: "followers", label: "Followers" },
];

const RANK_STYLES: Record<number, string> = {
  1: "border-amber-400/30 bg-amber-400/15 text-amber-300",
  2: "border-slate-300/30 bg-slate-300/15 text-slate-200",
  3: "border-orange-400/30 bg-orange-400/15 text-orange-300",
};

export function LeaderboardTable({ vaults }: { vaults: Vault[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("allTimeReturnPct");
  const [activeTag, setActiveTag] = useState<(typeof TAGS)[number]>("All");

  const rows = useMemo(() => {
    const filtered = activeTag === "All" ? vaults : vaults.filter((vault) => vault.tag === activeTag);
    return [...filtered].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [vaults, sortKey, activeTag]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                activeTag === tag
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-white/10 text-mist-dim hover:border-white/25 hover:text-mist"
              }`}
            >
              {tag}
            </button>
          ))}
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
              <th className="px-5 py-4 font-medium">Rank</th>
              <th className="px-5 py-4 font-medium">Vault</th>
              <th className="px-5 py-4 font-medium">Strategy</th>
              <th className="px-5 py-4 text-right font-medium">TVL</th>
              <th className="px-5 py-4 text-right font-medium">All-time return</th>
              <th className="px-5 py-4 text-right font-medium">Fee</th>
              <th className="px-5 py-4 text-right font-medium">Followers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((vault, index) => {
              const rank = index + 1;
              const isUp = vault.allTimeReturnPct >= 0;
              return (
                <tr key={vault.slug} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-5 py-4 align-middle">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border font-mono text-xs ${
                        RANK_STYLES[rank] ?? "border-white/10 text-mist-dim"
                      }`}
                    >
                      {rank}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <Link href={`/vaults/${vault.slug}`} className="group flex flex-col">
                      <span className="font-medium text-foreground group-hover:text-accent">{vault.name}</span>
                      <span className="font-mono text-xs text-mist-dim">
                        {truncateAddress(vault.strategistAddress)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-mist">
                      {vault.tag}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right align-middle font-mono text-foreground">
                    {formatUsd(vault.tvlUsd)}
                  </td>
                  <td
                    className={`px-5 py-4 text-right align-middle font-mono font-medium ${
                      isUp ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {formatSignedPct(vault.allTimeReturnPct)}
                  </td>
                  <td className="px-5 py-4 text-right align-middle text-mist">
                    {(vault.performanceFeeBps / 100).toFixed(0)}%
                  </td>
                  <td className="px-5 py-4 text-right align-middle text-mist">{vault.followers}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
