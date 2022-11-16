const hre = require("hardhat");

async function giveEth(address) {
  await network.provider.send("hardhat_setBalance", [
    "address",
    "0xDE0B6B3A7640000",
  ]);
}

async function impersonateAccount(signerAddress) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [signerAddress],
  });
  return await hre.ethers.getSigner(signerAddress)
}

async function stopImpersonatingAccount(signerAddress) {
  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [signerAddress],
  });
  return await hre.ethers.getSigner(signerAddress)
}

exports.impersonateAccount = impersonateAccount;
exports.stopImpersonatingAccount = stopImpersonatingAccount;