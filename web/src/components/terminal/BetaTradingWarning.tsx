export function BetaTradingWarning({ context = "order" }: { context?: "order" | "vault" }) {
  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm">
      <p className="font-medium text-rose-300">Mainnet · Beta — real funds</p>
      <p className="mt-1 text-rose-200/70">
        This signs and submits real transactions to Nado&apos;s Ink mainnet gateway with your
        connected wallet.{" "}
        {context === "order" ? (
          <>
            Signing and submission are confirmed working — a real signed order has round-tripped
            to the gateway and gotten back a real response. That earlier test hit a subaccount-
            encoding bug (since fixed) that targeted the wrong, unfunded subaccount rather than
            your real one, so it&apos;s not yet re-confirmed against an actually funded account.
          </>
        ) : (
          <>
            A real mint attempt against this exact code hit a wire-format bug (the request body
            needed a nested <code>tx</code> field this code wasn&apos;t sending, so the gateway
            rejected it before ever checking the signature) — since fixed, but that means mint/
            burn hasn&apos;t completed a full round trip yet at all, not even against the wrong
            subaccount like orders had.
          </>
        )}{" "}
        Start with a small size and double-check what you&apos;re signing before confirming.
      </p>
    </div>
  );
}
