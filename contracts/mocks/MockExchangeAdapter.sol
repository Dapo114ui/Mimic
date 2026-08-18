// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IExchangeAdapter} from "../interfaces/IExchangeAdapter.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice Test double for Nado's on-chain custody/risk-engine contracts. Tracks a simple
/// per-account equity ledger and exposes `simulatePnL` so tests can move an account's
/// mark-to-market value directly, standing in for what Nado's real contracts would report once
/// off-chain trades settle. Not gas- or security-hardened; not for deployment.
contract MockExchangeAdapter is IExchangeAdapter {
    using SafeERC20 for IERC20;

    MockERC20 public immutable asset;
    mapping(address => uint256) public equity;
    mapping(address => mapping(address => bool)) public tradingAuthority;

    constructor(MockERC20 _asset) {
        asset = _asset;
    }

    function deposit(uint256 amount) external override {
        IERC20(address(asset)).safeTransferFrom(msg.sender, address(this), amount);
        equity[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external override {
        require(equity[msg.sender] >= amount, "mock: insufficient equity");
        equity[msg.sender] -= amount;
        IERC20(address(asset)).safeTransfer(msg.sender, amount);
    }

    function accountValue(address account) external view override returns (uint256) {
        return equity[account];
    }

    function setTradingAuthority(address signer, bool authorized) external override {
        tradingAuthority[msg.sender][signer] = authorized;
    }

    function emergencyCloseAll() external override {
        // no-op: the real adapter would flatten open positions on Nado
    }

    /// @notice Test-only: simulates trading PnL. Gains mint fresh backing collateral so a
    /// later `withdraw` can still pay out real tokens; losses only reduce tracked equity.
    function simulatePnL(address account, int256 delta) external {
        if (delta >= 0) {
            uint256 gain = uint256(delta);
            asset.mint(address(this), gain);
            equity[account] += gain;
        } else {
            uint256 loss = uint256(-delta);
            require(equity[account] >= loss, "mock: loss exceeds equity");
            equity[account] -= loss;
        }
    }
}
