// Sample market data. This dashboard has no live connection to Nado's API/websocket feed in
// this environment, so prices, candles, and the recent-fills tape are deterministically
// generated rather than fabricated per-render — the same market always looks the same on every
// load, and (critically) renders identically on the server and after hydration. Swap
// `getAllMarkets`/`getCandles`/`getRecentFills` for real Nado API calls without touching the UI.

export type Market = {
  symbol: string;
  name: string;
  price: number;
  change24hPct: number;
  volume24hUsd: number;
  fundingRatePct: number; // per 8h funding interval; positive = longs pay shorts
  openInterestUsd: number;
};

// `time` is a UTC date string ("YYYY-MM-DD") for this file's daily sample candles, or a unix
// second timestamp for live hourly candles (see `lib/nado/indexer.ts`) — lightweight-charts
// accepts both, just not mixed within one series.
export type Candle = { time: string | number; open: number; high: number; low: number; close: number };

export type Fill = { side: "Long" | "Short"; price: number; sizeUsd: number; timestamp: string };

const MARKETS: Market[] = [
  { symbol: "BTC-PERP", name: "Bitcoin Perpetual", price: 98650, change24hPct: 2.4, volume24hUsd: 184_200_000, fundingRatePct: 0.0082, openInterestUsd: 412_600_000 },
  { symbol: "ETH-PERP", name: "Ethereum Perpetual", price: 3205, change24hPct: 1.1, volume24hUsd: 96_700_000, fundingRatePct: 0.0041, openInterestUsd: 208_300_000 },
  { symbol: "SOL-PERP", name: "Solana Perpetual", price: 191.4, change24hPct: 6.8, volume24hUsd: 58_400_000, fundingRatePct: 0.0165, openInterestUsd: 94_100_000 },
  { symbol: "ARB-PERP", name: "Arbitrum Perpetual", price: 1.09, change24hPct: -3.2, volume24hUsd: 12_600_000, fundingRatePct: -0.0052, openInterestUsd: 18_900_000 },
  { symbol: "OP-PERP", name: "Optimism Perpetual", price: 1.85, change24hPct: 0.6, volume24hUsd: 9_800_000, fundingRatePct: 0.0019, openInterestUsd: 14_200_000 },
  { symbol: "DOGE-PERP", name: "Dogecoin Perpetual", price: 0.412, change24hPct: -1.8, volume24hUsd: 21_300_000, fundingRatePct: -0.0028, openInterestUsd: 27_600_000 },
];

const TODAY = "2026-08-19";

// Deterministic PRNG (mulberry32) seeded from a string — pure arithmetic, no Date.now() or
// Math.random(), so the exact same sequence comes out on the server and in the browser.
function seededRandom(seedStr: string) {
  let seed = 0;
  for (const ch of seedStr) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  return function next() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getAllMarkets(): Market[] {
  return MARKETS;
}

export function getMarketBySymbol(symbol: string): Market | undefined {
  return MARKETS.find((market) => market.symbol === symbol);
}

export function getCandles(market: Market, days = 60): Candle[] {
  const rand = seededRandom(`${market.symbol}:candles`);
  const end = new Date(`${TODAY}T00:00:00Z`);
  const candles: Candle[] = [];
  let price = market.price * 0.72;

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - i);
    const drift = (rand() - 0.47) * 0.05;
    const open = price;
    price = Math.max(price * (1 + drift), market.price * 0.3);
    const close = price;
    const high = Math.max(open, close) * (1 + rand() * 0.015);
    const low = Math.min(open, close) * (1 - rand() * 0.015);
    candles.push({ time: date.toISOString().slice(0, 10), open, high, low, close });
  }

  candles[candles.length - 1].close = market.price;
  return candles;
}

export function getRecentFills(market: Market, count = 8): Fill[] {
  const rand = seededRandom(`${market.symbol}:fills`);
  const anchor = new Date(`${TODAY}T12:00:00Z`).getTime();
  const fills: Fill[] = [];
  let minutesAgo = 0;

  for (let i = 0; i < count; i++) {
    if (i > 0) minutesAgo += 4 + rand() * 12;
    const wobble = (rand() - 0.5) * market.price * 0.004;
    fills.push({
      side: rand() > 0.5 ? "Long" : "Short",
      price: market.price + wobble,
      sizeUsd: 1200 + rand() * 48000,
      timestamp: new Date(anchor - minutesAgo * 60_000).toISOString(),
    });
  }

  return fills;
}
