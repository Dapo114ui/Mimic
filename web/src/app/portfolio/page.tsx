import type { Metadata } from "next";
import { ACCOUNT_SUMMARY, OPEN_POSITIONS, RECENT_TRADES } from "@/lib/portfolio";
import { formatDateTime, formatSignedPct, formatUsd } from "@/lib/format";
import { SideBadge } from "@/components/terminal/SideBadge";
import { SampleDataBanner } from "@/components/terminal/SampleDataBanner";

export const metadata: Metadata = {
  title: "Portfolio — Mimic",
  description: "Account equity, open positions, and trade history.",
};

export default function PortfolioPage() {
  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <SampleDataBanner>
          Sample account — connecting a wallet doesn&apos;t change this yet
        </SampleDataBanner>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Portfolio
        </h1>
        <p className="mt-3 max-w-2xl text-mist">
          A preview of what an account view backed by Nado&apos;s real API would show: equity,
          margin health, open positions, and closed trades.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Equity" value={formatUsd(ACCOUNT_SUMMARY.equityUsd)} />
          <Stat label="Available margin" value={formatUsd(ACCOUNT_SUMMARY.availableMarginUsd)} />
          <Stat label="Margin ratio" value={`${ACCOUNT_SUMMARY.marginRatioPct.toFixed(1)}%`} />
          <Stat
            label="Unrealized PnL"
            value={`${ACCOUNT_SUMMARY.unrealizedPnlUsd >= 0 ? "+" : ""}${formatUsd(ACCOUNT_SUMMARY.unrealizedPnlUsd)}`}
            tone={ACCOUNT_SUMMARY.unrealizedPnlUsd >= 0 ? "up" : "down"}
          />
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-medium text-foreground">Open positions</h2>
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
                {OPEN_POSITIONS.map((position, i) => (
                  <tr key={`${position.market}-${i}`} className="border-b border-white/5 last:border-0">
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
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium text-foreground">Trade history</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-mist-dim">
                  <th className="px-5 py-3 font-medium">Market</th>
                  <th className="px-5 py-3 font-medium">Side</th>
                  <th className="px-5 py-3 text-right font-medium">Size</th>
                  <th className="px-5 py-3 text-right font-medium">Realized PnL</th>
                  <th className="px-5 py-3 text-right font-medium">Closed</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_TRADES.map((trade, i) => (
                  <tr key={`${trade.market}-${i}`} className="border-b border-white/5 last:border-0">
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
        </section>
      </div>
    </div>
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
