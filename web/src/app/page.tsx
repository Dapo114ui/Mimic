import { getAllMarkets } from "@/lib/markets";
import { MarketsTable } from "@/components/terminal/MarketsTable";
import { SampleDataBanner } from "@/components/terminal/SampleDataBanner";
import { AccountSummaryLink } from "@/components/portfolio/AccountSummaryLink";

export default function Home() {
  const markets = getAllMarkets();

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <SampleDataBanner>Markets below are sample data — your account card is real once connected</SampleDataBanner>
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

        <AccountSummaryLink />
      </div>
    </div>
  );
}
