const hre = require("hardhat");

async function setBalance(address, amountHex = "0x3635C9ADC5DEA00000") {
  await hre.network.provider.send("hardhat_setBalance", [address, amountHex]);
}

exports.mintEth = setBalance