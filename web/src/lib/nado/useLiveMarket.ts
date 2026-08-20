"use client";

import { useQuery } from "@tanstack/react-query";
import { nadoQuery } from "./client";
import { getFundingRatePct, getMarket24hStats } from "./indexer";

type AllProductsResponse = {
  spot_products: unknown[];
  perp_products: {
    product_id: number;
    oracle_price_x18: string;
    state: { open_interest: string };
  }[];
};

// Live price + open interest (gateway) combined with funding rate and 24h volume/change
// (archive/indexer service — the gateway only exposes point-in-time snapshots, not history).
// One query key per data source, fetched in parallel and merged in `select` so a slow/failed
// indexer call doesn't block the gateway data the rest of the page already depended on.
export function useLiveMarket(productId: number) {
  const gatewayQuery = useQuery({
    queryKey: ["nado-all-products"],
    queryFn: () => nadoQuery<AllProductsResponse>("all_products"),
    staleTime: 10_000,
    refetchInterval: 15_000,
    select: (data) => {
      const product = data.perp_products.find((p) => p.product_id === productId);
      if (!product) return null;
      const price = Number(BigInt(product.oracle_price_x18)) / 1e18;
      const openInterestBase = Number(BigInt(product.state.open_interest)) / 1e18;
      return { price, openInterestUsd: openInterestBase * price };
    },
  });

  const fundingQuery = useQuery({
    queryKey: ["nado-funding-rate", productId],
    queryFn: () => getFundingRatePct(productId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const statsQuery = useQuery({
    queryKey: ["nado-24h-stats", productId],
    queryFn: () => getMarket24hStats(productId),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const isLoading = gatewayQuery.isLoading;
  const isError = gatewayQuery.isError || !gatewayQuery.data;

  return {
    isLoading,
    isError,
    data: isError
      ? null
      : {
          price: gatewayQuery.data?.price ?? 0,
          openInterestUsd: gatewayQuery.data?.openInterestUsd ?? 0,
          fundingRatePct: fundingQuery.data ?? null,
          volume24hUsd: statsQuery.data?.volume24hUsd ?? null,
          change24hPct: statsQuery.data?.change24hPct ?? null,
        },
  };
}
