"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { usePortfolio } from "@/lib/nado/usePortfolio";
import { formatUsd } from "@/lib/format";

export function AccountSummaryLink() {
  const { address, isConnected } = useAccount();
  const { isLoading, isError, data } = usePortfolio(address);

  return (
    <Link
      href="/portfolio"
      className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20"
    >
      <div>
        <h2 className="text-lg font-medium text-foreground">Your account</h2>
        <p className="mt-1 text-sm text-mist-dim">Equity, open positions, and trade history</p>
      </div>
      {!isConnected ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-mist-dim">Connect a wallet to see your real account</p>
          <span className="text-mist-dim">→</span>
        </div>
      ) : (
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-mist-dim">Equity</p>
            <p className="mt-1 font-mono text-lg text-foreground">
              {isLoading ? "…" : isError || !data ? "—" : formatUsd(data.summary.equityUsd)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-mist-dim">Unrealized PnL</p>
            <p
              className={`mt-1 font-mono text-lg font-medium ${
                isLoading || isError || !data
                  ? "text-foreground"
                  : data.summary.unrealizedPnlUsd >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
              }`}
            >
              {isLoading
                ? "…"
                : isError || !data
                  ? "—"
                  : `${data.summary.unrealizedPnlUsd >= 0 ? "+" : ""}${formatUsd(data.summary.unrealizedPnlUsd)}`}
            </p>
          </div>
          <span className="text-mist-dim">→</span>
        </div>
      )}
    </Link>
  );
}
