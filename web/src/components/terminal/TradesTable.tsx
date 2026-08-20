import type { Fill } from "@/lib/markets";
import { formatDateTime, formatPrice, formatUsd } from "@/lib/format";
import { SideBadge } from "@/components/terminal/SideBadge";

export function TradesTable({ fills }: { fills: Fill[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[480px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-mist-dim">
            <th className="px-5 py-3 font-medium">Side</th>
            <th className="px-5 py-3 text-right font-medium">Price</th>
            <th className="px-5 py-3 text-right font-medium">Size</th>
            <th className="px-5 py-3 text-right font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {fills.map((fill, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0">
              <td className="px-5 py-3 align-middle">
                <SideBadge side={fill.side} />
              </td>
              <td className="px-5 py-3 text-right align-middle font-mono text-mist">${formatPrice(fill.price)}</td>
              <td className="px-5 py-3 text-right align-middle font-mono text-mist">{formatUsd(fill.sizeUsd)}</td>
              <td className="px-5 py-3 text-right align-middle text-xs text-mist-dim">
                {formatDateTime(fill.timestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
