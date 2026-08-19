export function truncateAddress(address: string, chars = 4) {
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

// Deterministic by construction (plain arithmetic + toFixed, no Intl compact-notation
// involved) so it renders identically during SSR and on the client — `Intl.NumberFormat`'s
// `notation: "compact"` trims trailing zeros inconsistently across ICU versions (Node vs.
// browser), which caused a hydration mismatch here (e.g. "$158K" vs "$158.0K").
export function formatUsd(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");

  if (abs >= 1_000_000) return `${sign}$${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}$${trim(abs / 1_000)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatSignedPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Absolute, not relative ("3h ago") — relative time depends on render-time `Date.now()`,
// which differs between SSR and hydration and would reintroduce the same class of mismatch
// `formatUsd` above had to be fixed for.
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

// More decimal places for sub-$1 assets (DOGE, etc.) than for BTC-sized prices — plain
// `toLocaleString` with fixed fraction digits, not compact notation, so it's not exposed to
// the ICU trailing-zero divergence `formatUsd` above had to work around.
export function formatPrice(value: number) {
  const decimals = value >= 100 ? 2 : value >= 1 ? 4 : 6;
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatFundingRate(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(4)}%`;
}
