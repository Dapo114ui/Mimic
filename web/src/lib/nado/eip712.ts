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

// Best-effort: a plain increasing uint64 (ms timestamp * 1000 + jitter). Not verified against
// Nado's actual nonce-uniqueness/replay rules — only called from click handlers, never during
// render, so there's no SSR/hydration determinism concern here.
export function generateNonce(): bigint {
  return BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
}
