import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllVaults, getVaultBySlug } from "@/lib/vaults";
import { formatDate, formatSignedPct, formatUsd, truncateAddress } from "@/lib/format";

export function generateStaticParams() {
  return getAllVaults().map((vault) => ({ slug: vault.slug }));
}

export async function generateMetadata({ params }: PageProps<"/vaults/[slug]">) {
  const { slug } = await params;
  const vault = getVaultBySlug(slug);
  return { title: vault ? `${vault.name} — Mimic` : "Vault not found — Mimic" };
}

export default async function VaultDetailPage({ params }: PageProps<"/vaults/[slug]">) {
  const { slug } = await params;
  const vault = getVaultBySlug(slug);
  if (!vault) notFound();

  const isUp = vault.allTimeReturnPct >= 0;

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/vaults" className="text-sm text-mist-dim transition hover:text-mist">
          ← Back to leaderboard
        </Link>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-mist">
              {vault.tag}
            </span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {vault.name}
            </h1>
            <p className="mt-1 font-mono text-sm text-mist-dim">
              Strategist {truncateAddress(vault.strategistAddress)} · live since{" "}
              {formatDate(vault.inceptionDate)}
            </p>
          </div>
          <span
            className={`self-start rounded-xl border px-4 py-2 font-mono text-lg font-medium ${
              isUp
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                : "border-rose-400/30 bg-rose-400/10 text-rose-400"
            }`}
          >
            {formatSignedPct(vault.allTimeReturnPct)}
          </span>
        </div>

        <p className="mt-6 max-w-2xl text-mist">{vault.description}</p>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="TVL" value={formatUsd(vault.tvlUsd)} />
          <Stat label="Performance fee" value={`${(vault.performanceFeeBps / 100).toFixed(0)}%`} />
          <Stat label="Followers" value={vault.followers.toLocaleString()} />
          <Stat label="Withdrawal cooldown" value="3 days" />
        </div>

        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-medium text-foreground">Deposit</h2>
          <p className="mt-2 text-sm text-mist">
            This vault isn&apos;t deployed on-chain yet — deposits open once Mimic launches on
            Ink. Your performance fee will be tracked from your own entry price, so joining after
            a winning streak never costs you fees on gains you didn&apos;t receive.
          </p>
          <button
            disabled
            className="mt-5 w-full cursor-not-allowed rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-mist-dim sm:w-auto sm:px-8"
          >
            Deposits open soon
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs uppercase tracking-wider text-mist-dim">{label}</p>
      <p className="mt-1 font-mono text-lg text-foreground">{value}</p>
    </div>
  );
}
