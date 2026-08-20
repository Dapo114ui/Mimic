"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { deriveNlpBalance, getNlpStats, getSubaccountInfo } from "./account";

// NLP price/supply/TVL is protocol-wide — available with no wallet connected. Your own NLP
// balance needs one, and shares its query key/cache with the portfolio page's subaccount lookup.
export function useNlpVault(address: Address | undefined) {
  const statsQuery = useQuery({
    queryKey: ["nado-nlp-stats"],
    queryFn: getNlpStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const infoQuery = useQuery({
    queryKey: ["nado-subaccount-info", address],
    queryFn: () => getSubaccountInfo(address!),
    enabled: !!address,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  return {
    stats: statsQuery.data ?? null,
    isStatsLoading: statsQuery.isLoading,
    isStatsError: statsQuery.isError,
    yourBalance: infoQuery.data ? deriveNlpBalance(infoQuery.data) : null,
    isBalanceLoading: infoQuery.isLoading,
    isBalanceError: infoQuery.isError,
  };
}
