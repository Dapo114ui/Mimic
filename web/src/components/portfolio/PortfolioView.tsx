"use client";

import { useAccount } from "wagmi";
import { usePortfolio } from "@/lib/nado/usePortfolio";
import { ConnectButton } from "@/components/ConnectButton";
import { SideBadge } from "@/components/terminal/SideBadge";
import { OpenOrdersTable } from "@/components/portfolio/OpenOrdersTable";
import { FeeSchedule } from "@/components/portfolio/FeeSchedule";
import { formatDateTime, formatSignedPct, formatUsd } from "@/lib/format";

export function PortfolioView() {
  const { address, isConnected } = useAccount();
  const { isLoading, isError, data } = usePortfolio(address);

  if (!isConnected) {
    return (
      <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
        <p className="text-mist">Connect a wallet to see your real Nado account.</p>
        <ConnectButton className="mt-4 inline-flex" />
      </div>
    );
  }

  if (isLoading) {
    return <p className="mt-10 text-center text-sm text-mist-dim">Loading your account…</p>;
  }

  if (isError || !data) {
    return (
      <p className="mt-10 text-center text-sm text-mist-dim">
        Couldn&apos;t load your account from Nado — try again in a moment.
      </p>
    );
  }

  if (!data.exists) {
    return (
      <p className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
        This wallet has no Nado account yet — deposit or place an order to create one.
      </p>
    );
  }

  const { summary, positions, tradeHistory, tradeHistoryLoading } = data;

  return (
    <>
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Equity" value={formatUsd(summary.equityUsd)} />
        <Stat label="Available margin" value={formatUsd(summary.availableMarginUsd)} />
        <Stat label="Margin ratio" value={`${summary.marginRatioPct.toFixed(1)}%`} />
        <Stat
          label="Unrealized PnL"
          value={`${summary.unrealizedPnlUsd >= 0 ? "+" : ""}${formatUsd(summary.unrealizedPnlUsd)}`}
          tone={summary.unrealizedPnlUsd >= 0 ? "up" : "down"}
        />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-foreground">Open positions</h2>
        <p className="mt-1 text-xs text-mist-dim">Cross-margin positions — isolated positions aren&apos;t shown yet.</p>
        {positions.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
            No open positions
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-mist-dim">
                  <th className="px-5 py-3 font-medium">Market</th>
                  <th className="px-5 py-3 font-medium">Side</th>
                  <th className="px-5 py-3 text-right font-medium">Size</th>
                  <th className="px-5 py-3 text-right font-medium">Entry</th>
                  <th className="px-5 py-3 text-right font-medium">Mark</th>
                  <th className="px-5 py-3 text-right font-medium">Unrealized PnL</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.productId} className="border-b border-white/5 last:border-0">
                    <td className="px-5 py-3 align-middle font-medium text-foreground">{position.market}</td>
                    <td className="px-5 py-3 align-middle">
                      <SideBadge side={position.side} />
                    </td>
                    <td className="px-5 py-3 text-right align-middle font-mono text-mist">
                      {formatUsd(position.sizeUsd)}
                    </td>
                    <td className="px-5 py-3 text-right align-middle font-mono text-mist">
                      {position.entryPrice.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right align-middle font-mono text-mist">
                      {position.markPrice.toLocaleString()}
                    </td>
                    <td
                      className={`px-5 py-3 text-right align-middle font-mono font-medium ${
                        position.unrealizedPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {position.unrealizedPnlUsd >= 0 ? "+" : ""}
                      {formatUsd(position.unrealizedPnlUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-foreground">Open orders</h2>
        <p className="mt-1 text-xs text-mist-dim">
          BTC-PERP and ETH-PERP only — the only markets you can place orders in here. Placing and
          cancelling are both confirmed working end to end against a real resting order on
          mainnet.
        </p>
        <OpenOrdersTable />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-foreground">Trade history</h2>
        {tradeHistoryLoading ? (
          <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
            Loading…
          </p>
        ) : tradeHistory.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
            No trade history
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-mist-dim">
                  <th className="px-5 py-3 font-medium">Market</th>
                  <th className="px-5 py-3 font-medium">Side</th>
                  <th className="px-5 py-3 text-right font-medium">Size</th>
                  <th className="px-5 py-3 text-right font-medium">Realized PnL</th>
                  <th className="px-5 py-3 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {tradeHistory.map((trade, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="px-5 py-3 align-middle font-medium text-foreground">{trade.market}</td>
                    <td className="px-5 py-3 align-middle">
                      <SideBadge side={trade.side} />
                    </td>
                    <td className="px-5 py-3 text-right align-middle font-mono text-mist">
                      {formatUsd(trade.sizeUsd)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right align-middle font-mono font-medium ${
                        trade.pnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {trade.pnlUsd >= 0 ? "+" : ""}
                      {formatUsd(trade.pnlUsd)} ({formatSignedPct(trade.pnlPct)})
                    </td>
                    <td className="px-5 py-3 text-right align-middle text-xs text-mist-dim">
                      {formatDateTime(trade.closedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-foreground">Fees</h2>
        <p className="mt-1 text-xs text-mist-dim">
          What trading and using the vault actually costs on this account.
        </p>
        <FeeSchedule />
      </section>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  const toneClass = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs uppercase tracking-wider text-mist-dim">{label}</p>
      <p className={`mt-1 font-mono text-lg ${toneClass}`}>{value}</p>
    </div>
  );
}
