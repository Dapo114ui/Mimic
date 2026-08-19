// Sample vault data. No MimicVaultFactory is deployed on any chain yet, so there is nothing
// real to read — this stands in for what a `useReadContracts` call against the factory's
// `allVaults`/registry would return once one exists. Swap this module out, not its shape.

export type StrategyTag = "Perps" | "Spot + Perps" | "Market Neutral" | "Momentum";

export type Vault = {
  slug: string;
  name: string;
  strategistAddress: string;
  performanceFeeBps: number;
  tvlUsd: number;
  allTimeReturnPct: number;
  followers: number;
  inceptionDate: string;
  tag: StrategyTag;
  description: string;
};

const VAULTS: Vault[] = [
  {
    slug: "altcoin-momentum",
    name: "Altcoin Momentum",
    strategistAddress: "0x4f2A9E7c1B3d5F608A1c2E4B7D9F0123456789Ab",
    performanceFeeBps: 2500,
    tvlUsd: 96700,
    allTimeReturnPct: 52.9,
    followers: 203,
    inceptionDate: "2026-03-02",
    tag: "Perps",
    description:
      "High-conviction directional bets on mid-cap alt perps, sized aggressively once momentum confirms. Highest fee tier on Mimic, reflecting the highest realized variance.",
  },
  {
    slug: "btc-momentum",
    name: "BTC Momentum",
    strategistAddress: "0x71C4a8F2D905e3B1C7A6890Fedcba0987654321",
    performanceFeeBps: 2000,
    tvlUsd: 482300,
    allTimeReturnPct: 34.2,
    followers: 128,
    inceptionDate: "2026-01-18",
    tag: "Perps",
    description:
      "Trend-following BTC perp positions on Nado, scaling leverage with realized volatility. No discretionary alt exposure — single-market focus.",
  },
  {
    slug: "conservative-carry",
    name: "Conservative Carry",
    strategistAddress: "0x9Ab6C3D8E1F4257b9a0c8D6E4F1234567890AbC",
    performanceFeeBps: 1000,
    tvlUsd: 640200,
    allTimeReturnPct: 9.1,
    followers: 312,
    inceptionDate: "2025-12-05",
    tag: "Market Neutral",
    description:
      "Delta-neutral funding-rate carry across Nado's major perp markets. Lower variance, lower fee — built for capital that wants yield, not direction.",
  },
  {
    slug: "eth-basis-capture",
    name: "ETH Basis Capture",
    strategistAddress: "0x2D8f1A9C4E7b3056d8A1c9E4B7D0912345678De",
    performanceFeeBps: 1500,
    tvlUsd: 311900,
    allTimeReturnPct: 18.7,
    followers: 84,
    inceptionDate: "2026-02-11",
    tag: "Market Neutral",
    description:
      "Spot-perp basis trades on ETH, capturing the funding spread while staying hedged. Rebalanced daily against Nado's mark price.",
  },
  {
    slug: "funding-rate-arb",
    name: "Funding Rate Arb",
    strategistAddress: "0x6E3b7D1A9F42c8056B0a9D4C7E1F23456789FaB",
    performanceFeeBps: 1000,
    tvlUsd: 205400,
    allTimeReturnPct: 11.4,
    followers: 56,
    inceptionDate: "2026-02-24",
    tag: "Market Neutral",
    description:
      "Systematic funding-rate arbitrage across every Nado perp market, rotating capital toward whichever side pays. No directional exposure by design.",
  },
  {
    slug: "multi-asset-swing",
    name: "Multi-Asset Swing",
    strategistAddress: "0xA1B2c3D4e5F60789A1B2c3D4E5F607891A2B3c4",
    performanceFeeBps: 2000,
    tvlUsd: 158000,
    allTimeReturnPct: -4.8,
    followers: 41,
    inceptionDate: "2026-04-09",
    tag: "Spot + Perps",
    description:
      "Swing positions across spot and perps on majors and select alts. Newest vault on Mimic — currently drawing down from a mistimed rotation in April.",
  },
];

export function getAllVaults(): Vault[] {
  return VAULTS;
}

export function getVaultBySlug(slug: string): Vault | undefined {
  return VAULTS.find((vault) => vault.slug === slug);
}
