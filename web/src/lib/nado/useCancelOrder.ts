"use client";

import { useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { CANCEL_ORDERS_TYPES, encodeSubaccount, generateNonce, getEndpointDomain } from "./eip712";
import { nadoExecute } from "./client";

// Signs against the endpoint/sequencer contract, not the per-product order-verifying address
// place_order uses — confirmed against the SDK's cancelOrders()
// (packages/client/src/apis/market/MarketExecuteAPI.ts).
//
// The nonce is the ORDER-style recv_time-encoded one (`generateNonce`), NOT the sequential
// `tx_nonce` that mint_nlp/burn_nlp need. This was originally the other way round here, inferred
// from cancel_orders sharing their `{tx: {...}, signature}` payload shape — a misleading signal:
// payload shape does not predict nonce class. A real cancel failed with "Request received after
// 'recv_time'" (the sequential counter, 1, decodes as a 1970 timestamp). Verified both ways
// against the live gateway on a real resting order: tx_nonce reproduces that exact rejection,
// while a recv_time nonce clears every stage through to signature verification.
export function useCancelOrder() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [cancelingDigest, setCancelingDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      await nadoExecute("cancel_orders", {
        tx: { sender, productIds, digests, nonce: nonce.toString() },
        signature,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cancel failed";
      setError(message);
      throw new Error(message);
    } finally {
      setCancelingDigest(null);
    }
  }

  return { cancel, cancelingDigest, error };
}
