"use client";

import { type FormEvent, useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { BURN_NLP_TYPES, encodeSubaccount, generateNonce, getEndpointDomain, MINT_NLP_TYPES } from "@/lib/nado/eip712";
import { nadoExecute } from "@/lib/nado/client";
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!address) return;

    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setStatus({ type: "error", message: "Enter a valid amount" });
      return;
    }

    setStatus({ type: "pending" });

    try {
      const sender = encodeSubaccount(address);
      const scaledAmount = BigInt(Math.round(amountNum * 1e18));
      const nonce = generateNonce();
      const domain = getEndpointDomain();

      if (mode === "mint") {
        const signature = await signTypedDataAsync({
          domain,
          types: MINT_NLP_TYPES,
          primaryType: "MintNlp",
          message: { sender, quoteAmount: scaledAmount, nonce },
        });
        await nadoExecute("mint_nlp", {
          sender,
          quoteAmount: scaledAmount.toString(),
          nonce: nonce.toString(),
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
          sender,
          nlpAmount: scaledAmount.toString(),
          nonce: nonce.toString(),
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
        <BetaTradingWarning />
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
