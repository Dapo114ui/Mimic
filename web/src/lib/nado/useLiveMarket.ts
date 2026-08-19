"use client";

import { useQuery } from "@tanstack/react-query";
import { nadoQuery } from "./client";

type AllProductsResponse = {
  spot_products: unknown[];
  perp_products: {
    product_id: number;
    oracle_price_x18: string;
    state: { open_interest: string };
  }[];
};

// Live oracle price + open interest for a single product, polled from Nado's testnet gateway.
// Everything else this dashboard shows (24h change, volume, funding rate) would need Nado's
// separate indexer/historical service — `all_products` only exposes a point-in-time snapshot,
// so those stats stay as sample data rather than being half-faked here.
export function useLiveMarket(productId: number) {
  return useQuery({
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
}
