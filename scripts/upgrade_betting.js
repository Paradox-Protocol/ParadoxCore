const { ethers, upgrades } = require("hardhat");

async function main() {
  const BettingV2 = await ethers.getContractFactory("BettingV2");
  const betting = await upgrades.upgradeProxy(process.env.IMPL_ADDRESS, BettingV2);
  console.log("Betting upgraded");
}

main();