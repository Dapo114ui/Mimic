import { LiveMarketsTable } from "@/components/terminal/LiveMarketsTable";
import { LiveStatusBadge } from "@/components/terminal/LiveStatusBadge";
import { AccountSummaryLink } from "@/components/portfolio/AccountSummaryLink";

export default function Home() {
  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Live markets
            </p>
            <h1 className="mt-3 text-5xl font-bold tracking-tight text-foreground sm:text-6xl md:text-7xl">
              Markets
            </h1>
          </div>
          <LiveStatusBadge />
        </div>

        <p className="mt-5 max-w-2xl text-mist">
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
