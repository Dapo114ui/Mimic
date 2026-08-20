"use client";

import { useQuery } from "@tanstack/react-query";
import { getLiveCandles, getRecentTrades } from "./indexer";

// Refetch cadence scales with the bucket size — no point polling a 1-week candle every 15s, and
// a 1-minute candle is stale almost immediately. Floors/caps keep both ends sane.
export function useLiveCandles(productId: number, granularitySec: number) {
  const refetchInterval = Math.min(300_000, Math.max(15_000, (granularitySec * 1000) / 4));
  return useQuery({
    queryKey: ["nado-candlesticks", productId, granularitySec],
    queryFn: () => getLiveCandles(productId, granularitySec),
    staleTime: refetchInterval / 2,
    refetchInterval,
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
