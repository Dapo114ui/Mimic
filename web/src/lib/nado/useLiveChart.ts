"use client";

import { useQuery } from "@tanstack/react-query";
import { getLiveCandles, getRecentTrades } from "./indexer";

// Hourly candles, refetched roughly as often as a new bucket could plausibly close.
export function useLiveCandles(productId: number) {
  return useQuery({
    queryKey: ["nado-candlesticks", productId],
    queryFn: () => getLiveCandles(productId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useLiveTrades(productId: number) {
  return useQuery({
    queryKey: ["nado-recent-trades", productId],
    queryFn: () => getRecentTrades(productId),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}
