"use client";

import { type FormEvent, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useSignTypedData } from "wagmi";
import { BURN_NLP_TYPES, encodeSubaccount, getEndpointDomain, MINT_NLP_TYPES } from "@/lib/nado/eip712";
import { nadoExecute } from "@/lib/nado/client";
import { getTxNonce } from "@/lib/nado/account";
import { BetaTradingWarning } from "./BetaTradingWarning";

type Mode = "mint" | "burn";
type Status =
  | { type: "idle" }
  | { type: "pending" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function NlpVaultForm() {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const [mode, setMode] = useState<Mode>("mint");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const amountNum = Number(amount);
  const isSmallMint = mode === "mint" && amountNum > 0 && amountNum < 20;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!address) return;

    if (!amountNum || amountNum <= 0 || !Number.isFinite(amountNum)) {
      setStatus({ type: "error", message: "Enter a valid amount" });
      return;
    }

    setStatus({ type: "pending" });

    try {
      const sender = encodeSubaccount(address);
      // Exact decimal-string scaling, not `Number(x) * 1e18` — see the same fix in OrderForm:
      // float64 silently corrupts the low digits of an 18-decimal-scaled value.
      const scaledAmount = parseUnits(amount, 18);
      if (scaledAmount <= 0n) {
        setStatus({ type: "error", message: "Amount is too small to submit" });
        return;
      }
      // mint_nlp/burn_nlp use the strictly-sequential tx_nonce, not the timestamp-based nonce
      // orders use — fetched fresh right before signing since it's a "must equal exactly" value,
      // not just "must be greater than last used".
      const nonce = await getTxNonce(address);
      const domain = getEndpointDomain();

      if (mode === "mint") {
        const signature = await signTypedDataAsync({
          domain,
          types: MINT_NLP_TYPES,
          primaryType: "MintNlp",
          message: { sender, quoteAmount: scaledAmount, nonce },
        });
        await nadoExecute("mint_nlp", {
          tx: { sender, quoteAmount: scaledAmount.toString(), nonce: nonce.toString() },
          signature,
        });
        setStatus({ type: "success", message: "Mint submitted" });
      } else {
        const signature = await signTypedDataAsync({
          domain,
          types: BURN_NLP_TYPES,
          primaryType: "BurnNlp",
          message: { sender, nlpAmount: scaledAmount, nonce },
        });
        await nadoExecute("burn_nlp", {
          tx: { sender, nlpAmount: scaledAmount.toString(), nonce: nonce.toString() },
          signature,
        });
        setStatus({ type: "success", message: "Burn submitted" });
      }
      setAmount("");
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : `${mode} failed` });
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mt-0">
        <BetaTradingWarning context="vault" />
      </div>

      <div className="mt-5 flex gap-2">
        {(["mint", "burn"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-xl border px-4 py-2 text-sm font-semibold capitalize transition ${
              mode === m ? "border-accent/40 bg-accent/10 text-accent" : "border-white/10 text-mist-dim hover:border-white/25"
            }`}
          >
            {m} NLP
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-mist-dim">
            {mode === "mint" ? "Quote amount to deposit" : "NLP amount to redeem"}
          </span>
          <input
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-2.5 font-mono text-foreground outline-none focus:border-accent/50"
          />
          {mode === "mint" && (
            <p className="mt-1.5 text-xs text-mist-dim">
              Nado charges a flat ~$1 fee per mint — negligible on a large deposit, but a real
              chunk of a small one. The protocol minimum is $1, and minting exactly that nets you
              close to nothing after the fee.
            </p>
          )}
          {isSmallMint && (
            <p className="mt-1.5 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
              At ${amountNum.toLocaleString()}, that ~$1 flat fee eats a large share of this
              deposit. Consider minting more to make it worthwhile.
            </p>
          )}
          {mode === "burn" && (
            <p className="mt-1.5 text-xs text-mist-dim">
              Burning also charges a fee, and Nado rejects any burn worth less than it — a real
              0.9 NLP (~$0.96) burn was rejected on that basis, so the fee is at least that. Nado
              doesn&apos;t expose the exact figure anywhere, so this can only be bounded, not
              stated. Burn well above ~1 NLP, or expect a rejection.
            </p>
          )}
        </label>

        {!isConnected ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-center text-sm text-mist-dim">
            Connect a wallet to {mode} NLP
          </p>
        ) : (
          <button
            type="submit"
            disabled={status.type === "pending"}
            className="w-full rounded-full bg-accent px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status.type === "pending" ? "Signing…" : `${mode === "mint" ? "Mint" : "Burn"} NLP`}
          </button>
        )}

        {status.type === "success" && <p className="text-center text-sm text-emerald-400">{status.message}</p>}
        {status.type === "error" && <p className="text-center text-sm text-rose-400">{status.message}</p>}
      </form>
    </div>
  );
}
