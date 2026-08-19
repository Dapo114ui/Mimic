# Mimic

A market data and portfolio dashboard for [Nado](https://www.nado.xyz/), a CLOB perps/spot/
margin DEX on Ink L2: live-style prices and charts across Nado's markets, plus an account view
(equity, positions, trade history). Read-only — no order placement.

(This repo previously explored a copy-trading vault product on top of Nado. That direction was
dropped in favor of this dashboard; the vault contracts are gone from the working tree but still
exist in git history if that direction is revisited.)

## Layout

```
web/    Next.js app — see web/README.md for the real detail
```

Everything lives under `web/`; there's nothing at the repo root beyond this file.
