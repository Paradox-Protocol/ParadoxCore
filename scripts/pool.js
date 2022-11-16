
const ADMIN = '0x9be7A4A5b0da73770E5604A72c5861d7f00543E3' // Random Address
const ROOT = '0x3d5965EB520E53CC1A6AEe3A44E5c1De406E028F' // Root Token address
const MULTISIG_ROLE = "0xa5a0b70b385ff7611cd3840916bd08b10829e5bf9e6637cf79dd9a427fc0e2ab"
const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"


async function deployPool(numberOfTeams, name, duration, teams) {
  const bettingAdmin = await ethers.getContractAt("BettingAdmin", '0x23dBDD2FD39b1c24CBDc89B2aC03A4e345F69a0E');
  const betting = await ethers.getContractAt("BettingV2", '0x1edEc0767B30ECFb3C4340B1c7d196fC2aB9d33d');
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [ADMIN],
  });
  const account = await ethers.getSigner(ADMIN)
  await hre.network.provider.send("hardhat_setBalance", [ADMIN, "0x3635C9ADC5DEA00000"]);

  const ERC1155PresetMinterPauserUpgradeable = await ethers.getContractFactory("ERC1155PresetMinterPauserUpgradeable", account);
  const erc1155 = await ERC1155PresetMinterPauserUpgradeable.connect(account).deploy()
  await erc1155.connect(account).initialize('https://hi.com/')
  await erc1155.deployed();
  console.log("ERC-1155 Token deployed to:", erc1155.address);

  await erc1155.connect(account).grantRole(MINTER_ROLE, betting.address);

  const startTime = (await time.latest()) + DURATION;

  const poolId = await bettingAdmin.getTotalPools()
  await bettingAdmin.connect(account).createPool(numberOfTeams, name, startTime, duration, erc1155.address, teams);
  await bettingAdmin.connect(account).startPool(poolId);
  console.log(`Pool Id: ${poolId}`);
}

async function bet(account, poolId = 0, team = 0, amount = '10000000000') {
  const root = await ethers.getContractAt("ERC20Upgradeable", ROOT)
  const betting = await ethers.getContractAt("BettingV2", '0xA67Bb84eE14221858d4edAA266C0D109D18685bB');

  await root.connect(account).approve(betting.address, '100000000000000000');
  await betting.connect(account).placeBet(poolId, team, amount)
}