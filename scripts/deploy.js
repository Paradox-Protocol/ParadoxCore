const { ethers, upgrades } = require("hardhat");
const { mintEth } = require("../utils/mint");
const { impersonateAccount, stopImpersonatingAccount } = require("../utils/signer");

//// ADDRESSES
const testDeployer = "0x8A974Aa04c34AC66ac16F2c7112aEDDaDB4F87A1";

// addressess of gnosis multi sigs for contract roles
const multiSigAddress = "0x2bc95003C1f398aDA1eD0BbC9FE569a5489a0bb3";
const gameAdminAddress = "0x44511a60E20E26e4B306AA250F334195B85d32B7";
const adminAddress = "0x4dD35E0b1bE268C6f3A38eb9cACfCB22062b0Bc6";

// address of ERC 20 token contract is using
const usdcAddress = "0x07865c6E87B9F70255377e024ace6630C1Eaa37F";

// address of the contract verasigner
const signerAddress = "0x4dD35E0b1bE268C6f3A38eb9cACfCB22062b0Bc6";

// address of the vault
const vaultAddress = "0x3BB55aAfb1D3b8e8583cdA5935F0610e652feE2e";

//// ROLES
const MULTISIG_ROLE = "0xa5a0b70b385ff7611cd3840916bd08b10829e5bf9e6637cf79dd9a427fc0e2ab"
const GAME_ADMIN_ROLE = "0x9b7946abd96dccbe6cfc6cc2c13300ab429d93e16fa72dc459eeccda73817f08"
const ADMIN_ROLE = "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775"
const DEFAULT_ADMIN_ROLE = "0x1effbbff9c66c5e59634f24fe842750c60d18891155c32dd155fc2d661a4c86d"

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
  erc20Address
) {
  if (!erc20Address) throw new Error("Specify an erc20Address to deploy");

  // Get address that is deploying
  let deployer;
  let deployerAddress;
  if (impersonate) {
    deployerAddress = testDeployer;
    deployer = await impersonateAccount(deployerAddress);
    await network.provider.send("hardhat_setBalance", [
      deployerAddress,
      "0xDE0B6B3A7640000",
    ]);
  } else {
    [deployer] = await ethers.getSigners();
    deployerAddress = deployer.address;
  }

  console.log("Deploying Paradox admin for erc20Address", erc20Address);
  console.log("Deployer is", deployerAddress, "\n");


  // DEPLOY PROXY AND CLONE FOR ERC1155 MINTER
  const ERC1155PresetMinterPauser = await ethers.getContractFactory("ERC1155PresetMinterPauser");
  const erc1155 = await ERC1155PresetMinterPauser.connect(deployer).deploy("Paradox Minter");
  await erc1155.deployed();
  console.log("ERC1155 deployed at: ", erc1155.address);

  const Proxy = await ethers.getContractFactory("Proxy");
  const proxy = await Proxy.connect(deployer).deploy(erc1155.address);
  await proxy.deployed();
  console.log("Proxy deployed at: ", proxy.address);

  // DEPLOY ADMIN CONTRACT
  const BettingAdmin = await ethers.getContractFactory("BettingAdmin");
  const bettingAdmin = await upgrades.deployProxy(BettingAdmin.connect(deployer), [
    erc20Address, // token
    deployerAddress, // vaultAddress, // vault
    deployerAddress, // signerAddress, // signer
    proxy.address
  ])
  await bettingAdmin.deployed();

  // DEPLOY BETTING CONTRACT
  const Betting = await ethers.getContractFactory("BettingV2");
  const betting = await upgrades.deployProxy(Betting, [
    bettingAdmin.address
  ]);
  await betting.deployed();

  // UPDATE ROLES
  await bettingAdmin.grantRole(MULTISIG_ROLE, deployerAddress);
  console.log('MULTISIG_ROLE GRANTED');
  await bettingAdmin.grantRole(GAME_ADMIN_ROLE, deployerAddress);
  console.log('GAME_ADMIN_ROLE GRANTED');
  await bettingAdmin.grantRole(ADMIN_ROLE, deployerAddress);
  console.log('ADMIN_ROLE GRANTED');

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
