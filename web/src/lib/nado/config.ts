// Real endpoints and on-chain details for Nado's gateway API, sourced from
// github.com/nadohq/nado-typescript-sdk (packages/engine-client/src/endpoints.ts and
// packages/shared/src/deployments/core/deployment.inkMainnet.json). NADO_QUOTE_TOKEN and the
// BTC/ETH product IDs below were cross-checked against a live `all_products` query against
// THIS gateway (not just the testnet one) — the quote token address matches the deployment
// file exactly, and product 3's spot token is 0x4200...0006, the canonical WETH predeploy
// address shared by every OP-Stack chain, which is about as strong a confirmation as this
// kind of cross-check gets.
//
// MAINNET. Real funds, real orders. This environment has no funded wallet, so no signed
// order/mint/burn has actually round-tripped through this gateway end to end — see
// BetaTradingWarning for what that means in practice.

export const NADO_CHAIN_ID = 57073; // Ink mainnet

export const NADO_GATEWAY_REST = "https://gateway.prod.nado.xyz/v1";
export const NADO_GATEWAY_WS = "wss://gateway.prod.nado.xyz/v1/ws";

// The archive (indexer) service — historical/aggregate data the low-latency gateway above
// doesn't have (24h volume, price history, a computed funding rate). Verified live: CORS is
// open here too, `funding_rate` returns a real per-product rate, and `market_snapshots`'
// oracle prices track the gateway's live price within fractions of a percent.
export const NADO_INDEXER_REST = "https://archive.prod.nado.xyz/v1";

// The "endpoint" (sequencer) contract — the EIP-712 verifying contract for every execute
// EXCEPT place_order/cancel_orders, which instead verify against address(productId).
export const NADO_ENDPOINT_CONTRACT = "0x05ec92D78ED421f3D3Ada77FFdE167106565974E" as const;

// Quote/collateral token (product 0). Confirmed live against the gateway's own
// `all_products` response — matches exactly.
export const NADO_QUOTE_TOKEN = "0x0200C29006150606B650577BBE7B6248F58470c1" as const;

// Only product IDs identified with high confidence: BTC and ETH oracle prices are
// unmistakable in the live `all_products` response (and product 3's spot token address
// confirms ETH beyond doubt — see above). Nado's gateway has no symbol/ticker field in that
// response, so the rest of the ~75 perp markets can't be reliably named without their
// separate indexer/metadata service, which isn't wired up here.
export const KNOWN_PRODUCTS = {
  "BTC-PERP": 2,
  "ETH-PERP": 4,
} as const;
