import { ConnectButton } from "./ConnectButton";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-24 pb-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-[36rem] w-[36rem] -translate-x-1/2 animate-drift rounded-full bg-accent-2/20 blur-[120px]" />
        <div className="absolute right-[8%] top-[18%] h-[24rem] w-[24rem] animate-drift rounded-full bg-accent/15 blur-[100px] [animation-delay:-8s]" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-mist-dim">
          Built for Nado · Ink L2
        </span>
        <h1 className="text-balance text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Mirror Nado&apos;s best traders.
          <br />
          <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
            Automatically.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg text-mist">
          Mimic pools follower capital into on-chain vaults that mirror a strategist&apos;s trades
          on Nado&apos;s orderbook. You keep control of your exit — they keep proving their edge.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <ConnectButton className="px-6 py-3 text-base" />
          <a
            href="https://github.com/Dapo114ui/Mimic"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-base font-medium text-mist transition hover:border-white/30 hover:text-foreground"
          >
            View the contracts
          </a>
        </div>
        <p className="mt-6 text-sm text-mist-dim">
          Vault contracts are open-source and in testing — mainnet vaults coming soon.
        </p>
      </div>
    </section>
  );
}
