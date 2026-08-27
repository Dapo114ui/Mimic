// Shared shapes for chart and trade-tape data. These used to live in `lib/markets.ts` alongside
// a hand-written sample market list; that list is gone — every market now comes from Nado at
// runtime (`lib/nado/markets.ts`) — but the types are still the contract between the indexer
// client and the components that render its output.

/** `time` is a unix second timestamp. */
export type Candle = { time: string | number; open: number; high: number; low: number; close: number };

export type Fill = { side: "Long" | "Short"; price: number; sizeUsd: number; timestamp: string };
