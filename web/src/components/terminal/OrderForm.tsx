"use client";

import { type FormEvent, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useSignTypedData } from "wagmi";
import {
  buildAppendix,
  encodeSubaccount,
  generateNonce,
  getOrderDomain,
  ORDER_TYPE,
  ORDER_TYPES,
  TRIGGER_TYPE,
} from "@/lib/nado/eip712";
import { nadoExecute } from "@/lib/nado/client";
import { placeTriggerOrder, triggerExecutionPriceX18, triggerRequirementKey } from "@/lib/nado/triggerOrders";
import { useFeeRates } from "@/lib/nado/useFeeRates";
import { useOrderBook } from "@/lib/nado/useOrderBook";
import { formatPrice, formatUsd } from "@/lib/format";
import { BetaTradingWarning } from "./BetaTradingWarning";

// Trigger orders (TP/SL) aren't meant to expire on the same 30-day window a resting limit/market
// order uses — they're meant to sit until triggered, which could be weeks out. Nado's own trigger
// docs examples all use this exact value (4294967295 = 0xFFFFFFFF, year 2106) rather than a real
// deadline, so that's what's used here too rather than inventing a shorter one.
const TRIGGER_EXPIRATION = 4294967295n;

// Confirmed live: every perp product reports min_size 100 (identical across products priced from
// $0.0026 to $73k, so it's a dollar floor, not a unit count), and a real $79 order was rejected
// against it.
const MIN_NOTIONAL_USD = 100;

// How far beyond the best available book price a market order is allowed to chase before its IOC
// cancels the unfilled remainder instead of resting at a worse price. Nado's own UI doesn't
// expose this number, so 1% is this app's own choice, not something read off Nado — a
// conservative, standard slippage cap for this kind of order.
const MARKET_SLIPPAGE_BPS = 100n;

type OrderKind = "market" | "limit";

type Status =
  | { type: "idle" }
  | { type: "pending" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function OrderForm({
  productId,
  priceIncrementX18,
}: {
  productId: number;
  priceIncrementX18: bigint;
}) {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { data: fees } = useFeeRates(address);
  // depth=1 — a market order only ever needs the single best level on the side it crosses.
  const { data: book } = useOrderBook(productId, 1);

  const [kind, setKind] = useState<OrderKind>("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const bestLevel = side === "buy" ? book?.asks[0] : book?.bids[0];

  // Exact-BigInt worst-acceptable price for a market order: the best available price plus/minus
  // the slippage cap, rounded to a valid tick. Never derived through a float — the same
  // corruption `parseUnits` below already had to fix once for user-typed limit prices would
  // apply here too if this went through `Number` math instead.
  function marketLimitPriceX18(refX18: bigint): bigint {
    const increment = priceIncrementX18 > 0n ? priceIncrementX18 : 1n;
    const slippage = (refX18 * MARKET_SLIPPAGE_BPS) / 10_000n;
    const raw = side === "buy" ? refX18 + slippage : refX18 - slippage;
    const ticks = raw / increment;
    let rounded = ticks * increment;
    if (side === "buy" && rounded < raw) rounded += increment; // stay at least as aggressive as `raw`
    if (rounded <= 0n) rounded = increment; // guard a sell rounding through zero on a very cheap book
    return rounded;
  }

  // Display only — float math is fine here; the signed payload scales from exact BigInts either
  // way (parseUnits for a typed limit price, marketLimitPriceX18 for a market order).
  // Surfaced because Nado silently requires this and rejects with a message that reads like the
  // *price* is wrong ("...is too small. abs(amount) * price must be >= min_size"), which is a
  // confusing way to learn your order was simply worth less than $100.
  const sizeNum = Number(size);
  const priceNum =
    kind === "limit" ? Number(price) : bestLevel ? Number(marketLimitPriceX18(bestLevel.priceX18)) / 1e18 : null;
  const notional =
    Number.isFinite(sizeNum) && priceNum !== null && Number.isFinite(priceNum) && sizeNum > 0 && priceNum > 0
      ? sizeNum * priceNum
      : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!address) return;

    if (kind === "market" && !bestLevel) {
      setStatus({ type: "error", message: "No liquidity on that side of the book right now" });
      return;
    }
    if (notional === null) {
      setStatus({ type: "error", message: kind === "limit" ? "Enter a valid size and price" : "Enter a valid size" });
      return;
    }
    if (notional < MIN_NOTIONAL_USD) {
      setStatus({
        type: "error",
        message: `Order value ${formatUsd(notional)} is below Nado's ${formatUsd(MIN_NOTIONAL_USD)} minimum`,
      });
      return;
    }

    const hasTakeProfit = tpSlEnabled && takeProfitPrice.trim() !== "";
    const hasStopLoss = tpSlEnabled && stopLossPrice.trim() !== "";
    if (tpSlEnabled && !hasTakeProfit && !hasStopLoss) {
      setStatus({ type: "error", message: "Enter a take-profit and/or stop-loss price, or turn TP/SL off" });
      return;
    }
    // Sanity-check direction against the live reference price used for the main order — a TP
    // set below entry (long) or above entry (short) would trigger immediately/backwards, which
    // Nado's server has no way to reject as "wrong" since any price is structurally valid.
    const referencePrice = bestLevel?.price;
    if (referencePrice !== undefined) {
      if (hasTakeProfit) {
        const tp = Number(takeProfitPrice);
        const wrongSide = side === "buy" ? tp <= referencePrice : tp >= referencePrice;
        if (Number.isFinite(tp) && wrongSide) {
          setStatus({
            type: "error",
            message: `Take-profit price should be ${side === "buy" ? "above" : "below"} the current price`,
          });
          return;
        }
      }
      if (hasStopLoss) {
        const sl = Number(stopLossPrice);
        const wrongSide = side === "buy" ? sl >= referencePrice : sl <= referencePrice;
        if (Number.isFinite(sl) && wrongSide) {
          setStatus({
            type: "error",
            message: `Stop-loss price should be ${side === "buy" ? "below" : "above"} the current price`,
          });
          return;
        }
      }
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
      const priceX18 = kind === "limit" ? parseUnits(price, 18) : marketLimitPriceX18(bestLevel!.priceX18);
      if (amountMagnitude <= 0n || priceX18 <= 0n) {
        setStatus({ type: "error", message: "Size and price are too small to submit" });
        return;
      }
      const amount = amountMagnitude * (side === "buy" ? 1n : -1n);
      const nonce = generateNonce();
      const expiration = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
      // A real submitted order came back "Invalid Order Version: the order version in the
      // appendix, 0, does not match the expected version: 1" — Nado bumped the required version
      // since this was first verified against documentation (which said 0). Confirmed the fix
      // (not just the error) live: appendix=0 reproduces that exact rejection, appendix=1
      // clears it and reaches an unrelated later validation stage instead — see buildAppendix's
      // own comment in eip712.ts for the full order-type/reduce-only/trigger confirmation.
      const orderType = kind === "market" ? ORDER_TYPE.IOC : ORDER_TYPE.DEFAULT;
      const appendix = buildAppendix({ orderType, reduceOnly });

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

      // TP/SL legs are separate signed orders submitted to Nado's trigger service, not part of
      // the order just placed above — each is its own reduce-only, IOC, price-triggered Order
      // closing the position in the opposite direction once its price condition is met. Placed
      // sequentially (not Promise.all) so a wallet only ever has one signature prompt open at a
      // time; if the take-profit leg fails, the stop-loss is still attempted rather than
      // abandoned, and both outcomes are tracked (not inferred from error text) so the final
      // message says exactly what did and didn't go through.
      const closingSide = side === "buy" ? "sell" : "buy";
      const legsPlaced: string[] = [];
      const legFailures: string[] = [];

      async function placeTpSlLeg(legKind: "tp" | "sl", triggerPrice: string) {
        const label = legKind === "tp" ? "take-profit" : "stop-loss";
        try {
          const triggerPriceX18 = parseUnits(triggerPrice, 18);
          const legAmount = amountMagnitude * (closingSide === "buy" ? 1n : -1n);
          const legPriceX18 = triggerExecutionPriceX18(triggerPriceX18, closingSide, priceIncrementX18);
          const legNonce = generateNonce();
          const legAppendix = buildAppendix({
            orderType: ORDER_TYPE.IOC,
            reduceOnly: true,
            triggerType: TRIGGER_TYPE.PRICE,
          });
          const legOrder = {
            sender,
            priceX18: legPriceX18,
            amount: legAmount,
            expiration: TRIGGER_EXPIRATION,
            nonce: legNonce,
            appendix: legAppendix,
          };
          const legSignature = await signTypedDataAsync({
            domain: getOrderDomain(productId),
            types: ORDER_TYPES,
            primaryType: "Order",
            message: legOrder,
          });
          await placeTriggerOrder({
            productId,
            order: legOrder,
            requirementKey: triggerRequirementKey(side, legKind),
            triggerPriceX18,
            signature: legSignature,
          });
          legsPlaced.push(label);
        } catch (err) {
          legFailures.push(`${label} (${err instanceof Error ? err.message : "failed"})`);
        }
      }

      if (hasTakeProfit) await placeTpSlLeg("tp", takeProfitPrice);
      if (hasStopLoss) await placeTpSlLeg("sl", stopLossPrice);

      const successMessage = `${side === "buy" ? "Buy" : "Sell"} ${kind} order submitted${
        legsPlaced.length ? ` with ${legsPlaced.join(" + ")}` : ""
      }`;

      setStatus(
        legFailures.length > 0
          ? { type: "error", message: `${successMessage}, but ${legFailures.join(" and ")} failed to place` }
          : { type: "success", message: successMessage }
      );
      setSize("");
      setPrice("");
      setTakeProfitPrice("");
      setStopLossPrice("");
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
          {(["market", "limit"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`flex-1 rounded-xl border px-4 py-2 text-sm font-semibold capitalize transition ${
                kind === k
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-white/10 text-mist-dim hover:border-white/25"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

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

        {kind === "limit" ? (
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
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-mist-dim">Est. price ({side === "buy" ? "best ask" : "best bid"})</span>
              <span className="font-mono text-foreground">
                {bestLevel ? formatPrice(bestLevel.price) : "—"}
              </span>
            </div>
            <p className="mt-1 text-mist-dim">
              Fills immediately against the book. Won&apos;t pay more than 1% worse than the price
              above — anything left unfilled at that point cancels instead of resting.
            </p>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-mist">
          <input
            type="checkbox"
            checked={reduceOnly}
            onChange={(e) => setReduceOnly(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-ink-950 accent-accent"
          />
          Reduce only
        </label>

        <div>
          <label className="flex items-center gap-2 text-sm text-mist">
            <input
              type="checkbox"
              checked={tpSlEnabled}
              onChange={(e) => setTpSlEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-ink-950 accent-accent"
            />
            TP/SL
          </label>

          {tpSlEnabled && (
            <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-mist-dim">Take profit price</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={takeProfitPrice}
                  onChange={(e) => setTakeProfitPrice(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-2.5 font-mono text-foreground outline-none focus:border-accent/50"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-mist-dim">Stop loss price</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={stopLossPrice}
                  onChange={(e) => setStopLossPrice(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-4 py-2.5 font-mono text-foreground outline-none focus:border-accent/50"
                />
              </label>
              <p className="text-xs text-mist-dim">
                Each one is a separate reduce-only order placed with Nado&apos;s trigger service —
                expect a separate wallet signature for every price you set here, on top of the
                signature for the order above. They close the full position size once triggered
                and appear under Portfolio → Pending TP/SL orders, not in the regular order book.
              </p>
            </div>
          )}
        </div>

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
            {fees && kind === "market" && (
              <>
                <div className="flex justify-between">
                  <span className="text-mist-dim">
                    Fee (taker {(fees.takerRateFor(productId) * 100).toFixed(3)}%)
                  </span>
                  <span className="font-mono text-mist">
                    {formatUsd(notional * fees.takerRateFor(productId))}
                  </span>
                </div>
                <p className="pt-0.5 text-mist-dim">
                  Your real taker rate from Nado (fee tier {fees.feeTier}) — a market order always
                  crosses the book immediately, so it never earns the cheaper maker rate.
                </p>
              </>
            )}
            {fees && kind === "limit" && (
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
              disabled={status.type === "pending" || (kind === "market" && !bestLevel)}
              className={`w-full rounded-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                side === "buy" ? "bg-emerald-400 text-ink-950 hover:bg-emerald-300" : "bg-rose-400 text-ink-950 hover:bg-rose-300"
              }`}
            >
              {status.type === "pending" ? "Signing…" : `${side === "buy" ? "Buy" : "Sell"} ${kind}`}
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
