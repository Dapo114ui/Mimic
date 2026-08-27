"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { getFeeRates } from "./fees";

// Fee schedule changes rarely (only when the account's volume tier moves), so this is cached
// hard rather than polled like price data.
export function useFeeRates(address: Address | undefined) {
  return useQuery({
    queryKey: ["nado-fee-rates", address],
    queryFn: () => getFeeRates(address!),
    enabled: !!address,
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });
}
