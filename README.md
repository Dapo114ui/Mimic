# Mimic

Copy-trading vaults on top of [Nado](https://www.nado.xyz/), a CLOB perps/spot/margin DEX on
Ink L2. This repo currently holds the **Model A** contracts: pooled-capital vaults, one per
strategist, that mirror the strategist's trades for every follower who deposits.

(Model B — signal-relay copy-trading with no pooled funds — is a separate, lighter-weight
approach and isn't implemented here.)

## Architecture

```
MimicVaultFactory  ── clones (EIP-1167) ──>  StrategyVault  ── IExchangeAdapter ──>  Nado
     (registry,                              (one per strategist,                  (off-chain
      shared config)                          ERC20 shares)                         engine +
                                                                                     on-chain
                                                                                     custody)
```

- **`MimicVaultFactory`** — deploys a `StrategyVault` clone per strategist (permissionless —
  reputation is earned on the leaderboard, not gated at launch), registers all vaults, and holds
  protocol-wide config every vault reads back: collateral asset, exchange adapter address,
  protocol fee split, withdrawal cooldown, and a pause switch.
- **`StrategyVault`** — one strategist's vault. Followers deposit the collateral asset and
  receive shares priced against the vault's live NAV. Deposits are synchronous; redemptions are
  async (request now, claim after a cooldown, priced at claim time) so a wave of exits never
  forces the strategist to unwind open positions on demand — the same problem
  [ERC-7540](https://eips.ethereum.org/EIPS/eip-7540) solves for vaults wrapping actively-managed
  strategies. Performance fees use a **per-depositor cost basis**, not one shared high-water
  mark, so a follower who joins after a winning streak is never charged fee on gains booked
  before they arrived.
- **`IExchangeAdapter`** — the on-chain surface the vault needs from Nado: deposit/withdraw
  collateral, mark-to-market `accountValue`, and delegating (or revoking) a trade-only signer.
  Nado matches orders off-chain through its sequencer/engine using EIP-712-signed messages and
  settles on-chain in batches, so a vault's own trading authority is granted to an off-chain
  keeper's signer key rather than exercised via on-chain order calls — mirroring is a keeper
  service, not a vault function. `MockExchangeAdapter` (contracts/mocks) is a test double against
  this interface; a concrete `NadoAdapter` replaces it once Nado's deployed contract ABI on Ink
  is available.

## Known simplifications (flagged, not hidden)

- `IExchangeAdapter` is a placeholder pending Nado's finalized on-chain interface.
- Performance fee is realized only at redemption (no periodic/streaming crystallization).
- No on-chain enforcement stops a strategist from setting `performanceFeeBps` right up to
  `MAX_PERFORMANCE_FEE_BPS` (50%) — the leaderboard/UI layer is expected to make that visible to
  followers before they deposit.

## Layout

```
contracts/
  MimicVaultFactory.sol
  StrategyVault.sol
  interfaces/
    IExchangeAdapter.sol
    IMimicVaultFactory.sol
    IStrategyVault.sol
  mocks/                  # test doubles only, not for deployment
    MockERC20.sol
    MockExchangeAdapter.sol
test/
  StrategyVault.test.js
scripts/
  deploy.js
web/                      # Next.js marketing site — see web/README.md
```

## Usage

```bash
npm install
npx hardhat compile
npx hardhat test
```

For the marketing site, see [`web/README.md`](web/README.md).
