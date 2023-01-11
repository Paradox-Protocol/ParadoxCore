require('@nomiclabs/hardhat-etherscan');
require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {  
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    rinkeby: {
      url: ``,
      accounts: [`${process.env.PRIVATE_KEY}`]
    },
    goerli: {
      url: ``,
      accounts: [`${process.env.PRIVATE_KEY}`]
    }
  },
  etherscan: {
    apiKey: {
      rinkeby: "",
      goerli: ""
    }
  },
  gasReporter: {
    enabled: true
  }
};
