const { ethers, upgrades } = require("hardhat");

async function main() {
  const BettingAdmin = await ethers.getContractFactory("BettingAdmin");
  const betting = await upgrades.upgradeProxy(process.env.IMPL_ADDRESS, BettingAdmin);
  console.log("Betting upgraded");
}

main();