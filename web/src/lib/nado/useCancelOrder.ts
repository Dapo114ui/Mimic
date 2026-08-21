"use client";

import { useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { CANCEL_ORDERS_TYPES, encodeSubaccount, getEndpointDomain } from "./eip712";
import { getTxNonce } from "./account";
import { nadoExecute } from "./client";

// Same tx-wrapper/tx_nonce pattern confirmed for mint_nlp/burn_nlp, and the same EIP-712 domain
// (endpoint/sequencer contract, not the per-product order-verifying address place_order uses) —
// confirmed against the SDK's cancelOrders() (packages/client/src/apis/market/MarketExecuteAPI.ts).
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
      const nonce = await getTxNonce(address);
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
