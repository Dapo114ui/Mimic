"use client";

import { useAccount } from "wagmi";
import { useNlpVault } from "@/lib/nado/useNlpVault";
import { formatDateTime, formatPrice, formatUsd } from "@/lib/format";

export function NlpVaultStats() {
  const { address, isConnected } = useAccount();
  const {
    stats,
    isStatsLoading,
    isStatsError,
    yourBalance,
    isBalanceLoading,
    isBalanceError,
    lockStatus,
    isLockLoading,
  } = useNlpVault(address);

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
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="NLP price" value={price} />
        <Stat label="Total supply" value={supply} />
        <Stat label="TVL" value={tvl} />
        <Stat label="Your NLP balance" value={balanceValue} sub={balanceUsd} />
      </div>

      {isConnected && !isLockLoading && lockStatus && lockStatus.locks.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm">
          <p className="font-medium text-amber-300">
            {formatPrice(lockStatus.lockedAmount)} NLP locked
            {lockStatus.unlockedAmount > 0 && ` · ${formatPrice(lockStatus.unlockedAmount)} NLP unlocked`}
          </p>
          <p className="mt-1 text-amber-200/70">
            Newly-minted NLP has a cooldown before it can be burned — only unlocked NLP can be
            redeemed, one lock per mint:
          </p>
          <ul className="mt-2 space-y-1">
            {lockStatus.locks.map((lock, i) => (
              <li key={i} className="flex justify-between font-mono text-xs text-amber-200/70">
                <span>{formatPrice(lock.amount)} NLP</span>
                <span>unlocks {formatDateTime(lock.unlocksAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
