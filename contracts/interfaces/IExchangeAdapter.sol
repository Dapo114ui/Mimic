// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IExchangeAdapter
/// @notice Abstraction over Nado's on-chain custody / risk-engine contracts on Ink.
/// @dev Nado matches orders off-chain through its sequencer/engine using EIP-712-signed
/// messages and settles on-chain in batches (see docs.nado.xyz/developer-resources) — trading
/// authority is delegated to a linked signer rather than exercised through per-order on-chain
/// calls. This interface covers only the on-chain surface a vault needs: custody and
/// mark-to-market accounting, plus delegating (and revoking) that off-chain trading authority.
/// Every function besides `accountValue` operates on `msg.sender`'s own Nado account, so the
/// adapter never needs to trust a caller-supplied account address for a state change.
/// A concrete `NadoAdapter` targeting Nado's deployed contracts replaces this once their ABI is
/// finalized; `MockExchangeAdapter` in contracts/mocks is a test double against this interface.
interface IExchangeAdapter {
    /// @notice Pulls `amount` of the caller's collateral into the caller's Nado margin account.
    /// @dev Caller must have approved this adapter for `amount` beforehand.
    function deposit(uint256 amount) external;

    /// @notice Withdraws `amount` from the caller's Nado margin account back to the caller.
    function withdraw(uint256 amount) external;

    /// @notice Mark-to-market equity of `account`: idle margin plus unrealized PnL across all
    /// open spot/perp/margin positions. This is the source of truth for a vault's NAV.
    function accountValue(address account) external view returns (uint256);

    /// @notice Authorizes or revokes `signer` to place/cancel orders for the caller's account
    /// off-chain via Nado's engine, without granting it withdrawal rights.
    function setTradingAuthority(address signer, bool authorized) external;

    /// @notice On-chain escape hatch that flattens all of the caller's open positions, for use
    /// if Nado's off-chain engine is censoring or unavailable and a forced exit is needed.
    function emergencyCloseAll() external;
}
