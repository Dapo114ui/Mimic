import type { Side } from "@/lib/vaults";

const STYLES: Record<Side, string> = {
  Long: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
  Short: "border-rose-400/30 bg-rose-400/10 text-rose-400",
  Neutral: "border-white/15 bg-white/5 text-mist",
};

export function SideBadge({ side }: { side: Side }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[side]}`}>
      {side}
    </span>
  );
}
