import type { Address } from "viem";
import { nadoQuery } from "./client";
import { encodeSubaccount } from "./eip712";

type FeeRatesResponse = {
  taker_fee_rates_x18: string[];
  maker_fee_rates_x18: string[];
  withdraw_sequencer_fees: string[];
  liquidation_sequencer_fee: string;
  health_check_sequencer_fee: string;
  taker_sequencer_fee: string;
  fee_tier: number;
};

const fromX18 = (v: string) => Number(BigInt(v)) / 1e18;

// Nado publishes no NLP mint/burn fee through any query — the logic lives in Solidity outside
// the SDK — so these come from the indexer's own event ledger for a real account:
//   mint_nlp  quote 5.000019 -> 3.000019  (-2.00) for ~$1.00 of NLP  => $1.00 fee
//   burn_nlp  quote 3.000210 -> 2.003271  (-0.997), NLP 0.9387 -> 0  => $2.00 of equity
// Observed, not guaranteed. Single source so the vault page and the fee schedule can't drift.
export const MEASURED_MINT_FEE_USD = 1;
export const MEASURED_BURN_FEE_USD = 2;

export type FeeRates = {
  feeTier: number;
  /** Fraction, not percent: 0.0001 = 0.01%. Indexed by product id. */
  makerRateFor: (productId: number) => number;
  takerRateFor: (productId: number) => number;
  /** Flat, denominated in the withdrawn token's own units — not a rate. */
  withdrawFeeFor: (productId: number) => number;
  /** Flat USD amounts. */
  healthCheckFee: number;
  liquidationFee: number;
  takerSequencerFee: number;
};

// Real, account-specific fee schedule from the gateway. `fee_tier` matters because rates are
// tiered by volume, so a hardcoded "0.01%/0.035%" would silently be wrong for a discounted
// account — this reads the caller's actual rates instead.
//
// Note `withdraw_sequencer_fees` are FLAT token amounts, not rates (product 0 = 1.0 quote =
// $1.00; product 3 = 0.0003 WETH), so they must not be rendered as percentages.
//
// `health_check_sequencer_fee` is exactly $1.00, which matches the $1.00 mint fee measured from
// the real event ledger to the cent. That's a suggestive match, not a proven mechanism — the fee
// logic lives in Solidity outside the SDK — so nothing here claims one causes the other.
type SymbolsFeeResponse = {
  symbols: Record<string, { product_id: number; maker_fee_rate_x18: string; taker_fee_rate_x18: string }>;
};

export type BaseFeeRate = { maker: number; taker: number };

// Standard (untiered) rates, from `symbols` — unlike `fee_rates` this needs no wallet, so market
// pages can show fees to a visitor who hasn't connected. Verified to agree with `fee_rates` for a
// real tier-0 account (0.010% / 0.035% on both BTC and ETH perps); a discounted account's own
// rates can be lower, which is why the order form uses `getFeeRates` instead once connected.
export async function getBaseFeeRates(): Promise<Map<number, BaseFeeRate>> {
  const { symbols } = await nadoQuery<SymbolsFeeResponse>("symbols");
  return new Map(
    Object.values(symbols).map((s) => [
      s.product_id,
      { maker: fromX18(s.maker_fee_rate_x18), taker: fromX18(s.taker_fee_rate_x18) },
    ])
  );
}

export async function getFeeRates(owner: Address): Promise<FeeRates> {
  const sender = encodeSubaccount(owner);
  const d = await nadoQuery<FeeRatesResponse>("fee_rates", { sender });
  const at = (arr: string[], productId: number) =>
    productId < arr.length ? fromX18(arr[productId]) : 0;

  return {
    feeTier: d.fee_tier,
    makerRateFor: (productId) => at(d.maker_fee_rates_x18, productId),
    takerRateFor: (productId) => at(d.taker_fee_rates_x18, productId),
    withdrawFeeFor: (productId) => at(d.withdraw_sequencer_fees, productId),
    healthCheckFee: fromX18(d.health_check_sequencer_fee),
    liquidationFee: fromX18(d.liquidation_sequencer_fee),
    takerSequencerFee: fromX18(d.taker_sequencer_fee),
  };
}
