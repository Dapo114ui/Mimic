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

const AVATAR_PALETTE = [
  "bg-accent/15 text-accent",
  "bg-violet-400/15 text-violet-300",
  "bg-amber-400/15 text-amber-300",
  "bg-sky-400/15 text-sky-300",
  "bg-rose-400/15 text-rose-300",
  "bg-emerald-400/15 text-emerald-300",
];

// Deterministic (pure function of the string, no randomness) so the same handle always gets
// the same color on both server and client.
export function avatarPalette(seed: string) {
  const sum = [...seed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}
