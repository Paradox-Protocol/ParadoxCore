const { ethers, upgrades } = require("hardhat");

// addressess of gnosis multi sigs for contract roles
const multiSigAddress = "0x2bc95003C1f398aDA1eD0BbC9FE569a5489a0bb3";
const gameAdminAddress = "0x44511a60E20E26e4B306AA250F334195B85d32B7";
const adminAddress = "0x4dD35E0b1bE268C6f3A38eb9cACfCB22062b0Bc6";

// address of ERC 20 token contract is using
const usdcAddress = "0x138544DF5e6632c5e9DaaF43C1cCEb084B0DF4fA";

// address of the contract verasigner
const signerAddress = "0x4dD35E0b1bE268C6f3A38eb9cACfCB22062b0Bc6";

// address of the vault
const vaultAddress = "0x4dD35E0b1bE268C6f3A38eb9cACfCB22062b0Bc6";

// KECCAK 256 of Role names that the contract can read
const MULTISIG_ROLE = "0xa5a0b70b385ff7611cd3840916bd08b10829e5bf9e6637cf79dd9a427fc0e2ab"
const GAME_ADMIN_ROLE = "0x9b7946abd96dccbe6cfc6cc2c13300ab429d93e16fa72dc459eeccda73817f08"
const ADMIN_ROLE = "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775"
const DEFAULT_ADMIN_ROLE = "0x1effbbff9c66c5e59634f24fe842750c60d18891155c32dd155fc2d661a4c86d"

async function main() {
  // Get address that is deploying
  const [deployer] = await ethers.getSigners();
  const deployerAddress = deployer.address;

  // DEPLOY PROXY AND CLONE FOR ERC1155 MINTER
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
  const bettingAdmin = await upgrades.deployProxy(BettingAdmin, [usdcAddress, vaultAddress, signerAddress, proxy.address])
  await bettingAdmin.deployed();
  console.log("BettingAdmin deployed to:", bettingAdmin.address);

  // DEPLOY BETTING CONTRACT
  const Betting = await ethers.getContractFactory("BettingV2");
  const betting = await upgrades.deployProxy(Betting, [
    bettingAdmin.address
  ]);
  await betting.deployed();
  console.log("Betting deployed to:", betting.address);

  // UPDATE ROLES
  await bettingAdmin.grantRole(MULTISIG_ROLE, multiSigAddress);
  console.log('MULTISIG_ROLE GRANTED');
  await bettingAdmin.grantRole(GAME_ADMIN_ROLE, gameAdminAddress);
  console.log('GAME_ADMIN_ROLE GRANTED');
  await bettingAdmin.grantRole(ADMIN_ROLE, adminAddress);
  console.log('ADMIN_ROLE GRANTED');

  // SET BETTING ADDRESS
  await bettingAdmin.updateBettingAddress(betting.address);
  console.log('BETTING ADDRESS UPDATED');

  // REVOKE ROLES
  await bettingAdmin.revokeRole(ADMIN_ROLE, deployerAddress);
  console.log('ADMIN_ROLE REVOKED');
  await bettingAdmin.revokeRole(DEFAULT_ADMIN_ROLE, deployerAddress);
  console.log('DEFAULT_ADMIN_ROLE_REVOKED');
}

main();
