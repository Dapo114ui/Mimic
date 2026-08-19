export function BetaTradingWarning() {
  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm">
      <p className="font-medium text-rose-300">Testnet · Beta</p>
      <p className="mt-1 text-rose-200/70">
        This signs and submits real transactions to Nado&apos;s Ink Sepolia testnet gateway with
        your connected wallet. Some order-encoding details (expiration flags, the order-type
        appendix) are best-effort and haven&apos;t been verified against a live account — expect
        rough edges. Testnet funds only; this isn&apos;t wired up for mainnet.
      </p>
    </div>
  );
}
