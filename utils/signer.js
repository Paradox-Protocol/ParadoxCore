const hre = require("hardhat");

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