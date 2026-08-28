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
// is uint32[] specifically (not uint256[]), matching the SDK's own struct exactly.
export const CANCEL_ORDERS_TYPES = {
  Cancellation: [
    { name: "sender", type: "bytes32" },
    { name: "productIds", type: "uint32[]" },
    { name: "digests", type: "bytes32[]" },
    { name: "nonce", type: "uint64" },
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

// appendix bit layout: version:8 (bits 0-7), isolated:1 (bit 8), orderType:2 (bits 9-10),
// reduceOnly:1 (bit 11), trigger:2 (bits 12-13), reserved:50, value:64. Two of the four
// orderType values are directly confirmed against real gateway data: every plain order this
// form has ever placed used appendix=1 (orderType 0) and came back `order_type: "default"`; a
// real resting order was seen with `order_type: "post_only"` AND appendix "1537" in the same
// response — 1537 = version(1) | 3<<9, so orderType 3 decodes to post_only. Nado is a Vertex
// protocol fork (already relied on elsewhere: the "Cancellation" EIP-712 type name, the
// [initial, maintenance, unweighted] health group ordering) and Vertex's own OrderType enum is
// exactly {DEFAULT, IOC, FOK, POST_ONLY} in that order — matching both confirmed endpoints (0,
// 3) exactly, so 1 and 2 are taken to be IOC and FOK respectively.
//
// appendix=513 (IOC) is now confirmed live, not just inferred: a real `place_order` built with
// this exact appendix, a real product/sender/nonce/expiration, and a price computed by this
// form's own market-order logic against a real live order book — but signed by an unrelated
// throwaway key — was submitted straight to the gateway. It came back "The provided signature
// does not match with the sender's or the linked signer's" (error_code 2028), the same
// signer-mismatch stage a fully valid order would also have to clear, not an order-type or
// version rejection. A control run with the same throwaway-signed shape but a deliberately
// invalid appendix (version 99) came back "Invalid Order Version" instead — proving appendix
// content genuinely gets validated before that signer check, so IOC's clean pass through it
// means order type 1 is accepted, not just unreached. What's still unconfirmed is Nado's own
// semantics for it (does it actually behave as immediate-or-cancel) — that needs a real wallet
// to sign and a real fill/cancel to observe, which this sandbox can't do.
// IOC (immediate-or-cancel: cross whatever is available right now, cancel the remainder instead
// of resting) is the standard way CLOB protocols in this family implement "market" orders, which
// is what MARKET.IOC is used for below.
const ORDER_VERSION = 1n;
const ORDER_TYPE_BIT = 9n;

export const APPENDIX = {
  DEFAULT: ORDER_VERSION,
  IOC: ORDER_VERSION | (1n << ORDER_TYPE_BIT),
  FOK: ORDER_VERSION | (2n << ORDER_TYPE_BIT),
  POST_ONLY: ORDER_VERSION | (3n << ORDER_TYPE_BIT),
} as const;
