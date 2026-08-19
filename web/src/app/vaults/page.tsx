import type { Metadata } from "next";
import { getAllVaults } from "@/lib/vaults";
import { LeaderboardTable } from "@/components/vaults/LeaderboardTable";

export const metadata: Metadata = {
  title: "Vaults — Mimic",
  description: "Browse strategist vaults on Mimic, ranked by performance.",
};

export default function VaultsPage() {
  const vaults = getAllVaults();

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
          Sample data — no vaults are live on-chain yet
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Vault leaderboard
        </h1>
        <p className="mt-3 max-w-2xl text-mist">
          Every vault mirrors its strategist&apos;s trades on Nado. Performance fees are charged
          only on your own gains, tracked from your own cost basis — never on gains booked before
          you deposited.
        </p>

        <div className="mt-10">
          <LeaderboardTable vaults={vaults} />
        </div>
      </div>
    </div>
  );
}
