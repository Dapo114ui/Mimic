"use client";

import { useEffect } from "react";
import { useTriggerOrders } from "@/lib/nado/useTriggerOrders";
import { SideBadge } from "@/components/terminal/SideBadge";
import { formatDateTime } from "@/lib/format";

// Unlike OpenOrdersTable, this doesn't auto-refresh — every list_trigger_orders call needs its
// own freshly-signed ListTriggerOrders transaction (see useTriggerOrders), so silent background
// polling would mean a wallet popup every few seconds. It loads once on mount (one signature)
// and otherwise waits for the user to hit Refresh.
export function PendingTriggerOrders() {
  const { orders, isLoading, error, load, cancel, cancelingDigest } = useTriggerOrders();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCancel(productId: number, digest: string) {
    await cancel(productId, digest);
  }

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-mist-dim">
          Pending TP/SL orders — sign once to load; refresh needs a new signature each time.
        </p>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-mist transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {orders === null && isLoading && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
          Loading…
        </p>
      )}

      {error && <p className="mb-2 text-center text-sm text-rose-400">{error}</p>}

      {orders !== null && orders.length === 0 && !isLoading && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
          No pending TP/SL orders
        </p>
      )}

      {orders !== null && orders.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-mist-dim">
                <th className="px-5 py-3 font-medium">Market</th>
                <th className="px-5 py-3 font-medium">Closes</th>
                <th className="px-5 py-3 text-right font-medium">Size</th>
                <th className="px-5 py-3 font-medium">Trigger</th>
                <th className="px-5 py-3 font-medium">Status</th>
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
                  <td className="px-5 py-3 text-right align-middle font-mono text-mist">
                    {order.size.toFixed(4)}
                  </td>
                  <td className="px-5 py-3 align-middle font-mono text-xs text-mist">{order.triggerLabel}</td>
                  <td className="px-5 py-3 align-middle text-xs text-mist-dim">{order.status}</td>
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
      )}
    </div>
  );
}
