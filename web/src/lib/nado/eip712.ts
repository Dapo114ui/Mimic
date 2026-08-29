import { concat, pad, toHex, type Address, type Hex } from "viem";
import { NADO_CHAIN_ID, NADO_ENDPOINT_CONTRACT } from "./config";

export const NADO_EIP712_DOMAIN_NAME = "Nado";
export const NADO_EIP712_DOMAIN_VERSION = "0.0.1";

// verifyingContract for orders is address(uint160(productId)), per
// packages/shared/src/eip712/getOrderVerifyingAddress.ts in the SDK.
export function getOrderVerifyingContract(productId: number): Address {
  return toHex(productId, { size: 20 });
}

export function getOrderDomain(productId: number) {
  return {
    name: NADO_EIP712_DOMAIN_NAME,
    version: NADO_EIP712_DOMAIN_VERSION,
    chainId: NADO_CHAIN_ID,
    verifyingContract: getOrderVerifyingContract(productId),
  } as const;
}

// Every other execute (mint/burn NLP, cancel, withdraw, ...) verifies against the endpoint
// (sequencer) contract directly, not a per-product address.
export function getEndpointDomain() {
  return {
    name: NADO_EIP712_DOMAIN_NAME,
    version: NADO_EIP712_DOMAIN_VERSION,
    chainId: NADO_CHAIN_ID,
    verifyingContract: NADO_ENDPOINT_CONTRACT as Address,
  } as const;
}

// bytes32 = 20-byte owner address ++ 12-byte subaccount name (UTF-8, right-padded with zeros).
// The default subaccount's name is the literal string "default", not an empty string — an
// earlier version of this comment claimed otherwise, from Nado/Vertex-family docs read as
// saying an all-zero name was "the default subaccount identifier". That was wrong: every real
// `sender`/subaccount hex observed live this session (across many different accounts, in order
// and match data) decodes its trailing 12 bytes to ASCII "default" + zero padding, never all
// zeros. An all-zero name is a different, non-existent subaccount — which is exactly what made
// a real funded wallet look account-less on the portfolio page (`subaccount_info` correctly
// reported `exists: false` for the wrong, empty-named subaccount this function used to build).
export function encodeSubaccount(owner: Address, name: string = "default"): Hex {
  const nameBytes = new TextEncoder().encode(name).slice(0, 12);
  const nameHex = pad(toHex(nameBytes), { size: 12, dir: "right" });
  return concat([owner, nameHex]);
}

export const ORDER_TYPES = {
  Order: [
    { name: "sender", type: "bytes32" },
    { name: "priceX18", type: "int128" },
    { name: "amount", type: "int128" },
    { name: "expiration", type: "uint64" },
    { name: "nonce", type: "uint64" },
    { name: "appendix", type: "uint128" },
  ],
} as const;

export const MINT_NLP_TYPES = {
  MintNlp: [
    { name: "sender", type: "bytes32" },
    { name: "quoteAmount", type: "uint128" },
    { name: "nonce", type: "uint64" },
  ],
} as const;

export const BURN_NLP_TYPES = {
  BurnNlp: [
    { name: "sender", type: "bytes32" },
    { name: "nlpAmount", type: "uint128" },
    { name: "nonce", type: "uint64" },
  ],
} as const;

// Confirmed against packages/shared/src/eip712/getNadoEIP712Types.ts in the SDK — the primary
// type name is "Cancellation", not the more obvious-looking "CancelOrders" guess. `productIds`
// is uint32[] specifically (not uint256[]), matching the SDK's own struct exactly. Also the
// type signed for the *trigger* service's cancel_orders — confirmed by docs.nado.xyz, which
// points its trigger cancel-orders page straight at the gateway's Cancellation signing section
// rather than defining a separate type.
export const CANCEL_ORDERS_TYPES = {
  Cancellation: [
    { name: "sender", type: "bytes32" },
    { name: "productIds", type: "uint32[]" },
    { name: "digests", type: "bytes32[]" },
    { name: "nonce", type: "uint64" },
  ],
} as const;

// Trigger-service-only: authenticates a read of your own pending TP/SL/TWAP orders. Confirmed
// against docs.nado.xyz's Signing page (Domain section) — every non-place_order execute/query
// signs against the endpoint contract, same as Cancellation/MintNlp/BurnNlp above, and this is
// the one new struct type the trigger service adds beyond what the gateway already has.
export const LIST_TRIGGER_ORDERS_TYPES = {
  ListTriggerOrders: [
    { name: "sender", type: "bytes32" },
    { name: "recvTime", type: "uint64" },
  ],
} as const;

// How long a signed order stays submittable. The nonce's recv_time is a deadline: the gateway
// rejects a request that arrives after it, AND one that arrives more than 100s before it (both
// limits confirmed live by probing the boundary). Since the nonce is baked into the signed
// payload, this window has to be picked *before* the user sees their wallet prompt — so it's
// really "how long the user gets to review and confirm". 90s takes almost all of the 100s
// allowance: confirm instantly and the request still lands ~90s early (inside the cap); take up
// to ~90s to confirm and it still lands before the deadline.
const ORDER_RECV_WINDOW_MS = 90_000;

// For ORDER nonces only. Not an arbitrary increasing number: the top 44 bits are a millisecond
// `recv_time` timestamp and the low 20 bits are random — decoded straight out of real order
// nonces seen in live gateway/indexer data, every one of which shifts down (>> 20) to exactly
// the wall-clock time that order was placed. The previous implementation here (`Date.now() *
// 1000 + jitter`) produced a number of roughly the right magnitude but the wrong *shape*: it
// decoded to a 1970 timestamp, so every order was rejected with "Request received after
// 'recv_time'" — the error a real order surfaced. `tx_nonce` — used by mint_nlp/burn_nlp and
// anything else wrapping its payload in a `tx` object — is a different thing again: a small,
// strictly-sequential counter that must be read fresh from the gateway's `nonces` query
// (`account.ts`'s `getTxNonce`), never generated.
export function generateNonce(): bigint {
  const recvTimeMs = BigInt(Date.now() + ORDER_RECV_WINDOW_MS);
  const random = BigInt(Math.floor(Math.random() * 2 ** 20));
  return (recvTimeMs << 20n) | random;
}

// appendix bit layout, now confirmed directly against Nado's own docs (docs.nado.xyz's Order
// Appendix page) rather than inferred: version:8 (bits 0-7, "Currently 1"), isolated:1 (bit 8),
// orderType:2 (bits 9-10), reduceOnly:1 (bit 11), trigger:2 (bits 12-13), reserved:24 (must be
// 0), builderFeeRate:10 (bits 38-47), builder:16 (bits 48-63), value:64 (bits 64-127, meaning
// depends on trigger/isolated). The order-type and reduce-only bits were already independently
// verified live before this doc was found — every plain order this form has placed used
// appendix=1 (orderType 0, "default"); a real resting order came back with `order_type:
// "post_only"` and appendix "1537" (= version(1) | 3<<9) in the same response; and a
// throwaway-signed order with appendix=513 (IOC, version(1) | 1<<9) reached the same
// signer-mismatch stage a fully valid order would, while a deliberately wrong version got a
// distinct "Invalid Order Version" rejection instead — proving appendix content is genuinely
// checked, not just unreached. The docs confirm the exact enum: orderType
// {0:DEFAULT, 1:IOC, 2:FOK, 3:POST_ONLY}, triggerType {0:NONE, 1:PRICE, 2:TWAP, 3:TWAP_CUSTOM}.
//
// One live discrepancy the docs themselves have: the general Order Appendix page's own
// manual-bit-manipulation example sets version=1 for every appendix, including trigger orders,
// but the separate Trigger > Place Order page's example hardcodes "Version (bits 0-7): Always
// 0" for trigger orders specifically and computes a result consistent with that (4096, not
// 4097). That page is also stamped "last updated 9 months ago" — plausibly stale from before
// the same version 0→1 bump this codebase already had to work around once for the gateway (see
// the note in OrderForm.tsx). Resolved live rather than guessed either way: a throwaway-signed
// trigger place_order with version=1, reduceOnly=1, triggerType=PRICE (appendix=6145) submitted
// straight to https://trigger.prod.nado.xyz/v1/execute reached the same signer-mismatch stage,
// using the exact same Order type/domain as the gateway — confirming version=1 is correct for
// trigger orders too, and that trigger orders sign against the standard per-product order
// domain, not a separate one.
const ORDER_VERSION = 1n;
const ORDER_TYPE_BIT = 9n;
const REDUCE_ONLY_BIT = 11n;
const TRIGGER_TYPE_BIT = 12n;

export const ORDER_TYPE = { DEFAULT: 0n, IOC: 1n, FOK: 2n, POST_ONLY: 3n } as const;
export const TRIGGER_TYPE = { NONE: 0n, PRICE: 1n, TWAP: 2n, TWAP_CUSTOM_AMOUNTS: 3n } as const;

export function buildAppendix({
  orderType = ORDER_TYPE.DEFAULT,
  reduceOnly = false,
  triggerType = TRIGGER_TYPE.NONE,
}: {
  orderType?: bigint;
  reduceOnly?: boolean;
  triggerType?: bigint;
} = {}): bigint {
  let appendix = ORDER_VERSION;
  appendix |= orderType << ORDER_TYPE_BIT;
  if (reduceOnly) appendix |= 1n << REDUCE_ONLY_BIT;
  appendix |= triggerType << TRIGGER_TYPE_BIT;
  return appendix;
}
