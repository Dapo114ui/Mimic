const STYLES = {
  Long: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
  Short: "border-rose-400/30 bg-rose-400/10 text-rose-400",
};

export function SideBadge({ side }: { side: "Long" | "Short" }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[side]}`}>
      {side}
    </span>
  );
}
