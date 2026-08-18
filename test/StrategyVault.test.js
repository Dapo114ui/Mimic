const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const USDC_DECIMALS = 6;
const usdc = (n) => ethers.parseUnits(n.toString(), USDC_DECIMALS);
const THREE_DAYS = 3 * 24 * 60 * 60;

async function deployFixture() {
  const [owner, strategist, alice, bob, protocolFeeRecipient] = await ethers.getSigners();

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdcToken = await MockERC20.deploy("Mock USDC", "mUSDC", USDC_DECIMALS);

  const MockExchangeAdapter = await ethers.getContractFactory("MockExchangeAdapter");
  const adapter = await MockExchangeAdapter.deploy(await usdcToken.getAddress());

  const MimicVaultFactory = await ethers.getContractFactory("MimicVaultFactory");
  const factory = await MimicVaultFactory.deploy(
    await usdcToken.getAddress(),
    await adapter.getAddress(),
    protocolFeeRecipient.address,
    owner.address
  );

  for (const user of [alice, bob]) {
    await usdcToken.mint(user.address, usdc(1_000_000));
  }

  return { owner, strategist, alice, bob, protocolFeeRecipient, usdcToken, adapter, factory };
}

async function createVault(factory, strategist, performanceFeeBps = 2000) {
  const tx = await factory.connect(strategist).createVault("Mimic BTC Scalper", "mBTC-SCALP", performanceFeeBps);
  const receipt = await tx.wait();
  const event = receipt.logs
    .map((log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed && parsed.name === "VaultCreated");
  const vaultAddress = event.args.vault;
  return ethers.getContractAt("StrategyVault", vaultAddress);
}

async function depositAs(usdcToken, vault, user, amount) {
  await usdcToken.connect(user).approve(await vault.getAddress(), amount);
  await vault.connect(user).deposit(amount, user.address);
}

describe("MimicVaultFactory + StrategyVault (Model A)", function () {
  describe("MimicVaultFactory", function () {
    it("deploys a clone per strategist and registers it", async function () {
      const { strategist, factory } = await deployFixture();
      const vault = await createVault(factory, strategist);

      expect(await factory.isVault(await vault.getAddress())).to.equal(true);
      expect(await factory.allVaultsLength()).to.equal(1n);
      expect(await vault.strategist()).to.equal(strategist.address);
      expect(await vault.name()).to.equal("Mimic BTC Scalper");
      expect(await vault.decimals()).to.equal(USDC_DECIMALS);
    });

    it("lets the same strategist launch multiple vaults", async function () {
      const { strategist, factory } = await deployFixture();
      await createVault(factory, strategist, 1000);
      await createVault(factory, strategist, 2000);
      const vaults = await factory.vaultsOf(strategist.address);
      expect(vaults.length).to.equal(2);
    });

    it("rejects a performance fee above the hard cap", async function () {
      const { strategist, factory } = await deployFixture();
      await expect(createVault(factory, strategist, 5001)).to.be.revertedWith("factory: fee too high");
    });

    it("blocks vault creation while paused", async function () {
      const { owner, strategist, factory } = await deployFixture();
      await factory.connect(owner).setPaused(true);
      await expect(createVault(factory, strategist)).to.be.revertedWith("factory: paused");
    });

    it("restricts admin setters to the owner", async function () {
      const { strategist, factory } = await deployFixture();
      await expect(factory.connect(strategist).setPaused(true)).to.be.revertedWithCustomError(
        factory,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("deposits", function () {
    it("mints shares 1:1 with assets on a genesis deposit", async function () {
      const { strategist, alice, usdcToken, factory } = await deployFixture();
      const vault = await createVault(factory, strategist);

      await depositAs(usdcToken, vault, alice, usdc(1000));

      expect(await vault.balanceOf(alice.address)).to.equal(usdc(1000));
      expect(await vault.totalAssets()).to.equal(usdc(1000));
    });

    it("prices a second deposit off the live NAV, not the deposit count", async function () {
      const { strategist, alice, bob, usdcToken, adapter, factory } = await deployFixture();
      const vault = await createVault(factory, strategist);

      await depositAs(usdcToken, vault, alice, usdc(1000));
      // simulate the strategist's mirrored position doubling the vault's NAV
      await adapter.simulatePnL(await vault.getAddress(), usdc(1000));

      await depositAs(usdcToken, vault, bob, usdc(2000));

      // NAV was 2000 for 1000 shares outstanding -> bob's 2000 assets buy 1000 shares
      expect(await vault.balanceOf(bob.address)).to.equal(usdc(1000));
      expect(await vault.totalAssets()).to.equal(usdc(4000));
    });

    it("forwards deposited collateral into the exchange adapter, not idle in the vault", async function () {
      const { strategist, alice, usdcToken, adapter, factory } = await deployFixture();
      const vault = await createVault(factory, strategist);
      await depositAs(usdcToken, vault, alice, usdc(1000));

      expect(await usdcToken.balanceOf(await vault.getAddress())).to.equal(0n);
      expect(await usdcToken.balanceOf(await adapter.getAddress())).to.equal(usdc(1000));
    });

    it("blocks deposits once the strategist closes the vault", async function () {
      const { strategist, alice, usdcToken, factory } = await deployFixture();
      const vault = await createVault(factory, strategist);
      await vault.connect(strategist).closeVault();

      await usdcToken.connect(alice).approve(await vault.getAddress(), usdc(100));
      await expect(vault.connect(alice).deposit(usdc(100), alice.address)).to.be.revertedWith("vault: closed");
    });

    it("blocks deposits while the factory is paused, but not redemptions", async function () {
      const { owner, strategist, alice, usdcToken, factory } = await deployFixture();
      const vault = await createVault(factory, strategist);
      await depositAs(usdcToken, vault, alice, usdc(1000));

      await factory.connect(owner).setPaused(true);

      await usdcToken.connect(alice).approve(await vault.getAddress(), usdc(100));
      await expect(vault.connect(alice).deposit(usdc(100), alice.address)).to.be.revertedWith("vault: paused");

      // exits must still work under pause
      await expect(vault.connect(alice).requestRedeem(usdc(500), alice.address)).to.not.be.reverted;
    });
  });

  describe("redemptions", function () {
    it("enforces the withdrawal cooldown before a claim", async function () {
      const { strategist, alice, usdcToken, factory } = await deployFixture();
      const vault = await createVault(factory, strategist);
      await depositAs(usdcToken, vault, alice, usdc(1000));

      await vault.connect(alice).requestRedeem(usdc(1000), alice.address);
      await expect(vault.connect(alice).claimRedeem(0)).to.be.revertedWith("vault: still cooling down");

      await time.increase(THREE_DAYS);
      await expect(vault.connect(alice).claimRedeem(0)).to.not.be.reverted;
    });

    it("pays back principal with no performance fee when flat", async function () {
      const { strategist, alice, usdcToken, factory } = await deployFixture();
      const vault = await createVault(factory, strategist, 2000);
      await depositAs(usdcToken, vault, alice, usdc(1000));

      await vault.connect(alice).requestRedeem(usdc(1000), alice.address);
      await time.increase(THREE_DAYS);

      const before = await usdcToken.balanceOf(alice.address);
      await vault.connect(alice).claimRedeem(0);
      const after = await usdcToken.balanceOf(alice.address);

      expect(after - before).to.equal(usdc(1000));
    });

    it("charges the performance fee on gains at claim-time price and splits it with the protocol", async function () {
      const { strategist, alice, protocolFeeRecipient, usdcToken, adapter, factory } = await deployFixture();
      const performanceFeeBps = 2000n; // 20%
      const protocolFeeShareBps = await factory.protocolFeeShareBps(); // default 20% of that
      const vault = await createVault(factory, strategist, performanceFeeBps);

      await depositAs(usdcToken, vault, alice, usdc(1000));
      // strategist's mirrored trade turns 1000 -> 1500 (500 gain)
      await adapter.simulatePnL(await vault.getAddress(), usdc(500));

      await vault.connect(alice).requestRedeem(usdc(1000), alice.address);
      await time.increase(THREE_DAYS);

      const strategistBefore = await usdcToken.balanceOf(strategist.address);
      const protocolBefore = await usdcToken.balanceOf(protocolFeeRecipient.address);
      const aliceBefore = await usdcToken.balanceOf(alice.address);

      await vault.connect(alice).claimRedeem(0);

      const totalFee = (usdc(500) * performanceFeeBps) / 10_000n;
      const protocolFee = (totalFee * protocolFeeShareBps) / 10_000n;
      const strategistFee = totalFee - protocolFee;

      expect((await usdcToken.balanceOf(alice.address)) - aliceBefore).to.equal(usdc(1500) - totalFee);
      expect((await usdcToken.balanceOf(strategist.address)) - strategistBefore).to.equal(strategistFee);
      expect((await usdcToken.balanceOf(protocolFeeRecipient.address)) - protocolBefore).to.equal(protocolFee);
    });

    it("charges no fee on a loss and does not lower the high-water mark", async function () {
      const { strategist, alice, usdcToken, adapter, factory } = await deployFixture();
      const vault = await createVault(factory, strategist, 2000);
      await depositAs(usdcToken, vault, alice, usdc(1000));

      await adapter.simulatePnL(await vault.getAddress(), -usdc(200)); // vault down to 800

      const before = await usdcToken.balanceOf(alice.address);
      await vault.connect(alice).requestRedeem(usdc(1000), alice.address);
      await time.increase(THREE_DAYS);
      await vault.connect(alice).claimRedeem(0);
      const after = await usdcToken.balanceOf(alice.address);

      expect(after - before).to.equal(usdc(800));
      expect(await vault.costBasis(alice.address)).to.equal(ethers.parseUnits("1", 18));
    });

    it("never charges a late depositor fee on gains booked before they joined", async function () {
      const { strategist, alice, bob, usdcToken, adapter, factory } = await deployFixture();
      const vault = await createVault(factory, strategist, 2000);

      await depositAs(usdcToken, vault, alice, usdc(1000));
      await adapter.simulatePnL(await vault.getAddress(), usdc(500)); // NAV 1500 for 1000 shares, all alice's gain

      await depositAs(usdcToken, vault, bob, usdc(1500)); // bob buys in at the new price, gets 1000 shares
      expect(await vault.costBasis(bob.address)).to.equal(ethers.parseUnits("1.5", 18));

      // flat after bob joins: no new gain accrues to either depositor
      await vault.connect(bob).requestRedeem(usdc(1000), bob.address);
      await time.increase(THREE_DAYS);

      const strategistBefore = await usdcToken.balanceOf(strategist.address);
      const bobBefore = await usdcToken.balanceOf(bob.address);
      await vault.connect(bob).claimRedeem(0);

      // bob gets his 1500 back untaxed; the fee already charged (if any) belongs to alice's redemption alone
      expect((await usdcToken.balanceOf(bob.address)) - bobBefore).to.equal(usdc(1500));
      expect((await usdcToken.balanceOf(strategist.address)) - strategistBefore).to.equal(0n);
    });

    it("ratchets a depositor's cost basis on partial redemption so the same gain is never taxed twice", async function () {
      const { strategist, alice, usdcToken, adapter, factory } = await deployFixture();
      const performanceFeeBps = 2000n;
      const vault = await createVault(factory, strategist, performanceFeeBps);

      await depositAs(usdcToken, vault, alice, usdc(1000));
      await adapter.simulatePnL(await vault.getAddress(), usdc(500)); // NAV 1500 for 1000 shares

      // partial redeem: half the position, half the gain gets taxed and basis ratchets to 1.5
      await vault.connect(alice).requestRedeem(usdc(500), alice.address);
      await time.increase(THREE_DAYS);

      let strategistBefore = await usdcToken.balanceOf(strategist.address);
      await vault.connect(alice).claimRedeem(0);
      let strategistFee = (await usdcToken.balanceOf(strategist.address)) - strategistBefore;
      expect(strategistFee).to.be.gt(0n);
      expect(await vault.costBasis(alice.address)).to.equal(ethers.parseUnits("1.5", 18));

      // no further PnL: redeeming the rest at the same 1.5 price must not be taxed again
      await vault.connect(alice).requestRedeem(usdc(500), alice.address);
      await time.increase(THREE_DAYS);

      strategistBefore = await usdcToken.balanceOf(strategist.address);
      await vault.connect(alice).claimRedeem(1);
      strategistFee = (await usdcToken.balanceOf(strategist.address)) - strategistBefore;
      expect(strategistFee).to.equal(0n);
    });

    it("lets a requester cancel before the cooldown elapses and keep their shares", async function () {
      const { strategist, alice, usdcToken, factory } = await deployFixture();
      const vault = await createVault(factory, strategist);
      await depositAs(usdcToken, vault, alice, usdc(1000));

      await vault.connect(alice).requestRedeem(usdc(1000), alice.address);
      expect(await vault.balanceOf(alice.address)).to.equal(0n);

      await vault.connect(alice).cancelRedeemRequest(0);
      expect(await vault.balanceOf(alice.address)).to.equal(usdc(1000));

      await time.increase(THREE_DAYS);
      await expect(vault.connect(alice).claimRedeem(0)).to.be.revertedWith("vault: already settled");
    });

    it("reverts a claim from someone trying to double-claim", async function () {
      const { strategist, alice, usdcToken, factory } = await deployFixture();
      const vault = await createVault(factory, strategist);
      await depositAs(usdcToken, vault, alice, usdc(1000));

      await vault.connect(alice).requestRedeem(usdc(1000), alice.address);
      await time.increase(THREE_DAYS);
      await vault.connect(alice).claimRedeem(0);

      await expect(vault.connect(alice).claimRedeem(0)).to.be.revertedWith("vault: already settled");
    });
  });

  describe("strategist controls", function () {
    it("only the strategist can set keepers, trading authority, or close the vault", async function () {
      const { strategist, alice, factory } = await deployFixture();
      const vault = await createVault(factory, strategist);

      await expect(vault.connect(alice).setKeeper(alice.address, true)).to.be.revertedWith("vault: not strategist");
      await expect(vault.connect(alice).setTradingAuthority(alice.address, true)).to.be.revertedWith(
        "vault: not strategist"
      );
      await expect(vault.connect(alice).closeVault()).to.be.revertedWith("vault: not strategist");

      await expect(vault.connect(strategist).setTradingAuthority(alice.address, true)).to.not.be.reverted;
      await expect(vault.connect(strategist).closeVault()).to.not.be.reverted;
    });

    it("only a keeper can trigger the emergency close-all, and it works even while paused", async function () {
      const { owner, strategist, alice, factory } = await deployFixture();
      const vault = await createVault(factory, strategist);

      await expect(vault.connect(alice).emergencyCloseAll()).to.be.revertedWith("vault: not keeper");

      await factory.connect(owner).setPaused(true);
      await expect(vault.connect(strategist).emergencyCloseAll()).to.not.be.reverted;
    });
  });
});
