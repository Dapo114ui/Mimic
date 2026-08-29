"use client";

import { useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import {
  CANCEL_ORDERS_TYPES,
  encodeSubaccount,
  generateNonce,
  getEndpointDomain,
  LIST_TRIGGER_ORDERS_TYPES,
} from "./eip712";
import { cancelTriggerOrders, getPendingTriggerOrders, type PendingTriggerOrder } from "./triggerOrders";
import { useLiveMarkets } from "./useLiveMarkets";

// Same 90s-of-100s-allowed window ORDER_RECV_WINDOW_MS uses for order nonces, applied here to
// ListTriggerOrders' own recvTime field — same deadline shape, different field name.
const LIST_RECV_WINDOW_MS = 90_000;

// Deliberately NOT auto-polling like useOpenOrders does for regular orders: every
// list_trigger_orders call needs its own freshly-signed ListTriggerOrders transaction (the
// recvTime deadline is capped at 100s from when the trigger service receives it), so silently
// refetching in the background would mean a wallet signature popup every few seconds. This
// hook instead exposes an explicit `load()` the UI calls on demand (mount + a refresh button).
export function useTriggerOrders() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { data: markets } = useLiveMarkets();
  const [orders, setOrders] = useState<PendingTriggerOrder[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelingDigest, setCancelingDigest] = useState<string | null>(null);

  async function load() {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    try {
      const sender = encodeSubaccount(address);
      const recvTime = BigInt(Date.now() + LIST_RECV_WINDOW_MS);
      const signature = await signTypedDataAsync({
        domain: getEndpointDomain(),
        types: LIST_TRIGGER_ORDERS_TYPES,
        primaryType: "ListTriggerOrders",
        message: { sender, recvTime },
      });
      const symbolMap = new Map((markets ?? []).map((m) => [m.productId, m.symbol]));
      const result = await getPendingTriggerOrders(sender, recvTime, signature, symbolMap);
      setOrders(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trigger orders");
    } finally {
      setIsLoading(false);
    }
  }

  async function cancel(productId: number, digest: string) {
    if (!address) return;
    setCancelingDigest(digest);
    setError(null);
    try {
      const sender = encodeSubaccount(address);
      const nonce = generateNonce();
      const productIds = [productId];
      const digests = [digest as `0x${string}`];

      const signature = await signTypedDataAsync({
        domain: getEndpointDomain(),
        types: CANCEL_ORDERS_TYPES,
        primaryType: "Cancellation",
        message: { sender, productIds, digests, nonce },
      });

      await cancelTriggerOrders({ sender, productIds, digests, nonce, signature });
      setOrders((prev) => prev?.filter((o) => o.digest !== digest) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelingDigest(null);
    }
  }

  return { orders, isLoading, error, load, cancel, cancelingDigest };
}
