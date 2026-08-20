"use client";

import { useAccount } from "wagmi";
import { useNlpVault } from "@/lib/nado/useNlpVault";
import { formatPrice, formatUsd } from "@/lib/format";

export function NlpVaultStats() {
  const { address, isConnected } = useAccount();
  const { stats, isStatsLoading, isStatsError, yourBalance, isBalanceLoading, isBalanceError } = useNlpVault(address);

  const price = isStatsLoading ? "…" : isStatsError || !stats ? "—" : `$${formatPrice(stats.priceUsd)}`;
  const supply = isStatsLoading ? "…" : isStatsError || !stats ? "—" : `${formatPrice(stats.totalSupply)} NLP`;
  const tvl = isStatsLoading ? "…" : isStatsError || !stats ? "—" : formatUsd(stats.totalValueUsd);

  const balanceValue = !isConnected
    ? "Connect wallet"
    : isBalanceLoading
      ? "…"
      : isBalanceError || yourBalance === null
        ? "—"
        : `${formatPrice(yourBalance)} NLP`;

  const balanceUsd =
    isConnected && !isBalanceLoading && !isBalanceError && yourBalance !== null && stats
      ? formatUsd(yourBalance * stats.priceUsd)
      : null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat label="NLP price" value={price} />
      <Stat label="Total supply" value={supply} />
      <Stat label="TVL" value={tvl} />
      <Stat label="Your NLP balance" value={balanceValue} sub={balanceUsd} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs uppercase tracking-wider text-mist-dim">{label}</p>
      <p className="mt-1 font-mono text-lg text-foreground">{value}</p>
      {sub && <p className="mt-0.5 font-mono text-xs text-mist-dim">{sub}</p>}
    </div>
  );
}
