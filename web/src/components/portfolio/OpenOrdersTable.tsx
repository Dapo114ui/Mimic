"use client";

import { useAccount } from "wagmi";
import { useOpenOrders } from "@/lib/nado/useOpenOrders";
import { useCancelOrder } from "@/lib/nado/useCancelOrder";
import { SideBadge } from "@/components/terminal/SideBadge";
import { formatDateTime, formatPrice, formatUsd } from "@/lib/format";

export function OpenOrdersTable() {
  const { address } = useAccount();
  const { orders, isLoading, isError, refetch } = useOpenOrders(address);
  const { cancel, cancelingDigest, error } = useCancelOrder();

  async function handleCancel(productId: number, digest: string) {
    try {
      await cancel(productId, digest);
      refetch();
    } catch {
      // error state already captured by useCancelOrder; nothing else to do here
    }
  }

  if (isLoading) {
    return (
      <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
        Loading…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
        Couldn&apos;t load open orders
      </p>
    );
  }

  if (orders.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
        No open orders
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-mist-dim">
              <th className="px-5 py-3 font-medium">Market</th>
              <th className="px-5 py-3 font-medium">Side</th>
              <th className="px-5 py-3 text-right font-medium">Price</th>
              <th className="px-5 py-3 text-right font-medium">Size</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 text-right font-medium">Placed</th>
              <th className="px-5 py-3 text-right font-medium">
                <span className="sr-only">Cancel</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.digest} className="border-b border-white/5 last:border-0">
                <td className="px-5 py-3 align-middle font-medium text-foreground">{order.market}</td>
                <td className="px-5 py-3 align-middle">
                  <SideBadge side={order.side} />
                </td>
                <td className="px-5 py-3 text-right align-middle font-mono text-mist">${formatPrice(order.price)}</td>
                <td className="px-5 py-3 text-right align-middle font-mono text-mist">
                  {formatUsd(order.size * order.price)}
                </td>
                <td className="px-5 py-3 align-middle text-xs text-mist-dim">{order.orderType}</td>
                <td className="px-5 py-3 text-right align-middle text-xs text-mist-dim">
                  {formatDateTime(order.placedAt)}
                </td>
                <td className="px-5 py-3 text-right align-middle">
                  <button
                    type="button"
                    onClick={() => handleCancel(order.productId, order.digest)}
                    disabled={cancelingDigest === order.digest}
                    className="rounded-full border border-rose-400/30 px-3 py-1 text-xs font-medium text-rose-400 transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cancelingDigest === order.digest ? "Canceling…" : "Cancel"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="mt-2 text-center text-sm text-rose-400">{error}</p>}
    </div>
  );
}
