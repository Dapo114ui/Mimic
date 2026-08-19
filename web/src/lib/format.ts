export function truncateAddress(address: string, chars = 4) {
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

// Deterministic by construction (plain arithmetic + toFixed, no Intl compact-notation
// involved) so it renders identically during SSR and on the client — `Intl.NumberFormat`'s
// `notation: "compact"` trims trailing zeros inconsistently across ICU versions (Node vs.
// browser), which caused a hydration mismatch here (e.g. "$158K" vs "$158.0K").
export function formatUsd(value: number) {
  const abs = Math.abs(value);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");

  if (abs >= 1_000_000) return `$${trim(value / 1_000_000)}M`;
  if (abs >= 1_000) return `$${trim(value / 1_000)}K`;
  return `$${value.toFixed(0)}`;
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
