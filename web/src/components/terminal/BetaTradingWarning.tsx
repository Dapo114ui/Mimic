export function BetaTradingWarning() {
  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm">
      <p className="font-medium text-rose-300">Mainnet · Beta — real funds</p>
      <p className="mt-1 text-rose-200/70">
        This signs and submits real transactions to Nado&apos;s Ink mainnet gateway with your
        connected wallet. The signing scheme (EIP-712 domains, order/appendix encoding,
        subaccount format) is grounded in Nado&apos;s own SDK source and documentation, but no
        signed transaction from this integration has actually been round-tripped end to end —
        there&apos;s no funded wallet in the environment that built it to test with. Start with a
        small size until you&apos;ve confirmed an order behaves as expected.
      </p>
    </div>
  );
}
