import { LiveMarketsTable } from "@/components/terminal/LiveMarketsTable";
import { AccountSummaryLink } from "@/components/portfolio/AccountSummaryLink";

export default function Home() {
  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Markets</h1>
        <p className="mt-3 max-w-2xl text-mist">
          Live price, 24h change, volume, funding, and open interest across every perp market on
          Nado — click into any market for the chart, order book, and order entry.
        </p>

        <div className="mt-10">
          <LiveMarketsTable />
        </div>

        <AccountSummaryLink />
      </div>
    </div>
  );
}
