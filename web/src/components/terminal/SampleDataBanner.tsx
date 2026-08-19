import type { ReactNode } from "react";

export function SampleDataBanner({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
      {children}
    </span>
  );
}
