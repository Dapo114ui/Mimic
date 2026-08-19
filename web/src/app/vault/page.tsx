import type { Metadata } from "next";
import { NlpVaultForm } from "@/components/terminal/NlpVaultForm";

export const metadata: Metadata = {
  title: "NLP Vault — Mimic",
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
          burn NLP to redeem. This isn&apos;t a Mimic product; it&apos;s Nado&apos;s native
          vault, reached directly through their gateway API.
        </p>
        <p className="mt-2 text-sm text-mist-dim">
          There&apos;s no live NLP supply/share-price data wired up here yet — that would need a
          query type beyond what&apos;s been verified so far. This is the mint/burn action only.
        </p>

        <div className="mt-10">
          <NlpVaultForm />
        </div>
      </div>
    </div>
  );
}
