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
            Mint is confirmed working end to end — a real mint against a funded account went
            through and the gateway accepted it, after two real bugs surfaced and got fixed along
            the way (a missing <code>tx</code> wrapper, then a wrong nonce scheme). Burn uses the
            identical signing/submission path and should work the same way, but hasn&apos;t been
            separately tested yet.
          </>
        )}{" "}
        Start with a small size and double-check what you&apos;re signing before confirming.
      </p>
    </div>
  );
}
