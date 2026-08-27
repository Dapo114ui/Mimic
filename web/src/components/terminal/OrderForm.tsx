"use client";

import { type FormEvent, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useSignTypedData } from "wagmi";
import { encodeSubaccount, generateNonce, getOrderDomain, ORDER_TYPES } from "@/lib/nado/eip712";
import { nadoExecute } from "@/lib/nado/client";
import { useFeeRates } from "@/lib/nado/useFeeRates";
import { formatUsd } from "@/lib/format";
import { BetaTradingWarning } from "./BetaTradingWarning";

// Confirmed live: every perp product reports min_size 100 (identical across products priced from
// $0.0026 to $73k, so it's a dollar floor, not a unit count), and a real $79 order was rejected
// against it.
const MIN_NOTIONAL_USD = 100;

type Status =
  | { type: "idle" }
  | { type: "pending" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function OrderForm({ productId }: { productId: number }) {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { data: fees } = useFeeRates(address);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });

  // Display only — float math is fine here; the signed payload scales from the strings exactly.
  // Surfaced because Nado silently requires this and rejects with a message that reads like the
  // *price* is wrong ("...is too small. abs(amount) * price must be >= min_size"), which is a
  // confusing way to learn your order was simply worth less than $100.
  const sizeNum = Number(size);
  const priceNum = Number(price);
  const notional =
    Number.isFinite(sizeNum) && Number.isFinite(priceNum) && sizeNum > 0 && priceNum > 0
      ? sizeNum * priceNum
      : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!address) return;

    if (notional === null) {
      setStatus({ type: "error", message: "Enter a valid size and price" });
      return;
    }
    if (notional < MIN_NOTIONAL_USD) {
      setStatus({
        type: "error",
        message: `Order value ${formatUsd(notional)} is below Nado's ${formatUsd(MIN_NOTIONAL_USD)} minimum`,
      });
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

        {notional !== null && (
          <div className="space-y-1 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
            <div className="flex justify-between">
              <span className="text-mist-dim">Order value</span>
              <span className={`font-mono ${notional < MIN_NOTIONAL_USD ? "text-amber-300" : "text-mist"}`}>
                {formatUsd(notional)}
              </span>
            </div>
            {notional < MIN_NOTIONAL_USD && (
              <p className="text-amber-300">Below Nado&apos;s {formatUsd(MIN_NOTIONAL_USD)} minimum order value</p>
            )}
            {fees && (
              <>
                <div className="flex justify-between">
                  <span className="text-mist-dim">
                    Fee if it rests (maker {(fees.makerRateFor(productId) * 100).toFixed(3)}%)
                  </span>
                  <span className="font-mono text-mist">
                    {formatUsd(notional * fees.makerRateFor(productId))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-mist-dim">
                    Fee if it fills now (taker {(fees.takerRateFor(productId) * 100).toFixed(3)}%)
                  </span>
                  <span className="font-mono text-mist">
                    {formatUsd(notional * fees.takerRateFor(productId))}
                  </span>
                </div>
                <p className="pt-0.5 text-mist-dim">
                  Your real rates from Nado (fee tier {fees.feeTier}) — a limit order pays the
                  maker rate if it rests on the book, the taker rate if it crosses and fills
                  immediately.
                </p>
              </>
            )}
          </div>
        )}

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
