// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {StrategyVault} from "./StrategyVault.sol";
import {IStrategyVault} from "./interfaces/IStrategyVault.sol";
import {IMimicVaultFactory} from "./interfaces/IMimicVaultFactory.sol";

/// @title MimicVaultFactory
/// @notice Deploys and registers per-strategist copy-trading vaults as EIP-1167 minimal-proxy
/// clones of a single StrategyVault implementation, and holds the protocol-wide configuration
/// (collateral asset, Nado exchange adapter, fee split, withdrawal cooldown) every vault reads
/// back at call time — so a config change applies to all vaults without touching each one.
contract MimicVaultFactory is Ownable2Step, IMimicVaultFactory {
    uint16 public constant MAX_PERFORMANCE_FEE_BPS = 5000; // a strategist can set up to 50%
    uint16 public constant BPS_DENOMINATOR = 10_000;

    address public immutable vaultImplementation;
    address public immutable asset;

    address public exchangeAdapter;
    address public protocolFeeRecipient;
    uint16 public protocolFeeShareBps = 2000; // protocol's cut of each vault's performance fee
    uint256 public withdrawalCooldown = 3 days;
    bool public paused;

    address[] public allVaults;
    mapping(address strategist => address[] vaults) public vaultsByStrategist;
    mapping(address vault => bool) public isVault;

    event VaultCreated(
        address indexed strategist, address indexed vault, string name, string symbol, uint16 performanceFeeBps
    );
    event ExchangeAdapterSet(address indexed adapter);
    event ProtocolFeeRecipientSet(address indexed recipient);
    event ProtocolFeeShareSet(uint16 shareBps);
    event WithdrawalCooldownSet(uint256 cooldown);
    event PausedSet(bool paused);

    constructor(address _asset, address _exchangeAdapter, address _protocolFeeRecipient, address _owner)
        Ownable(_owner)
    {
        require(
            _asset != address(0) && _exchangeAdapter != address(0) && _protocolFeeRecipient != address(0),
            "factory: zero address"
        );
        asset = _asset;
        exchangeAdapter = _exchangeAdapter;
        protocolFeeRecipient = _protocolFeeRecipient;
        vaultImplementation = address(new StrategyVault());
    }

    /// @notice Permissionless: any address can become a strategist by launching a vault.
    /// Reputation is earned on the leaderboard, not gated at deployment.
    function createVault(string calldata name, string calldata symbol, uint16 performanceFeeBps)
        external
        returns (address vault)
    {
        require(!paused, "factory: paused");
        require(performanceFeeBps <= MAX_PERFORMANCE_FEE_BPS, "factory: fee too high");

        vault = Clones.clone(vaultImplementation);
        IStrategyVault(vault).initialize(msg.sender, name, symbol, performanceFeeBps);

        allVaults.push(vault);
        vaultsByStrategist[msg.sender].push(vault);
        isVault[vault] = true;

        emit VaultCreated(msg.sender, vault, name, symbol, performanceFeeBps);
    }

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }

    function vaultsOf(address strategist) external view returns (address[] memory) {
        return vaultsByStrategist[strategist];
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setExchangeAdapter(address newAdapter) external onlyOwner {
        require(newAdapter != address(0), "factory: zero address");
        exchangeAdapter = newAdapter;
        emit ExchangeAdapterSet(newAdapter);
    }

    function setProtocolFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "factory: zero address");
        protocolFeeRecipient = newRecipient;
        emit ProtocolFeeRecipientSet(newRecipient);
    }

    function setProtocolFeeShareBps(uint16 newShareBps) external onlyOwner {
        require(newShareBps <= BPS_DENOMINATOR, "factory: invalid bps");
        protocolFeeShareBps = newShareBps;
        emit ProtocolFeeShareSet(newShareBps);
    }

    function setWithdrawalCooldown(uint256 newCooldown) external onlyOwner {
        withdrawalCooldown = newCooldown;
        emit WithdrawalCooldownSet(newCooldown);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }
}
