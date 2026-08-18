// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Read-only configuration surface every StrategyVault clone reads back from its
/// factory, so protocol-wide settings (asset, adapter, fees, cooldown, pause) live in one place.
interface IMimicVaultFactory {
    function asset() external view returns (address);
    function exchangeAdapter() external view returns (address);
    function paused() external view returns (bool);
    function withdrawalCooldown() external view returns (uint256);
    function protocolFeeRecipient() external view returns (address);
    function protocolFeeShareBps() external view returns (uint16);
    function isVault(address vault) external view returns (bool);
}
