"use client";

import { useQuery } from "@tanstack/react-query";
import { getLiveMarkets } from "./markets";

export function useLiveMarkets() {
  return useQuery({
    queryKey: ["nado-live-markets"],
    queryFn: getLiveMarkets,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
