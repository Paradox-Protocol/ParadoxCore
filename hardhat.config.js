require('@nomiclabs/hardhat-etherscan');
require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
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
    rinkeby: {
      url: `https://goerli.infura.io/v3/fc70825df4b84964bba9cc957c4fb8b4`,
      accounts: [`b3dbc6ad5994eada7800719634bf273f6de871796906a98133cd4f1eba40b8f3`]
    },
    goerli: {
      url: `https://goerli.infura.io/v3/fc70825df4b84964bba9cc957c4fb8b4`,
      accounts: [`b3dbc6ad5994eada7800719634bf273f6de871796906a98133cd4f1eba40b8f3`]
    }
  },
  etherscan: {
    apiKey: {
      rinkeby: "",
      goerli: "HEYY527RC5PFIHJR56UNASIDZNMCCF5MFG"
    }
  }
};
