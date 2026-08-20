import type { Metadata } from "next";
import { PortfolioView } from "@/components/portfolio/PortfolioView";

export const metadata: Metadata = {
  title: "Portfolio — Mimic",
  description: "Account equity, open positions, and trade history.",
};

export default function PortfolioPage() {
  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Portfolio</h1>
        <p className="mt-3 max-w-2xl text-mist">
          Your real Nado account: equity, margin health, open positions, and fill history — for
          the wallet you connect.
        </p>

        <PortfolioView />
      </div>
    </div>
  );
}
