const { ethers } = require("hardhat");

// Placeholder deployment script for the Mimic vault factory (Model A).
// USDC_ADDRESS / NADO_ADAPTER_ADDRESS must be filled in once Nado's collateral
// token and on-chain custody contract addresses on Ink are known.
async function main() {
  const [deployer] = await ethers.getSigners();

  const USDC_ADDRESS = process.env.USDC_ADDRESS;
  const NADO_ADAPTER_ADDRESS = process.env.NADO_ADAPTER_ADDRESS;
  const PROTOCOL_FEE_RECIPIENT = process.env.PROTOCOL_FEE_RECIPIENT || deployer.address;

  if (!USDC_ADDRESS || !NADO_ADAPTER_ADDRESS) {
    throw new Error("Set USDC_ADDRESS and NADO_ADAPTER_ADDRESS env vars before deploying");
  }

  const MimicVaultFactory = await ethers.getContractFactory("MimicVaultFactory");
  const factory = await MimicVaultFactory.deploy(
    USDC_ADDRESS,
    NADO_ADAPTER_ADDRESS,
    PROTOCOL_FEE_RECIPIENT,
    deployer.address
  );
  await factory.waitForDeployment();

  console.log("MimicVaultFactory deployed to:", await factory.getAddress());
  console.log("vaultImplementation:", await factory.vaultImplementation());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
