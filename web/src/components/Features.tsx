const FEATURES = [
  {
    title: "Fees on your gains only",
    body: "Performance fees are tracked per depositor, not pooled. Join after a winning streak and you're never charged for gains booked before you arrived.",
  },
  {
    title: "Your exit, never trapped",
    body: "New deposits and trading authority can be paused during a risk event, but withdrawals and emergency position-flattening never are.",
  },
  {
    title: "Built on Nado's orderbook",
    body: "Vaults mirror trades through Nado's unified spot, perps, and margin engine on Ink — no synthetic wrapper, no separate liquidity.",
  },
  {
    title: "Open-source vault logic",
    body: "Every vault is a transparent, EIP-1167 clone of the same audited implementation. No black-box strategy execution off-chain.",
  },
];

export function Features() {
  return (
    <section id="why-mimic" className="border-b border-white/5 bg-ink-900/40 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Copy-trading, done fairly.
        </h2>
        <p className="mt-4 max-w-2xl text-mist">
          The layer Nado left open. Mimic lets capital follow conviction — without asking
          followers to trust a black box.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="text-lg font-medium text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
