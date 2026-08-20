"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { deriveAccountSummary, derivePositions, getSubaccountInfo, getSymbolMap } from "./account";
import { getAccountTradeHistory } from "./indexer";
import { encodeSubaccount } from "./eip712";

// Real per-wallet portfolio: gateway subaccount state (equity/margin/positions) plus indexer
// fill history, both real-money data for the connected address — not enabled until a wallet is
// actually connected. Symbol names are shared/global (one fetch, long staleTime) rather than
// re-fetched per account.
export function usePortfolio(address: Address | undefined) {
  const symbolsQuery = useQuery({
    queryKey: ["nado-symbols"],
    queryFn: getSymbolMap,
    staleTime: 10 * 60_000,
    refetchInterval: false,
  });

  const infoQuery = useQuery({
    queryKey: ["nado-subaccount-info", address],
    queryFn: () => getSubaccountInfo(address!),
    enabled: !!address,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const symbolMap = symbolsQuery.data;

  const tradesQuery = useQuery({
    queryKey: ["nado-account-trades", address],
    queryFn: () => getAccountTradeHistory(encodeSubaccount(address!), symbolMap!),
    enabled: !!address && !!symbolMap,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const isLoading = infoQuery.isLoading || symbolsQuery.isLoading;
  const isError = infoQuery.isError || symbolsQuery.isError;

  if (isLoading || isError || !infoQuery.data || !symbolMap) {
    return { isLoading, isError, data: null };
  }

  const positions = derivePositions(infoQuery.data, symbolMap);
  const summary = deriveAccountSummary(infoQuery.data, positions);

  return {
    isLoading: false,
    isError: false,
    data: {
      exists: infoQuery.data.exists,
      summary,
      positions,
      tradeHistory: tradesQuery.data ?? [],
      tradeHistoryLoading: tradesQuery.isLoading,
    },
  };
}
