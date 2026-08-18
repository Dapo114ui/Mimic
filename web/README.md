# Mimic — web

Marketing landing page for [Mimic](../README.md), copy-trading vaults built on top of Nado.
Next.js (App Router) + Tailwind CSS v4, with wagmi/viem wired up for wallet connection.

## Layout

```
src/
  app/          # root layout, global styles, the home page
  components/    # Navbar, Hero, TrustBar, Features, HowItWorks, Footer, ConnectButton
  lib/wagmi.ts   # wagmi config — Ink mainnet (chain 57073), injected connector
```

No live contract reads happen on this page yet — `ConnectButton` establishes a real wallet
connection via wagmi, but nothing here talks to `MimicVaultFactory` or `StrategyVault` (see
`../contracts/`). That's the next layer: a vault-discovery / leaderboard page under the app
itself.

## Usage

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npx eslint .
```
