const { ethers, upgrades } = require("hardhat");
const { mintEth } = require("../utils/mint");
const { impersonateAccount, stopImpersonatingAccount } = require("../utils/signer");

/**
 * Deploy betting & admin.
 * For local deployments, use `impersonate = true`.
 *
 * @param {*} impersonate
 * @param {*} usdcAddress
 * @param {*} vaultAddress
 * @param {*} signerAddress
 */
async function main(
    impersonate = false,
    erc20Address = "0x07865c6e87b9f70255377e024ace6630c1eaa37f", // could be any erc20
) {
  // Get address that is deploying
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;

  const ERC1155PresetMinterPauser = await ethers.getContractFactory("ERC1155PresetMinterPauser");
  const erc1155 = await ERC1155PresetMinterPauser.deploy("Paradox Minter");
  await erc1155.deployed();
  console.log("ERC1155 deployed at: ", erc1155.address);

  const Proxy = await ethers.getContractFactory("Proxy");
  const proxy = await Proxy.deploy(erc1155.address);
  await proxy.deployed();

  console.log("Proxy deployed at: ", proxy.address);

  // DEPLOY ADMIN CONTRACT
  const BettingAdmin = await ethers.getContractFactory("BettingAdmin");
  const bettingAdmin = await upgrades.deployProxy(BettingAdmin, [deployerAddress, deployerAddress, deployerAddress, proxy.address])
  await bettingAdmin.deployed();
  console.log("BettingAdmin deployed to:", bettingAdmin.address);

  // DEPLOY BETTING CONTRACT
  const Betting = await ethers.getContractFactory("BettingV2");
  const betting = await upgrades.deployProxy(Betting, [
    bettingAdmin.address
  ]);
  await betting.deployed();

  console.log("BettingAdmin deployed to:", bettingAdmin.address);
  console.log("Deployed by:", await bettingAdmin.signer.getAddress());
  console.log("");
  if (impersonate === true) {
    console.log("Impersonating signer to update betting address.")
    const signer = await impersonateAccount(deployerAddress)
    await mintEth(deployerAddress)
    await bettingAdmin.connect(signer).updateBettingAddress(betting.address)
    await stopImpersonatingAccount(deployerAddress)
  } else {
    await bettingAdmin.updateBettingAddress(betting.address)
  }

  console.log("Updated betting address to:", betting.address)
}

exports.main = main;
