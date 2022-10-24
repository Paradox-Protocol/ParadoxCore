// scripts/create-box.js
const { BigNumber } = require("ethers");
const { ethers, upgrades } = require("hardhat");

async function main() {
  const BettingAdmin = await ethers.getContractFactory("BettingAdmin");
  const usdcAddress = "0x07865c6e87b9f70255377e024ace6630c1eaa37f";
  const vaultAddress = "0x3ea73aC7F9120407E14Ad6597A0BD610814406c8";
  const signerAddress = "0x3ea73aC7F9120407E14Ad6597A0BD610814406c8";
  const bettingAdmin = await upgrades.deployProxy(BettingAdmin, [
    usdcAddress, vaultAddress, signerAddress
  ]);
  await bettingAdmin.deployed();
  console.log("BettingAdmin deployed to:", bettingAdmin.address);

  const Betting = await ethers.getContractFactory("BettingV2");
  const betting = await upgrades.deployProxy(Betting, [
    bettingAdmin.address
  ]);
  await betting.deployed();
  console.log("Betting deployed to:", betting.address);

  await bettingAdmin.grantRole("0xa5a0b70b385ff7611cd3840916bd08b10829e5bf9e6637cf79dd9a427fc0e2ab", signerAddress);
  await bettingAdmin.updateBettingAddress(betting.address);
}

main();
