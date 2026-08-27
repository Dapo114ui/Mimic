"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { getAllOpenOrders } from "./account";
import { useLiveMarkets } from "./useLiveMarkets";

// Open orders across every Nado market, not just the two that used to be hardcoded — one
// gateway call covering all product ids, keyed off the live market list so a market Nado adds
// later is included without a code change.
export function useOpenOrders(address: Address | undefined) {
  const queryClient = useQueryClient();
  const { data: markets } = useLiveMarkets();

  const productIds = markets?.map((m) => m.productId) ?? [];
  const symbolMap = new Map((markets ?? []).map((m) => [m.productId, m.symbol]));

  const query = useQuery({
    queryKey: ["nado-open-orders", address, productIds.length],
    queryFn: () => getAllOpenOrders(address!, productIds, symbolMap),
    enabled: !!address && productIds.length > 0,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["nado-open-orders", address] });

  return {
    orders: query.data ?? [],
    isLoading: query.isLoading || !markets,
    isError: query.isError,
    refetch,
  };
}
