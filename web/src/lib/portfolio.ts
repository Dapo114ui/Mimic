// Sample account data standing in for a real connected wallet's Nado account. There is no
// backend here that can look up a real address's positions or fills, so this is shown
// regardless of wallet-connection state and clearly labeled as sample data in the UI — never
// implied to be the connected wallet's actual portfolio.

export type Side = "Long" | "Short";

export type Position = {
  market: string;
  side: Side;
  sizeUsd: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnlUsd: number;
};

export type Trade = {
  market: string;
  side: Side;
  sizeUsd: number;
  pnlUsd: number;
  pnlPct: number;
  closedAt: string;
};

export type AccountSummary = {
  equityUsd: number;
  availableMarginUsd: number;
  marginRatioPct: number;
  unrealizedPnlUsd: number;
};

export const ACCOUNT_SUMMARY: AccountSummary = {
  equityUsd: 187420,
  availableMarginUsd: 94600,
  marginRatioPct: 18.4,
  unrealizedPnlUsd: 1630,
};

export const OPEN_POSITIONS: Position[] = [
  { market: "BTC-PERP", side: "Long", sizeUsd: 42000, entryPrice: 96800, markPrice: 98650, unrealizedPnlUsd: 820 },
  { market: "ETH-PERP", side: "Short", sizeUsd: 18500, entryPrice: 3240, markPrice: 3205, unrealizedPnlUsd: 200 },
  { market: "SOL-PERP", side: "Long", sizeUsd: 9600, entryPrice: 172.1, markPrice: 191.4, unrealizedPnlUsd: 1080 },
  { market: "ARB-PERP", side: "Long", sizeUsd: 6200, entryPrice: 1.18, markPrice: 1.09, unrealizedPnlUsd: -470 },
];

export const RECENT_TRADES: Trade[] = [
  { market: "DOGE-PERP", side: "Short", sizeUsd: 8400, pnlUsd: 310, pnlPct: 3.7, closedAt: "2026-08-18T09:12:00Z" },
  { market: "OP-PERP", side: "Long", sizeUsd: 5100, pnlUsd: -180, pnlPct: -3.5, closedAt: "2026-08-17T22:40:00Z" },
  { market: "BTC-PERP", side: "Long", sizeUsd: 30000, pnlUsd: 1240, pnlPct: 4.1, closedAt: "2026-08-16T14:05:00Z" },
  { market: "SOL-PERP", side: "Long", sizeUsd: 7800, pnlUsd: 540, pnlPct: 6.9, closedAt: "2026-08-14T18:30:00Z" },
  { market: "ETH-PERP", side: "Short", sizeUsd: 12000, pnlUsd: -260, pnlPct: -2.2, closedAt: "2026-08-11T07:50:00Z" },
];
