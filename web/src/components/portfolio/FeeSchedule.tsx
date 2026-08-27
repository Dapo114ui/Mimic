"use client";

import { useAccount } from "wagmi";
import { useFeeRates } from "@/lib/nado/useFeeRates";
import { KNOWN_PRODUCTS, NADO_QUOTE_TOKEN } from "@/lib/nado/config";
import { formatUsd } from "@/lib/format";

// Measured from the indexer's own event ledger for a real account, because Nado exposes neither
// figure through any query: a $1 mint deducted exactly $2.00 of quote for ~$1.00 of NLP, and
// burning that NLP back cost exactly $2.00 of equity. Flat, not proportional.
const MEASURED_MINT_FEE_USD = 1;
const MEASURED_BURN_FEE_USD = 2;

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2 last:border-0">
      <div>
        <p className="text-sm text-mist">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-mist-dim">{hint}</p>}
      </div>
      <p className="shrink-0 font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

export function FeeSchedule() {
  const { address, isConnected } = useAccount();
  const { data: fees, isLoading, isError } = useFeeRates(address);

  if (!isConnected) {
    return (
      <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
        Connect a wallet to see your real fee rates — they vary by volume tier.
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
        Loading…
      </p>
    );
  }

  if (isError || !fees) {
    return (
      <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-mist-dim">
        Couldn&apos;t load your fee rates
      </p>
    );
  }

  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
  const quoteWithdrawFee = fees.withdrawFeeFor(0);

  return (
    <div className="mt-3 space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-xs uppercase tracking-wider text-mist-dim">
          Trading · your rates, fee tier {fees.feeTier}
        </p>
        <div className="mt-2">
          {Object.entries(KNOWN_PRODUCTS).map(([market, productId]) => (
            <Row
              key={market}
              label={market}
              hint="maker = your order rests on the book · taker = it fills immediately"
              value={`${pct(fees.makerRateFor(productId))} / ${pct(fees.takerRateFor(productId))}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-mist-dim">
          Proportional to order value, so a $1,000 order at the taker rate costs{" "}
          {formatUsd(1000 * fees.takerRateFor(KNOWN_PRODUCTS["BTC-PERP"]))}.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-xs uppercase tracking-wider text-mist-dim">Flat fees</p>
        <div className="mt-2">
          <Row
            label="NLP mint"
            hint="Measured from a real mint — not exposed by any query"
            value={formatUsd(MEASURED_MINT_FEE_USD)}
          />
          <Row
            label="NLP burn"
            hint="Measured from a real burn — destroys the NLP and takes ~$1 more from quote"
            value={formatUsd(MEASURED_BURN_FEE_USD)}
          />
          <Row
            label="Withdraw"
            hint={`Per withdrawal of the quote token (${NADO_QUOTE_TOKEN.slice(0, 6)}…${NADO_QUOTE_TOKEN.slice(-4)})`}
            value={formatUsd(quoteWithdrawFee)}
          />
          <Row label="Health check" value={formatUsd(fees.healthCheckFee)} />
          <Row
            label="Liquidation"
            hint="Charged if a position is liquidated"
            value={formatUsd(fees.liquidationFee)}
          />
        </div>
        <p className="mt-3 text-xs text-amber-300/80">
          These are flat, not proportional — immaterial on a large position, ruinous on a small
          one. A real $1 NLP mint-then-burn round trip cost $3.00 in fees, taking a $5.00 balance
          to $2.00.
        </p>
      </div>

      <p className="text-xs text-mist-dim">
        Trading, withdraw, health-check and liquidation figures are read live from Nado&apos;s{" "}
        <code>fee_rates</code> query for your account. The NLP mint/burn figures aren&apos;t
        available from any query and were measured from real transactions — treat them as
        observed, not guaranteed.
      </p>
    </div>
  );
}
