export function TrustBar() {
  return (
    <section className="border-y border-white/5 bg-ink-900/40 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
        <p className="text-sm text-mist-dim">
          Pre-launch — vault contracts are open-source and in testing on Ink Sepolia.
        </p>
        <div className="flex items-center gap-6 text-sm text-mist">
          <span>Ink L2</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>Nado Orderbook</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>EIP-1167 Vaults</span>
        </div>
      </div>
    </section>
  );
}
