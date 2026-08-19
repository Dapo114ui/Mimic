// Real endpoints and on-chain details for Nado's gateway API, sourced from
// github.com/nadohq/nado-typescript-sdk (packages/engine-client/src/endpoints.ts and
// packages/shared/src/deployments/core/deployment.inkSepolia.json). NADO_QUOTE_TOKEN was
// cross-checked against a live `all_products` query against the testnet gateway and matches
// exactly, which is the strongest evidence available that the deployment file is accurate.
//
// Defaults to TESTNET (Ink Sepolia) throughout — there is no funded wallet in this environment
// to validate a real signed order round-trip, so mainnet is intentionally not wired up here.

export const NADO_CHAIN_ID = 763373; // Ink Sepolia

export const NADO_GATEWAY_REST = "https://gateway.test.nado.xyz/v1";
export const NADO_GATEWAY_WS = "wss://gateway.test.nado.xyz/v1/ws";

// The "endpoint" (sequencer) contract — the EIP-712 verifying contract for every execute
// EXCEPT place_order/cancel_orders, which instead verify against address(productId).
export const NADO_ENDPOINT_CONTRACT = "0x698D87105274292B5673367DEC81874Ce3633Ac2" as const;

// Quote/collateral token (product 0). Confirmed live against the gateway's own
// `all_products` response — matches exactly.
export const NADO_QUOTE_TOKEN = "0x60F50F902b2E91aef7D6c700Eb22599e297fa86F" as const;

// Only product IDs identified with high confidence: BTC and ETH oracle prices are
// unmistakable in the live `all_products` response. Nado's gateway has no symbol/ticker field
// in that response, so the rest of the ~75 perp markets can't be reliably named without their
// separate indexer/metadata service, which isn't wired up here.
export const KNOWN_PRODUCTS = {
  "BTC-PERP": 2,
  "ETH-PERP": 4,
} as const;
