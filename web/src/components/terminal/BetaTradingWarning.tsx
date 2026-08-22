export function BetaTradingWarning({ context = "order" }: { context?: "order" | "vault" }) {
  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm">
      <p className="font-medium text-rose-300">Mainnet · Beta — real funds</p>
      <p className="mt-1 text-rose-200/70">
        This signs and submits real transactions to Nado&apos;s Ink mainnet gateway with your
        connected wallet.{" "}
        {context === "order" ? (
          <>
            Signing and submission are confirmed working — a real signed order against a real
            funded account has round-tripped to the gateway. A live protocol change surfaced
            along the way (Nado bumped its required order-version field; a real order was
            rejected with the exact mismatch, since fixed) — worth knowing this integration
            depends on values that can drift as Nado itself evolves, not just on Mimic&apos;s own
            code being correct once.
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
