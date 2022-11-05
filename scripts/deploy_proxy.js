const { ethers, upgrades } = require("hardhat");

async function main() {
  const ERC1155PresetMinterPauserUpgradeable = await ethers.getContractFactory("ERC1155PresetMinterPauserUpgradeable");
  const erc1155 = await upgrades.deployProxy(ERC1155PresetMinterPauserUpgradeable, ["test"]);
  await erc1155.deployed();
  console.log("ERC1155 deployed at: ", erc1155.address);

  const Proxy = await ethers.getContractFactory("Proxy");
  const proxy = await Proxy.deploy(erc1155.address);
  await proxy.deployed();

  console.log("Proxy deployed at: ", proxy.address);
}

main();