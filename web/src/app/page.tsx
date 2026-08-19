import Link from "next/link";
import { getAllMarkets } from "@/lib/markets";
import { ACCOUNT_SUMMARY } from "@/lib/portfolio";
import { MarketsTable } from "@/components/terminal/MarketsTable";
import { SampleDataBanner } from "@/components/terminal/SampleDataBanner";
import { formatUsd } from "@/lib/format";

export default function Home() {
  const markets = getAllMarkets();

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <SampleDataBanner>Sample data — not connected to Nado&apos;s live feed yet</SampleDataBanner>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Markets
        </h1>
        <p className="mt-3 max-w-2xl text-mist">
          Price, volume, funding, and open interest across Nado&apos;s perp markets on Ink —
          click into any market for the chart, or check your account below.
        </p>

        <div className="mt-10">
          <MarketsTable markets={markets} />
        </div>

        <Link
          href="/portfolio"
          className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20"
        >
          <div>
            <h2 className="text-lg font-medium text-foreground">Your account</h2>
            <p className="mt-1 text-sm text-mist-dim">Equity, open positions, and trade history</p>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-mist-dim">Equity</p>
              <p className="mt-1 font-mono text-lg text-foreground">{formatUsd(ACCOUNT_SUMMARY.equityUsd)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-mist-dim">Unrealized PnL</p>
              <p
                className={`mt-1 font-mono text-lg font-medium ${
                  ACCOUNT_SUMMARY.unrealizedPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {ACCOUNT_SUMMARY.unrealizedPnlUsd >= 0 ? "+" : ""}
                {formatUsd(ACCOUNT_SUMMARY.unrealizedPnlUsd)}
              </p>
            </div>
            <span className="text-mist-dim">→</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
