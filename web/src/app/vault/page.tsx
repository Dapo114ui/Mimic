import type { Metadata } from "next";
import { NlpVaultForm } from "@/components/terminal/NlpVaultForm";
import { NlpVaultStats } from "@/components/vault/NlpVaultStats";

export const metadata: Metadata = {
  title: "NLP Vault — Nadoterminal",
  description: "Mint or burn Nado's native liquidity vault (NLP) on Ink mainnet.",
};

export default function VaultPage() {
  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          NLP Vault
        </h1>
        <p className="mt-3 text-mist">
          NLP is Nado&apos;s own protocol liquidity vault — deposit the quote asset to mint NLP,
          burn NLP to redeem. This isn&apos;t a Nadoterminal product; it&apos;s Nado&apos;s native
          vault, reached directly through their gateway API.
        </p>

        <div className="mt-8">
          <NlpVaultStats />
        </div>

        <div className="mt-10">
          <NlpVaultForm />
        </div>
      </div>
    </div>
  );
}
