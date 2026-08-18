// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Initializer surface MimicVaultFactory calls right after cloning a vault. Separated
/// from StrategyVault's full ABI so the factory only depends on what it actually needs to call.
interface IStrategyVault {
    function initialize(address strategist, string calldata name, string calldata symbol, uint16 performanceFeeBps)
        external;
}
