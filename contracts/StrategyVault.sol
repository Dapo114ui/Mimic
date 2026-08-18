// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IExchangeAdapter} from "./interfaces/IExchangeAdapter.sol";
import {IMimicVaultFactory} from "./interfaces/IMimicVaultFactory.sol";
import {IStrategyVault} from "./interfaces/IStrategyVault.sol";

/// @title StrategyVault
/// @notice One strategist's copy-trading vault. Followers deposit the factory's collateral
/// asset and receive shares representing a claim on the vault's Nado margin account, which
/// mirrors the strategist's trades scaled to the vault's size. Deployed as an EIP-1167 minimal
/// proxy clone by MimicVaultFactory — all per-vault state lives here, set up via `initialize`.
/// @dev Deposits are synchronous and priced at the current share price. Redemptions are async
/// (request now, claim after a cooldown, priced at claim time) so a wave of exits never forces
/// the strategist to unwind open positions at withdrawal-instant notice — the same problem
/// ERC-7540 solves for vaults wrapping illiquid or actively-managed strategies. Deposits and
/// trading-authority grants are pausable at the factory level as a circuit breaker; redemptions
/// and the emergency close-all are not, so user funds are never trapped.
contract StrategyVault is Initializable, ERC20Upgradeable, ReentrancyGuardTransient, IStrategyVault {
    using SafeERC20 for IERC20;

    uint256 private constant SHARE_PRICE_PRECISION = 1e18;
    uint16 private constant BPS_DENOMINATOR = 10_000;

    struct RedeemRequest {
        address owner;
        address receiver;
        uint256 shares;
        uint256 claimableAt;
        bool settled; // claimed or cancelled
    }

    address public factory;
    address public strategist;
    uint16 public performanceFeeBps;
    bool public closed;
    uint8 private _assetDecimals;

    /// @notice Per-depositor cost basis (assets-per-share, scaled by SHARE_PRICE_PRECISION) —
    /// a personal high-water mark rather than one shared across the vault, so a follower who
    /// buys in after a strategist's winning streak is never charged fee on gains booked before
    /// they joined. Blended on deposit, ratcheted up (never down) on redemption once a gain
    /// above it is realized and taxed. Moves with the shares on a plain transfer, since it is a
    /// property of the tax lot, not the address holding it.
    mapping(address => uint256) public costBasis;
    mapping(address => bool) public isKeeper;
    RedeemRequest[] public redeemRequests;
    uint256 public pendingRedeemShares;

    event Deposited(address indexed sender, address indexed receiver, uint256 assets, uint256 shares);
    event RedeemRequested(
        uint256 indexed requestId, address indexed owner, address indexed receiver, uint256 shares, uint256 claimableAt
    );
    event RedeemClaimed(
        uint256 indexed requestId, address indexed receiver, uint256 assets, uint256 strategistFee, uint256 protocolFee
    );
    event RedeemCancelled(uint256 indexed requestId, address indexed owner, uint256 shares);
    event KeeperSet(address indexed keeper, bool allowed);
    event VaultClosed();
    event TradingAuthoritySet(address indexed signer, bool authorized);
    event EmergencyClosedAll();

    modifier onlyStrategist() {
        require(msg.sender == strategist, "vault: not strategist");
        _;
    }

    modifier onlyKeeper() {
        require(isKeeper[msg.sender], "vault: not keeper");
        _;
    }

    modifier whenNotPaused() {
        require(!IMimicVaultFactory(factory).paused(), "vault: paused");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _strategist, string calldata name_, string calldata symbol_, uint16 _performanceFeeBps)
        external
        override
        initializer
    {
        __ERC20_init(name_, symbol_);

        factory = msg.sender;
        strategist = _strategist;
        performanceFeeBps = _performanceFeeBps;
        _assetDecimals = IERC20Metadata(IMimicVaultFactory(msg.sender).asset()).decimals();
        isKeeper[_strategist] = true;
    }

    function decimals() public view override returns (uint8) {
        return _assetDecimals;
    }

    // ---------------------------------------------------------------------
    // Accounting
    // ---------------------------------------------------------------------

    /// @notice Vault NAV: mark-to-market equity of this vault's Nado account, including assets
    /// still locked against unclaimed redeem requests.
    function totalAssets() public view returns (uint256) {
        return IExchangeAdapter(IMimicVaultFactory(factory).exchangeAdapter()).accountValue(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? assets : (assets * supply) / totalAssets();
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply();
        return supply == 0 ? shares : (shares * totalAssets()) / supply;
    }

    // ---------------------------------------------------------------------
    // Deposits
    // ---------------------------------------------------------------------

    function deposit(uint256 assets, address receiver) external nonReentrant whenNotPaused returns (uint256 shares) {
        require(!closed, "vault: closed");
        require(assets > 0, "vault: zero deposit");

        uint256 supply = totalSupply();
        uint256 assetsBefore = totalAssets();
        uint256 priceNow = supply == 0 ? SHARE_PRICE_PRECISION : (assetsBefore * SHARE_PRICE_PRECISION) / supply;
        shares = supply == 0 ? assets : (assets * supply) / assetsBefore;
        require(shares > 0, "vault: zero shares");

        uint256 priorShares = balanceOf(receiver);
        costBasis[receiver] = (priorShares * costBasis[receiver] + shares * priceNow) / (priorShares + shares);

        IMimicVaultFactory f = IMimicVaultFactory(factory);
        IExchangeAdapter adapter = IExchangeAdapter(f.exchangeAdapter());
        IERC20 asset_ = IERC20(f.asset());

        asset_.safeTransferFrom(msg.sender, address(this), assets);
        asset_.forceApprove(address(adapter), assets);
        adapter.deposit(assets);

        _mint(receiver, shares);
        emit Deposited(msg.sender, receiver, assets, shares);
    }

    // ---------------------------------------------------------------------
    // Redemptions
    // ---------------------------------------------------------------------

    function requestRedeem(uint256 shares, address receiver) external nonReentrant returns (uint256 requestId) {
        require(shares > 0, "vault: zero shares");
        _transfer(msg.sender, address(this), shares);
        pendingRedeemShares += shares;

        uint256 claimableAt = block.timestamp + IMimicVaultFactory(factory).withdrawalCooldown();
        requestId = redeemRequests.length;
        redeemRequests.push(
            RedeemRequest({owner: msg.sender, receiver: receiver, shares: shares, claimableAt: claimableAt, settled: false})
        );

        emit RedeemRequested(requestId, msg.sender, receiver, shares, claimableAt);
    }

    /// @notice Lets a requester stay invested if they change their mind before the cooldown ends.
    function cancelRedeemRequest(uint256 requestId) external nonReentrant {
        RedeemRequest storage req = redeemRequests[requestId];
        require(msg.sender == req.owner, "vault: not request owner");
        require(!req.settled, "vault: already settled");

        req.settled = true;
        pendingRedeemShares -= req.shares;
        _transfer(address(this), req.owner, req.shares);

        emit RedeemCancelled(requestId, req.owner, req.shares);
    }

    /// @notice Settles a matured redeem request at the share price prevailing at claim time (not
    /// request time), so an exiting depositor shares pro rata in any PnL realized during the
    /// cooldown instead of locking in a price ahead of the rest of the pool.
    function claimRedeem(uint256 requestId) external nonReentrant {
        RedeemRequest storage req = redeemRequests[requestId];
        require(!req.settled, "vault: already settled");
        require(block.timestamp >= req.claimableAt, "vault: still cooling down");

        req.settled = true;
        pendingRedeemShares -= req.shares;

        uint256 assets = convertToAssets(req.shares);
        uint256 sharePrice = (assets * SHARE_PRICE_PRECISION) / req.shares;

        uint256 strategistFee;
        uint256 protocolFee;
        uint256 basis = costBasis[req.owner];
        if (sharePrice > basis) {
            uint256 feeableGain = ((sharePrice - basis) * req.shares) / SHARE_PRICE_PRECISION;
            uint256 totalFee = (feeableGain * performanceFeeBps) / BPS_DENOMINATOR;
            protocolFee = (totalFee * IMimicVaultFactory(factory).protocolFeeShareBps()) / BPS_DENOMINATOR;
            strategistFee = totalFee - protocolFee;
            costBasis[req.owner] = sharePrice; // this gain is now realized and taxed — never re-tax it
        }

        _burn(address(this), req.shares);

        IMimicVaultFactory f = IMimicVaultFactory(factory);
        IExchangeAdapter adapter = IExchangeAdapter(f.exchangeAdapter());
        IERC20 asset_ = IERC20(f.asset());

        adapter.withdraw(assets);
        uint256 payout = assets - strategistFee - protocolFee;
        asset_.safeTransfer(req.receiver, payout);
        if (strategistFee > 0) asset_.safeTransfer(strategist, strategistFee);
        if (protocolFee > 0) asset_.safeTransfer(f.protocolFeeRecipient(), protocolFee);

        emit RedeemClaimed(requestId, req.receiver, payout, strategistFee, protocolFee);
    }

    function redeemRequestsLength() external view returns (uint256) {
        return redeemRequests.length;
    }

    // ---------------------------------------------------------------------
    // Strategist controls
    // ---------------------------------------------------------------------

    function setKeeper(address keeper, bool allowed) external onlyStrategist {
        isKeeper[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    /// @notice Authorizes `signer` to place/cancel orders for this vault's Nado account
    /// off-chain, mirroring the strategist's trades sized to this vault's NAV, without granting
    /// it withdrawal rights. The mirroring logic itself runs off-chain in a keeper service
    /// holding `signer`'s key — this call only grants or revokes that service's authority.
    function setTradingAuthority(address signer, bool authorized) external onlyStrategist whenNotPaused {
        IExchangeAdapter(IMimicVaultFactory(factory).exchangeAdapter()).setTradingAuthority(signer, authorized);
        emit TradingAuthoritySet(signer, authorized);
    }

    /// @notice Stops new deposits. Existing depositors can still request and claim redemptions.
    function closeVault() external onlyStrategist {
        closed = true;
        emit VaultClosed();
    }

    /// @notice On-chain fallback that flattens every open position, for use if Nado's off-chain
    /// engine is unavailable or censoring and the strategist needs to force an exit. Deliberately
    /// not blocked by the factory pause.
    function emergencyCloseAll() external onlyKeeper {
        IExchangeAdapter(IMimicVaultFactory(factory).exchangeAdapter()).emergencyCloseAll();
        emit EmergencyClosedAll();
    }
}
