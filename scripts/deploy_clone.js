const { ethers, upgrades } = require("hardhat");
const { formatBytes32String, getAddress } = ethers.utils

async function main() {
  const Proxy = await ethers.getContractFactory("Proxy");
  const proxy = Proxy.attach("0xdF70824a6c0c8Ca85D53C317468CcC1FF36a35A5");

  const salt = formatBytes32String('3');
  const cloneAddress = await proxy.getCloneAddress(salt)
  const tx = await proxy.createClone(salt);
  await tx.wait();

  console.log("Clone deployed at: ", cloneAddress);

  const ERC1155 = await ethers.getContractFactory("ERC1155PresetMinterPauserUpgradeable");
  const erc1155 = ERC1155.attach(cloneAddress);
  const tx2 = await erc1155.initialize("http://hello.com");
  await tx.wait();

  console.log("Clone initialized");

}

main();