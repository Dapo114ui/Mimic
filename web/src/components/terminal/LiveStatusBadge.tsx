"use client";

import { useEffect, useState } from "react";
import { useLiveMarkets } from "@/lib/nado/useLiveMarkets";

// A real "updated Xs ago", not a decorative placeholder — derived from react-query's own
// dataUpdatedAt for the live markets fetch (already running for the table below; this reuses
// the same cached query rather than firing a second one) and a local 1s tick purely to
// re-render the elapsed-time text, no extra network involved.
export function LiveStatusBadge() {
  const { dataUpdatedAt } = useLiveMarkets();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const secondsAgo = dataUpdatedAt ? Math.max(0, Math.round((now - dataUpdatedAt) / 1000)) : null;
  const label = secondsAgo === null ? "connecting…" : secondsAgo < 2 ? "updated just now" : `updated ${secondsAgo}s ago`;

  return (
    <div className="hidden text-right sm:block">
      <p className="flex items-center justify-end gap-1.5 text-xs font-medium uppercase tracking-wider text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Nado mainnet
      </p>
      <p className="mt-1 text-xs uppercase tracking-wider text-mist-dim">{label}</p>
    </div>
  );
}
