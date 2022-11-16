require('@nomiclabs/hardhat-etherscan');
require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-toolbox");

require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: 'localhost',
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      }
    }
  },
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 1337,
      timeout: 10_0000
    },
    rinkeby: {
      url: ``,
      accounts: [process.env.PRIVATE_KEY]
    },
    goerli: {
      url: ``,
      accounts: [process.env.PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: {
      rinkeby: "",
      goerli: ""
    }
  }
};
