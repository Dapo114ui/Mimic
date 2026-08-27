"use client";

import { type FormEvent, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useSignTypedData } from "wagmi";
import { encodeSubaccount, generateNonce, getOrderDomain, ORDER_TYPES } from "@/lib/nado/eip712";
import { nadoExecute } from "@/lib/nado/client";
import { BetaTradingWarning } from "./BetaTradingWarning";

type Status =
  | { type: "idle" }
  | { type: "pending" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function OrderForm({ productId }: { productId: number }) {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!address) return;

    if (Number(size) <= 0 || Number(price) <= 0 || !Number.isFinite(Number(size)) || !Number.isFinite(Number(price))) {
      setStatus({ type: "error", message: "Enter a valid size and price" });
      return;
    }

    setStatus({ type: "pending" });

    try {
      const sender = encodeSubaccount(address);
      // Scale from the raw input STRING, never via `Number(x) * 1e18` — float64 can't hold an
      // 18-decimal-scaled price exactly, so that silently corrupted the low digits: a real order
      // at a clean price of 79064 went out as 79063999999999993708544 and was rejected with
      // "not divisible by the price_increment_x18". The user's input was valid; the arithmetic
      // wasn't. `parseUnits` does exact decimal-string → BigInt scaling with no float step.
      const amountMagnitude = parseUnits(size, 18);
      const priceX18 = parseUnits(price, 18);
      if (amountMagnitude <= 0n || priceX18 <= 0n) {
        setStatus({ type: "error", message: "Size and price are too small to submit" });
        return;
      }
      const amount = amountMagnitude * (side === "buy" ? 1n : -1n);
      const nonce = generateNonce();
      const expiration = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
      // version 1 (lowest 8 bits), not isolated, order type 0 (DEFAULT/standard limit order),
      // not reduce-only, no trigger — i.e. exactly the plain limit order this form places.
      // A real submitted order came back "Invalid Order Version: the order version in the
      // appendix, 0, does not match the expected version: 1" — Nado bumped the required
      // version since this was first verified against documentation (which said 0). Confirmed
      // the fix (not just the error) live: appendix=0 reproduces that exact rejection,
      // appendix=1 clears it and reaches an unrelated later validation stage instead.
      const appendix = 1n;

      const signature = await signTypedDataAsync({
        domain: getOrderDomain(productId),
        types: ORDER_TYPES,
        primaryType: "Order",
        message: { sender, priceX18, amount, expiration, nonce, appendix },
      });

      await nadoExecute("place_order", {
        product_id: productId,
        order: {
          sender,
          priceX18: priceX18.toString(),
          amount: amount.toString(),
          expiration: expiration.toString(),
          nonce: nonce.toString(),
          appendix: appendix.toString(),
        },
        signature,
        spot_leverage: null,
        borrow_margin: null,
      });

      setStatus({ type: "success", message: `${side === "buy" ? "Buy" : "Sell"} order submitted` });
      setSize("");
      setPrice("");
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Order failed" });
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-lg font-medium text-foreground">Place order</h2>
      <div className="mt-4">
        <BetaTradingWarning />
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="flex gap-2">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`flex-1 rounded-xl border px-4 py-2 text-sm font-semibold capitalize transition ${
                side === s
                  ? s === "buy"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-400"
                    : "border-rose-400/40 bg-rose-400/10 text-rose-400"
                  : "border-white/10 text-mist-dim hover:border-white/25"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-mist-dim">Size</span>
          <input
            type="number"
            step="any"
            min="0"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-2.5 font-mono text-foreground outline-none focus:border-accent/50"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-wider text-mist-dim">Limit price</span>
          <input
            type="number"
            step="any"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-2.5 font-mono text-foreground outline-none focus:border-accent/50"
          />
        </label>

        {!isConnected ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-center text-sm text-mist-dim">
            Connect a wallet to place an order
          </p>
        ) : (
          <>
            <button
              type="submit"
              disabled={status.type === "pending"}
              className={`w-full rounded-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                side === "buy" ? "bg-emerald-400 text-ink-950 hover:bg-emerald-300" : "bg-rose-400 text-ink-950 hover:bg-rose-300"
              }`}
            >
              {status.type === "pending" ? "Signing…" : side === "buy" ? "Buy" : "Sell"}
            </button>
            {status.type === "pending" && (
              <p className="text-center text-xs text-mist-dim">
                Confirm in your wallet within ~90s — a signed order carries a deadline, and Nado
                rejects it after that. If it expires, just place the order again.
              </p>
            )}
          </>
        )}

        {status.type === "success" && (
          <p className="text-center text-sm text-emerald-400">{status.message}</p>
        )}
        {status.type === "error" && <p className="text-center text-sm text-rose-400">{status.message}</p>}
      </form>
    </div>
  );
}
