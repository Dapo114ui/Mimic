"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrderBook } from "./orderbook";

export function useOrderBook(productId: number, depth = 15) {
  return useQuery({
    queryKey: ["nado-order-book", productId, depth],
    queryFn: () => getOrderBook(productId, depth),
    staleTime: 2_000,
    refetchInterval: 3_000,
  });
}
