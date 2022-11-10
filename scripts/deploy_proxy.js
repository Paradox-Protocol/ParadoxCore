const { ethers, upgrades } = require("hardhat");

async function main() {
  const ERC1155PresetMinterPauser = await ethers.getContractFactory("ERC1155PresetMinterPauser");
  const erc1155 = await ERC1155PresetMinterPauser.deploy("test");
  await erc1155.deployed();
  console.log("ERC1155 deployed at: ", erc1155.address);

  const Proxy = await ethers.getContractFactory("Proxy");
  const proxy = await Proxy.deploy(erc1155.address);
  await proxy.deployed();

  console.log("Proxy deployed at: ", proxy.address);
}

main();