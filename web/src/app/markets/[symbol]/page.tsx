import Link from "next/link";
import { MarketDetail } from "@/components/terminal/MarketDetail";

// No generateStaticParams: the market list comes from Nado at runtime now, so it can't be
// enumerated at build time — and shouldn't be, since Nado can list new markets at any point.
export async function generateMetadata({ params }: PageProps<"/markets/[symbol]">) {
  const { symbol } = await params;
  return { title: `${decodeURIComponent(symbol)} — Mimic` };
}

export default async function MarketDetailPage({ params }: PageProps<"/markets/[symbol]">) {
  const { symbol } = await params;

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-mist-dim transition hover:text-mist">
          ← Back to markets
        </Link>
        <MarketDetail symbol={decodeURIComponent(symbol)} />
      </div>
    </div>
  );
}
