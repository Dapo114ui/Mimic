const STEPS = [
  {
    step: "01",
    title: "A strategist launches a vault",
    body: "Any trader can spin up a vault and set their own performance fee — reputation is earned on results, not gatekept at launch.",
  },
  {
    step: "02",
    title: "Followers deposit & mirror trades",
    body: "Deposits are priced at the vault's live NAV. A keeper mirrors the strategist's trades on Nado, scaled to the vault's size.",
  },
  {
    step: "03",
    title: "Fees only on realized gains",
    body: "Each depositor has their own cost basis. Redeem after a short cooldown, at the price on the day you actually exit.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          How it works
        </h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {STEPS.map((item) => (
            <div key={item.step}>
              <span className="font-mono text-sm text-accent">{item.step}</span>
              <h3 className="mt-3 text-lg font-medium text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
