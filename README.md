# Paradox Core Smart Contracts

Paradox Core is the central smart contract system of the Paradox Protocol. This system serves as the backbone of the decentralized platform app.betparadox.com

# Technical Overview
 - There are 2 main contracts that should be deployed as part of the Paradox Protocol. 1 is the betting admin contract and the second is the betting contract
   - Betting Admin
     - Contract that handles Creating Pools, and Grading pools.
     - This contract defines 3 roles using OpenZeppelin Access Control
       - Game Admin, this address can create pools and open pools for betting
       - MultiSig role, this address is responsible for entering results, updating the start time of pools, cancelling pools, and approving the results entered by the Game Admin
       - Admin role, this address can change the address of the betting contract, update the address of the signer, and update the ERC 20 token that the betting contract uses
   - Betting Contract
     - Contract that handles placing bets, claiming payouts, and distributing commission
     - Initialized with the address of the Betting Admin and the address of an ERC-20. Once this contract is deployed these addresses cannot be changed. The address of the ERC-20 dictates which token bets are denominated in.

## Further Resources
 - Gitbooks https://paradox-3.gitbook.io/paradox
 - Halborn Audit Report https://6wntz22zcxx4mbdjmzynrdwntczs2fifr7ufxuodv6awgj3c2thq.arweave.net/9Zs861kV78YEaWZw2I7NmLMtFQWP6FvRw6-BYydi1M8

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

What things you need to install the software and how to install them:

- Node.js
- Truffle
- Ganache

```bash
npm install -g truffle
npm install -g ganache-cli

### Installation

1. Clone the repository:
    ```
    git clone https://github.com/Paradox-Protocol/ParadoxCore.git
    ```
2. Navigate to the repository directory:
    ```
    cd ParadoxCore
    ```
3. Install dependencies:
    ```
    npm install
    ```
