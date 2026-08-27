export function BetaTradingWarning({ context = "order" }: { context?: "order" | "vault" }) {
  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm">
      <p className="font-medium text-rose-300">Mainnet · Beta — real funds</p>
      <p className="mt-1 text-rose-200/70">
        This signs and submits real transactions to Nado&apos;s Ink mainnet gateway with your
        connected wallet.{" "}
        {context === "order" ? (
          <>
            The full order lifecycle is confirmed working on mainnet — a real order was placed,
            rested on Nado&apos;s live book, and was cancelled again, all through this app.
            Getting there took four real fixes, one of them a live protocol change on Nado&apos;s
            side, so treat this integration as something that can drift as Nado evolves rather
            than as settled. Orders must be worth at least $100, and your size is capped by
            available margin.
          </>
        ) : (
          <>
            Mint and burn are both confirmed working end to end against a real funded account.
            Note the economics before using this at small size: a real $1 mint plus burn round
            trip cost <span className="font-medium">$3.00 in fees</span> ($1 minting, $2 burning),
            turning a $5 balance into $2. These are Nado&apos;s fees, not Mimic&apos;s, and they
            are flat rather than proportional — negligible on a large position, ruinous on a
            small one.
          </>
        )}{" "}
        Start with a small size and double-check what you&apos;re signing before confirming.
      </p>
    </div>
  );
}
