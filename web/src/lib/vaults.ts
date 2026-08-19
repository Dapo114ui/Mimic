// Sample vault data. No MimicVaultFactory is deployed on any chain yet, so there is nothing
// real to read — this stands in for what a `useReadContracts` call against the factory's
// vault registry, plus a Nado API call for positions/fills, would return once both exist.
// Swap this module out, not its shape.

export type StrategyTag = "Perps" | "Spot + Perps" | "Market Neutral" | "Momentum";
export type Side = "Long" | "Short" | "Neutral";

export type Strategist = {
  handle: string;
  address: string;
  bio: string;
  tradingSince: string; // ISO date
  winRatePct: number;
  totalTrades: number;
};

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
  closedAt: string; // ISO datetime
};

export type Vault = {
  slug: string;
  name: string;
  strategist: Strategist;
  performanceFeeBps: number;
  tvlUsd: number;
  allTimeReturnPct: number;
  followers: number;
  inceptionDate: string;
  tag: StrategyTag;
  description: string;
  openPositions: Position[];
  recentTrades: Trade[];
};

const VAULTS: Vault[] = [
  {
    slug: "altcoin-momentum",
    name: "Altcoin Momentum",
    performanceFeeBps: 2500,
    tvlUsd: 96700,
    allTimeReturnPct: 52.9,
    followers: 203,
    inceptionDate: "2026-03-02",
    tag: "Perps",
    description:
      "High-conviction directional bets on mid-cap alt perps, sized aggressively once momentum confirms. Highest fee tier on Mimic, reflecting the highest realized variance.",
    strategist: {
      handle: "@altwave",
      address: "0x4f2A9E7c1B3d5F608A1c2E4B7D9F0123456789Ab",
      bio: "Full-time trader since 2021. Rotates into mid-cap alt perps the moment momentum confirms, cuts losers fast.",
      tradingSince: "2024-08-01",
      winRatePct: 61,
      totalTrades: 312,
    },
    openPositions: [
      { market: "SOL-PERP", side: "Long", sizeUsd: 38400, entryPrice: 178.2, markPrice: 191.4, unrealizedPnlUsd: 2830 },
      { market: "ARB-PERP", side: "Short", sizeUsd: 21000, entryPrice: 1.14, markPrice: 1.09, unrealizedPnlUsd: 920 },
    ],
    recentTrades: [
      { market: "SOL-PERP", side: "Long", sizeUsd: 42000, pnlUsd: 4120, pnlPct: 9.8, closedAt: "2026-08-17T14:20:00Z" },
      { market: "DOGE-PERP", side: "Long", sizeUsd: 21600, pnlUsd: -1340, pnlPct: -6.2, closedAt: "2026-08-15T09:05:00Z" },
      { market: "AVAX-PERP", side: "Long", sizeUsd: 24200, pnlUsd: 2760, pnlPct: 11.4, closedAt: "2026-08-12T20:40:00Z" },
      { market: "OP-PERP", side: "Short", sizeUsd: 21700, pnlUsd: 890, pnlPct: 4.1, closedAt: "2026-08-09T11:15:00Z" },
    ],
  },
  {
    slug: "btc-momentum",
    name: "BTC Momentum",
    performanceFeeBps: 2000,
    tvlUsd: 482300,
    allTimeReturnPct: 34.2,
    followers: 128,
    inceptionDate: "2026-01-18",
    tag: "Perps",
    description:
      "Trend-following BTC perp positions on Nado, scaling leverage with realized volatility. No discretionary alt exposure — single-market focus.",
    strategist: {
      handle: "@trendrider_btc",
      address: "0x71C4a8F2D905e3B1C7A6890Fedcba0987654321",
      bio: "Single-market discipline. Trades BTC perps only, scales size with realized vol, never touches alts.",
      tradingSince: "2025-09-10",
      winRatePct: 58,
      totalTrades: 146,
    },
    openPositions: [
      { market: "BTC-PERP", side: "Long", sizeUsd: 210000, entryPrice: 94200, markPrice: 98650, unrealizedPnlUsd: 9920 },
    ],
    recentTrades: [
      { market: "BTC-PERP", side: "Long", sizeUsd: 200000, pnlUsd: 14200, pnlPct: 7.1, closedAt: "2026-08-18T06:30:00Z" },
      { market: "BTC-PERP", side: "Short", sizeUsd: 162000, pnlUsd: -3900, pnlPct: -2.4, closedAt: "2026-08-14T17:50:00Z" },
      { market: "BTC-PERP", side: "Long", sizeUsd: 163000, pnlUsd: 8650, pnlPct: 5.3, closedAt: "2026-08-10T22:10:00Z" },
      { market: "BTC-PERP", side: "Long", sizeUsd: 170000, pnlUsd: 5100, pnlPct: 3.0, closedAt: "2026-08-05T13:00:00Z" },
    ],
  },
  {
    slug: "conservative-carry",
    name: "Conservative Carry",
    performanceFeeBps: 1000,
    tvlUsd: 640200,
    allTimeReturnPct: 9.1,
    followers: 312,
    inceptionDate: "2025-12-05",
    tag: "Market Neutral",
    description:
      "Delta-neutral funding-rate carry across Nado's major perp markets. Lower variance, lower fee — built for capital that wants yield, not direction.",
    strategist: {
      handle: "@steadycarry",
      address: "0x9Ab6C3D8E1F4257b9a0c8D6E4F1234567890AbC",
      bio: "Capital preservation first. Delta-neutral carry across majors, sized to survive the fat-tail week, not just the average one.",
      tradingSince: "2025-08-01",
      winRatePct: 91,
      totalTrades: 268,
    },
    openPositions: [
      { market: "BTC-PERP", side: "Short", sizeUsd: 310000, entryPrice: 97800, markPrice: 98650, unrealizedPnlUsd: -2700 },
      { market: "ETH-PERP", side: "Short", sizeUsd: 220000, entryPrice: 3190, markPrice: 3205, unrealizedPnlUsd: -1030 },
    ],
    recentTrades: [
      { market: "BTC-PERP", side: "Neutral", sizeUsd: 305000, pnlUsd: 3240, pnlPct: 1.1, closedAt: "2026-08-18T00:00:00Z" },
      { market: "ETH-PERP", side: "Neutral", sizeUsd: 215000, pnlUsd: 2910, pnlPct: 1.4, closedAt: "2026-08-17T00:00:00Z" },
      { market: "BTC-PERP", side: "Neutral", sizeUsd: 298000, pnlUsd: 3580, pnlPct: 1.2, closedAt: "2026-08-16T00:00:00Z" },
      { market: "SOL-PERP", side: "Neutral", sizeUsd: 120000, pnlUsd: 2640, pnlPct: 2.2, closedAt: "2026-08-15T00:00:00Z" },
    ],
  },
  {
    slug: "eth-basis-capture",
    name: "ETH Basis Capture",
    performanceFeeBps: 1500,
    tvlUsd: 311900,
    allTimeReturnPct: 18.7,
    followers: 84,
    inceptionDate: "2026-02-11",
    tag: "Market Neutral",
    description:
      "Spot-perp basis trades on ETH, capturing the funding spread while staying hedged. Rebalanced daily against Nado's mark price.",
    strategist: {
      handle: "@basistrader",
      address: "0x2D8f1A9C4E7b3056d8A1c9E4B7D0912345678De",
      bio: "Delta-neutral by design. Long spot ETH, short the perp, harvest funding — no directional view, ever.",
      tradingSince: "2025-10-02",
      winRatePct: 89,
      totalTrades: 74,
    },
    openPositions: [
      { market: "ETH-PERP", side: "Short", sizeUsd: 155000, entryPrice: 3180, markPrice: 3205, unrealizedPnlUsd: -1220 },
      { market: "ETH-SPOT", side: "Long", sizeUsd: 156000, entryPrice: 3175, markPrice: 3205, unrealizedPnlUsd: 1480 },
    ],
    recentTrades: [
      { market: "ETH-PERP", side: "Neutral", sizeUsd: 154000, pnlUsd: 1890, pnlPct: 1.2, closedAt: "2026-08-18T00:00:00Z" },
      { market: "ETH-PERP", side: "Neutral", sizeUsd: 151000, pnlUsd: 2140, pnlPct: 1.4, closedAt: "2026-08-17T00:00:00Z" },
      { market: "ETH-PERP", side: "Neutral", sizeUsd: 149000, pnlUsd: 1020, pnlPct: 0.7, closedAt: "2026-08-16T00:00:00Z" },
      { market: "ETH-PERP", side: "Neutral", sizeUsd: 148000, pnlUsd: 1610, pnlPct: 1.1, closedAt: "2026-08-15T00:00:00Z" },
    ],
  },
  {
    slug: "funding-rate-arb",
    name: "Funding Rate Arb",
    performanceFeeBps: 1000,
    tvlUsd: 205400,
    allTimeReturnPct: 11.4,
    followers: 56,
    inceptionDate: "2026-02-24",
    tag: "Market Neutral",
    description:
      "Systematic funding-rate arbitrage across every Nado perp market, rotating capital toward whichever side pays. No directional exposure by design.",
    strategist: {
      handle: "@fundingflow",
      address: "0x6E3b7D1A9F42c8056B0a9D4C7E1F23456789FaB",
      bio: "Rotates capital toward whichever Nado market pays the richest funding. Fully systematic, zero discretion.",
      tradingSince: "2025-09-20",
      winRatePct: 94,
      totalTrades: 210,
    },
    openPositions: [
      { market: "SOL-PERP", side: "Short", sizeUsd: 88000, entryPrice: 190.1, markPrice: 191.4, unrealizedPnlUsd: -600 },
      { market: "BTC-PERP", side: "Short", sizeUsd: 62000, entryPrice: 97900, markPrice: 98650, unrealizedPnlUsd: -480 },
    ],
    recentTrades: [
      { market: "SOL-PERP", side: "Neutral", sizeUsd: 85000, pnlUsd: 610, pnlPct: 0.7, closedAt: "2026-08-18T00:00:00Z" },
      { market: "ETH-PERP", side: "Neutral", sizeUsd: 70000, pnlUsd: 540, pnlPct: 0.8, closedAt: "2026-08-17T00:00:00Z" },
      { market: "BTC-PERP", side: "Neutral", sizeUsd: 60000, pnlUsd: 720, pnlPct: 1.2, closedAt: "2026-08-16T00:00:00Z" },
      { market: "ARB-PERP", side: "Neutral", sizeUsd: 40000, pnlUsd: 390, pnlPct: 1.0, closedAt: "2026-08-15T00:00:00Z" },
    ],
  },
  {
    slug: "multi-asset-swing",
    name: "Multi-Asset Swing",
    performanceFeeBps: 2000,
    tvlUsd: 158000,
    allTimeReturnPct: -4.8,
    followers: 41,
    inceptionDate: "2026-04-09",
    tag: "Spot + Perps",
    description:
      "Swing positions across spot and perps on majors and select alts. Newest vault on Mimic — currently drawing down from a mistimed rotation in April.",
    strategist: {
      handle: "@swingset",
      address: "0xA1B2c3D4e5F60789A1B2c3D4E5F607891A2B3c4",
      bio: "Newest strategist on Mimic. Swing positions across majors and select alts — still finding size discipline.",
      tradingSince: "2026-03-15",
      winRatePct: 44,
      totalTrades: 38,
    },
    openPositions: [
      { market: "ARB-PERP", side: "Long", sizeUsd: 18000, entryPrice: 1.22, markPrice: 1.09, unrealizedPnlUsd: -1920 },
    ],
    recentTrades: [
      { market: "ARB-PERP", side: "Long", sizeUsd: 19800, pnlUsd: -2340, pnlPct: -11.8, closedAt: "2026-08-16T15:45:00Z" },
      { market: "SOL-SPOT", side: "Long", sizeUsd: 21000, pnlUsd: 610, pnlPct: 2.9, closedAt: "2026-08-13T10:20:00Z" },
      { market: "DOGE-PERP", side: "Long", sizeUsd: 13200, pnlUsd: -1880, pnlPct: -14.2, closedAt: "2026-08-08T19:00:00Z" },
      { market: "ETH-PERP", side: "Short", sizeUsd: 20500, pnlUsd: -740, pnlPct: -3.6, closedAt: "2026-08-02T08:30:00Z" },
    ],
  },
];

export function getAllVaults(): Vault[] {
  return VAULTS;
}

export function getVaultBySlug(slug: string): Vault | undefined {
  return VAULTS.find((vault) => vault.slug === slug);
}
