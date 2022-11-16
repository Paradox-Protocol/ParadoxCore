const { time } = require("@nomicfoundation/hardhat-network-helpers");

const ROOT = '0x77700005BEA4DE0A78b956517f099260C2CA9a26' // Root Token address

const MULTISIG_ROLE = "0xa5a0b70b385ff7611cd3840916bd08b10829e5bf9e6637cf79dd9a427fc0e2ab"
const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"

// From `deploy.js`, for local
const TEST_DEPLOYER = '0x8A974Aa04c34AC66ac16F2c7112aEDDaDB4F87A1' // Random Address
const BETTING_ADMIN = "0xb4000445b303C95d0046a1a0A51B56bfd0233BA6"
const BETTING = "0xAbB56290f69fb0CA45725b1843851169c8770bD9"


async function deployPool(numberOfTeams, name, duration, teams) {
  const bettingAdmin = await ethers.getContractAt("BettingAdmin", BETTING_ADMIN);
  const betting = await ethers.getContractAt("BettingV2", BETTING);

  // Impersonate
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [TEST_DEPLOYER],
  });
  const deployer = await ethers.getSigner(TEST_DEPLOYER)
  await hre.network.provider.send("hardhat_setBalance", [TEST_DEPLOYER, "0x3635C9ADC5DEA00000"]);

  // Deploy ERC1155
  // const ERC1155PresetMinterPauserUpgradeable = await ethers.getContractFactory("ERC1155PresetMinterPauserUpgradeable", account);
  // const erc1155 = await ERC1155PresetMinterPauserUpgradeable.connect(account).deploy()
  // await erc1155.connect(account).initialize('https://hi.com/')
  // await erc1155.deployed();
  // console.log("ERC-1155 Token deployed to:", erc1155.address);
  // await erc1155.connect(account).grantRole(MINTER_ROLE, betting.address);

  // Create pool
  // const startTime = (await time.latest()); // + DURATION;
  const startTime = 1668578642; 

  const poolId = await bettingAdmin.getTotalPools()
  await bettingAdmin.connect(deployer).createPool(numberOfTeams, name, startTime, duration, teams, "https://app.betparadox.com");
  await bettingAdmin.connect(deployer).startPool(poolId);
  
  console.log(`Pool Id: ${poolId}`);
}


async function bet(account, poolId = 0, team = 0, amount = '10000000000') {
  const root = await ethers.getContractAt("ERC20Upgradeable", ROOT)
  const betting = await ethers.getContractAt("BettingV2", '0xA67Bb84eE14221858d4edAA266C0D109D18685bB');

  await root.connect(account).approve(betting.address, '100000000000000000');
  await betting.connect(account).placeBet(poolId, team, amount)
}

exports.deployPool = deployPool;