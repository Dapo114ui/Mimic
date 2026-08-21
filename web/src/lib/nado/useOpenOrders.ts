"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { getSubaccountOrders } from "./account";
import { KNOWN_PRODUCTS } from "./config";

// subaccount_orders is per-product, and order placement here only supports the known products
// (BTC-PERP/ETH-PERP) — so "your open orders" is scoped to exactly what this app can place
// orders in, the same boundary OrderForm already draws, queried in parallel and merged.
export function useOpenOrders(address: Address | undefined) {
  const queryClient = useQueryClient();
  const entries = Object.entries(KNOWN_PRODUCTS);

  const query = useQuery({
    queryKey: ["nado-open-orders", address],
    queryFn: async () => {
      const perMarket = await Promise.all(
        entries.map(([market, productId]) => getSubaccountOrders(address!, productId, market))
      );
      return perMarket.flat().sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1));
    },
    enabled: !!address,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["nado-open-orders", address] });

  return { orders: query.data ?? [], isLoading: query.isLoading, isError: query.isError, refetch };
}
