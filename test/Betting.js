const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
  const { expect } = require("chai");
const { utils } = require("ethers");
  const { ethers, upgrades } = require("hardhat");

  describe("Betting", function () {
    const NUMBER_OF_TEAMS = 3;
    const POOL_ID = 0;
    const POOL_ID_2 = 1;
    const POOL_ID_3 = 2;
    const PoolStatus = {
      Created: 0,
      Running: 1,
      Over: 2,
      Expired: 3,
      Closed: 4,  
    };

    function convertToWei(amount) {
      return (amount * 1000000000).toFixed(0) + ""
    }

    function toString(amount) {
      return (amount.toString())
    }
    
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshopt in every test.
    async function deployInitializeFixture() {
      // Contracts are deployed using the first signer/account by default
      const startTime = (await time.latest()) + 86400;
      const duration = startTime + 86400;
      const eventName = "US Open";
      const uri = "test";
      const teams = ["Team1", "Team2", "Team3"];
      const [owner, user, user2, user3] = await ethers.getSigners();
  
      const USDC = await ethers.getContractFactory("ERC20MockUpgradeable");
      const u = await upgrades.deployProxy(USDC);
      const usdc = await u.deployed();

      const VAULT = await ethers.getContractFactory("ERC20MockUpgradeable");
      const v = await upgrades.deployProxy(VAULT);
      const vault = await v.deployed();

      const ERC1155PresetMinterPauser = await ethers.getContractFactory("ERC1155PresetMinterPauser");
      const erc1155 = await ERC1155PresetMinterPauser.deploy("test");
      await erc1155.deployed();

      const Proxy = await ethers.getContractFactory("Proxy");
      const proxy = await Proxy.deploy(erc1155.address);
      await proxy.deployed();
      
      const BettingAdmin = await ethers.getContractFactory("BettingAdmin");
      const bAdmin = await upgrades.deployProxy(BettingAdmin, [
        usdc.address, vault.address, owner.address, proxy.address
      ]);
      const bettingAdmin = await bAdmin.deployed();

      const Betting = await ethers.getContractFactory("BettingV2");
      const b = await upgrades.deployProxy(Betting, [
        bAdmin.address
      ]);
      const betting = await b.deployed(); 
      
      await bettingAdmin.grantRole(bettingAdmin.MULTISIG_ROLE(), owner.address);
      await bettingAdmin.grantRole(bettingAdmin.GAME_ADMIN_ROLE(), owner.address);
      await bettingAdmin.grantRole(bettingAdmin.ADMIN_ROLE(), owner.address);
      await bettingAdmin.updateBettingAddress(betting.address);
      
      await usdc.connect(user).approve(betting.address, convertToWei(900))
      await usdc.connect(user2).approve(betting.address, convertToWei(900))
      await usdc.connect(user3).approve(betting.address, convertToWei(900))
      
      await usdc.connect(user).mint(user.address, convertToWei(900))
      await usdc.connect(user2).mint(user2.address, convertToWei(900))
      await usdc.connect(user3).mint(user3.address, convertToWei(900))

      return { betting , bettingAdmin, usdc, vault, erc1155, owner, user, user2, user3, startTime, duration, eventName, teams, uri};
    }

    async function initializeERC1155(erc1155Address, user, user2, user3, bettingAddress) {
      const ERC1155 = await ethers.getContractFactory("ERC1155PresetMinterPauser");
      const erc1155 = ERC1155.attach(erc1155Address);

      await erc1155.connect(user).setApprovalForAll(bettingAddress, true);
      await erc1155.connect(user2).setApprovalForAll(bettingAddress, true);
      await erc1155.connect(user3).setApprovalForAll(bettingAddress, true);
    }

    describe("PlaceBet", function () {
      it("Should allow user to place bet", async function () {
        const { bettingAdmin, betting, eventName, teams, uri, startTime, duration, user, user2, user3, usdc } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p = await bettingAdmin.getPool(POOL_ID);
        await initializeERC1155(_p.mintContract, user, user2, user3, betting.address);

        await bettingAdmin.startPool(POOL_ID);

        await betting.connect(user).placeBet(POOL_ID, 1, convertToWei(100));

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.totalAmount).to.equal(convertToWei(100));
        expect(pool.totalBets).to.equal(1);

        const bet =  await betting.bets(0);
        expect(bet.poolId).to.equal(POOL_ID);
        expect(bet.teamId).to.equal(1);
        expect(bet.amount).to.equal(convertToWei(100));
        expect(bet.player).to.equal(user.address);

        expect(await usdc.balanceOf(betting.address)).to.equal(
          convertToWei(100)
        );

        const userBets = await betting.getUserBets(user.address, POOL_ID);
        expect(userBets[0]).to.equal(0);

        const ERC1155 = await ethers.getContractFactory("ERC1155PresetMinterPauser");
        const erc1155 = ERC1155.attach(_p.mintContract);
        expect(await erc1155.totalSupply(0)).to.equal(0);
        expect(await erc1155.totalSupply(1)).to.equal(convertToWei(100));
        expect(await erc1155.totalSupply(2)).to.equal(0);
      });
    });

    describe("ClaimWinning", function () {
      it("Should allow user to claim winnings", async function () {
        const { bettingAdmin, betting, eventName, teams, uri, startTime, duration, user, user2, user3, usdc } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p = await bettingAdmin.getPool(POOL_ID);
        await initializeERC1155(_p.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(POOL_ID);

        await betting.connect(user).placeBet(POOL_ID, 1, convertToWei(300));
        await betting.connect(user2).placeBet(POOL_ID, 0, convertToWei(200));
        await betting.connect(user3).placeBet(POOL_ID, 2, convertToWei(100));
        await betting.connect(user).placeBet(POOL_ID, 0, convertToWei(100));

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.totalAmount).to.equal(convertToWei(700));
        expect(pool.totalBets).to.equal(4);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(704));

        const userBets = await betting.getUserBets(user.address, POOL_ID);
        expect(userBets[0]).to.equal(0);
        expect(userBets[1]).to.equal(3);

        const ERC1155 = await ethers.getContractFactory("ERC1155PresetMinterPauser");
        const erc1155 = ERC1155.attach(_p.mintContract);

        expect(await erc1155.totalSupply(0)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(1)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(2)).to.equal(convertToWei(100));

        await time.increaseTo(startTime);
        await bettingAdmin.closePool(POOL_ID);
        await bettingAdmin.gradePool(POOL_ID, 1);

        expect(await betting.totalPayouts(user.address, POOL_ID)).to.equal(convertToWei(700));
        expect(await betting.totalPayouts(user2.address, POOL_ID)).to.equal(0);
        expect(await betting.totalPayouts(user3.address, POOL_ID)).to.equal(0);

        await betting.connect(user).claimPayment(POOL_ID);

        expect(await betting.totalCommissions(user.address, POOL_ID)).to.equal(convertToWei(3.1));
        expect(await betting.totalCommissions(user2.address, POOL_ID)).to.equal(convertToWei(0.733333333));
        expect(await betting.totalCommissions(user3.address, POOL_ID)).to.equal(convertToWei(0.166666666));

        await betting.connect(user).claimCommission(POOL_ID);
        await betting.connect(user2).claimCommission(POOL_ID);
        await betting.connect(user3).claimCommission(POOL_ID);

        expect(await usdc.balanceOf(betting.address)).to.equal(1);
      });

      it("Should allow multiple users to claim winnings ", async function () {
        const { bettingAdmin, betting, usdc, eventName, teams, uri, startTime, duration, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p = await bettingAdmin.getPool(POOL_ID);
        await initializeERC1155(_p.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(POOL_ID);

        await betting.connect(user).placeBet(POOL_ID, 1, convertToWei(300));
        await betting.connect(user2).placeBet(POOL_ID, 0, convertToWei(200));
        await betting.connect(user3).placeBet(POOL_ID, 2, convertToWei(100));
        await betting.connect(user).placeBet(POOL_ID, 0, convertToWei(100));

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.totalAmount).to.equal(convertToWei(700));
        expect(pool.totalBets).to.equal(4);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(704));

        const userBets = await betting.getUserBets(user.address, POOL_ID);
        expect(userBets[0]).to.equal(0);
        expect(userBets[1]).to.equal(3);

        const ERC1155 = await ethers.getContractFactory("ERC1155PresetMinterPauser");
        const erc1155 = ERC1155.attach(_p.mintContract);

        expect(await erc1155.totalSupply(0)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(1)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(2)).to.equal(convertToWei(100));

        await time.increaseTo(startTime);
        await bettingAdmin.closePool(POOL_ID);
        await bettingAdmin.gradePool(POOL_ID, 0);

        expect(await betting.totalPayouts(user.address, POOL_ID)).to.equal(convertToWei(toString(233.333333333)));
        expect(await betting.totalPayouts(user2.address, POOL_ID)).to.equal(convertToWei(toString(466.666666666)));
        expect(await betting.totalPayouts(user3.address, POOL_ID)).to.equal(0);

        await betting.connect(user).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(470.666666667));

        await betting.connect(user2).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(4.000000001));
      });

      it("Should allow users to claim winnings in case of tie", async function () {
        const { bettingAdmin, betting, usdc, eventName, teams, uri, startTime, duration, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p = await bettingAdmin.getPool(POOL_ID);
        await initializeERC1155(_p.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(POOL_ID);

        await betting.connect(user).placeBet(POOL_ID, 1, convertToWei(300));
        await betting.connect(user2).placeBet(POOL_ID, 0, convertToWei(200));
        await betting.connect(user3).placeBet(POOL_ID, 2, convertToWei(100));
        await betting.connect(user).placeBet(POOL_ID, 0, convertToWei(100));

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.totalAmount).to.equal(convertToWei(700));
        expect(pool.totalBets).to.equal(4);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(704));

        const userBets = await betting.getUserBets(user.address, POOL_ID);
        expect(userBets[0]).to.equal(0);
        expect(userBets[1]).to.equal(3);

        const ERC1155 = await ethers.getContractFactory("ERC1155PresetMinterPauser");
        const erc1155 = ERC1155.attach(_p.mintContract);
        expect(await erc1155.totalSupply(0)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(1)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(2)).to.equal(convertToWei(100));

        await time.increaseTo(startTime);
        await bettingAdmin.closePool(POOL_ID);
        await bettingAdmin.markPoolTie(POOL_ID, [0, 1]);

        expect(await betting.totalPayouts(user.address, POOL_ID)).to.equal(convertToWei(toString(466.666666666)));
        expect(await betting.totalPayouts(user2.address, POOL_ID)).to.equal(convertToWei(toString(233.333333333)));
        expect(await betting.totalPayouts(user3.address, POOL_ID)).to.equal(0);

        await betting.connect(user2).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(470.666666667));

        await betting.connect(user).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(4.000000001));
      });

      it("Should allow users to claim winnings in case of tie - 2", async function () {
        const { bettingAdmin, betting, usdc, eventName, teams, uri, startTime, duration, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        const teams2 = [...teams];
        teams2.push("xyz");

        await bettingAdmin.createPool(NUMBER_OF_TEAMS + 1, eventName, startTime, duration, teams2, uri);
        const _p = await bettingAdmin.getPool(POOL_ID);
        await initializeERC1155(_p.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(POOL_ID);

        await betting.connect(user).placeBet(POOL_ID, 0, convertToWei(2));
        await betting.connect(user2).placeBet(POOL_ID, 1, convertToWei(3));
        await betting.connect(user2).placeBet(POOL_ID, 2, convertToWei(4));
        await betting.connect(user3).placeBet(POOL_ID, 3, convertToWei(5));
        await betting.connect(user).placeBet(POOL_ID, 3, convertToWei(10));

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.totalAmount).to.equal(convertToWei(24));
        expect(pool.totalBets).to.equal(5);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(24.22));

        const userBets = await betting.getUserBets(user.address, POOL_ID);
        expect(userBets[0]).to.equal(0);
        expect(userBets[1]).to.equal(4);

        const ERC1155 = await ethers.getContractFactory("ERC1155PresetMinterPauser");
        const erc1155 = ERC1155.attach(_p.mintContract);
        expect(await erc1155.totalSupply(0)).to.equal(convertToWei(2));
        expect(await erc1155.totalSupply(1)).to.equal(convertToWei(3));
        expect(await erc1155.totalSupply(2)).to.equal(convertToWei(4));
        expect(await erc1155.totalSupply(3)).to.equal(convertToWei(15));

        await time.increaseTo(startTime);
        await bettingAdmin.closePool(POOL_ID);
        await bettingAdmin.markPoolTie(POOL_ID, [2, 3]);

        expect(await betting.totalPayouts(user.address, POOL_ID)).to.equal(convertToWei(toString(11.666666666)));
        expect(await betting.totalPayouts(user2.address, POOL_ID)).to.equal(convertToWei(toString(6.5)));
        expect(await betting.totalPayouts(user3.address, POOL_ID)).to.equal(convertToWei(toString(5.833333333)));

        await betting.connect(user2).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(17.72));

        await betting.connect(user).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(6.053333334));

        await betting.connect(user3).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(0.220000001));
      });

      it("Should allow user to claim winnings in batch", async function () {
        const { bettingAdmin, betting, usdc, eventName, teams, uri, startTime, duration, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p = await bettingAdmin.getPool(POOL_ID);
        await initializeERC1155(_p.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(POOL_ID);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p2 = await bettingAdmin.getPool(POOL_ID_2);
        await initializeERC1155(_p2.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(POOL_ID_2);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p3 = await bettingAdmin.getPool(POOL_ID_3);
        await initializeERC1155(_p3.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(POOL_ID_3);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p4 = await bettingAdmin.getPool(3);
        await initializeERC1155(_p4.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(3);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p5 = await bettingAdmin.getPool(4);
        await initializeERC1155(_p5.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(4);

        await betting.connect(user).placeBet(POOL_ID, 1, convertToWei(300));
        await betting.connect(user2).placeBet(POOL_ID, 0, convertToWei(200));
        await betting.connect(user).placeBet(POOL_ID_2, 0, convertToWei(100));
        await betting.connect(user3).placeBet(POOL_ID, 2, convertToWei(100));
        await betting.connect(user).placeBet(POOL_ID, 0, convertToWei(100));
        await betting.connect(user3).placeBet(POOL_ID_2, 2, convertToWei(50));
        await betting.connect(user2).placeBet(POOL_ID_2, 0, convertToWei(50));
        await betting.connect(user).placeBet(POOL_ID_3, 0, convertToWei(50));
        await betting.connect(user2).placeBet(POOL_ID_3, 2, convertToWei(50));
        await betting.connect(user3).placeBet(POOL_ID_3, 1, convertToWei(50));
        await betting.connect(user).placeBet(3, 0, convertToWei(50));
        await betting.connect(user2).placeBet(3, 2, convertToWei(50));
        await betting.connect(user3).placeBet(3, 1, convertToWei(50));
        await betting.connect(user).placeBet(4, 0, convertToWei(50));
        await betting.connect(user2).placeBet(4, 2, convertToWei(50));
        await betting.connect(user3).placeBet(4, 1, convertToWei(50));

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.totalAmount).to.equal(convertToWei(700));
        expect(pool.totalBets).to.equal(4);

        // expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(905));

        const userBets = await betting.getUserBets(user.address, POOL_ID);
        expect(userBets[0]).to.equal(0);
        expect(userBets[1]).to.equal(4);

        const ERC1155 = await ethers.getContractFactory("ERC1155PresetMinterPauser");
        const erc1155 = ERC1155.attach(_p.mintContract);

        expect(await erc1155.totalSupply(0)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(1)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(2)).to.equal(convertToWei(100));

        await time.increaseTo(startTime);
        await bettingAdmin.closePool(POOL_ID);
        await bettingAdmin.gradePool(POOL_ID, 0);
        await bettingAdmin.closePool(POOL_ID_2);
        await bettingAdmin.gradePool(POOL_ID_2, 0);
        await bettingAdmin.closePool(POOL_ID_3);
        await bettingAdmin.gradePool(POOL_ID_3, 0);
        await bettingAdmin.closePool(3);
        await bettingAdmin.gradePool(3, 0);
        await bettingAdmin.closePool(4);
        await bettingAdmin.gradePool(4, 0);

        expect(await betting.totalPayouts(user.address, POOL_ID)).to.equal(convertToWei(toString(233.333333333)));
        expect(await betting.totalPayouts(user2.address, POOL_ID)).to.equal(convertToWei(toString(466.666666666)));
        expect(await betting.totalPayouts(user3.address, POOL_ID)).to.equal(0);

        console.log(convertToWei(toString(133.333333333), convertToWei(133.333333333)))
        expect(await betting.totalPayouts(user.address, POOL_ID_2)).to.equal(convertToWei(toString(133.333333333)));
        expect(await betting.totalPayouts(user2.address, POOL_ID_2)).to.equal(convertToWei(toString(66.666666666)));
        expect(await betting.totalPayouts(user3.address, POOL_ID_2)).to.equal(0);

        await betting.connect(user).claimPaymentBatch([POOL_ID, 3, POOL_ID_2, POOL_ID_3, 4]);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(541.333333334));

        await betting.connect(user2).claimPaymentBatch([POOL_ID, POOL_ID_2]);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(8.000000002));
      });
  
    });

    describe("ClaimRefund", function () {
      it("Should allow user to claim refunds", async function () {
        const { bettingAdmin, betting, usdc, eventName, teams, uri, startTime, duration, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p = await bettingAdmin.getPool(POOL_ID);
        await initializeERC1155(_p.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(POOL_ID);

        await betting.connect(user).placeBet(POOL_ID, 1, convertToWei(300));
        await betting.connect(user2).placeBet(POOL_ID, 0, convertToWei(200));
        await betting.connect(user3).placeBet(POOL_ID, 2, convertToWei(100));
        await betting.connect(user).placeBet(POOL_ID, 0, convertToWei(100));

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.totalAmount).to.equal(convertToWei(700));
        expect(pool.totalBets).to.equal(4);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(704));

        await bettingAdmin.cancelPool(POOL_ID);

        expect(await betting.totalRefunds(user.address, POOL_ID)).to.equal(convertToWei(401));
        expect(await betting.totalRefunds(user2.address, POOL_ID)).to.equal(convertToWei(202));
        expect(await betting.totalRefunds(user3.address, POOL_ID)).to.equal(convertToWei(101));

        await betting.connect(user).claimRefund(POOL_ID);
        await betting.connect(user2).claimRefund(POOL_ID);
        await betting.connect(user3).claimRefund(POOL_ID);

        expect(await usdc.balanceOf(betting.address)).to.equal(0);
      });
  
    });

    describe("ClaimCommission", function () {
      it("Should allow user to claim commission", async function () {
        const { bettingAdmin, betting, usdc, eventName, teams, uri, startTime, duration, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p = await bettingAdmin.getPool(POOL_ID);
        await initializeERC1155(_p.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(POOL_ID);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p2 = await bettingAdmin.getPool(POOL_ID_2);
        await initializeERC1155(_p2.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(1);

        await betting.connect(user).placeBet(POOL_ID, 1, convertToWei(100));
        await betting.connect(user2).placeBet(POOL_ID_2, 0, convertToWei(100));
        await betting.connect(user2).placeBet(POOL_ID, 0, convertToWei(100));
        await betting.connect(user3).placeBet(POOL_ID_2, 2, convertToWei(100));
        await betting.connect(user3).placeBet(POOL_ID, 2, convertToWei(100));
        await betting.connect(user2).placeBet(POOL_ID_2, 1, convertToWei(100));

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.totalAmount).to.equal(convertToWei(300));
        expect(pool.totalBets).to.equal(3);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(604));

        await time.increaseTo(startTime);
        await bettingAdmin.closePool(POOL_ID);
        await bettingAdmin.closePool(POOL_ID_2);
        await bettingAdmin.gradePool(POOL_ID, 1);
        await bettingAdmin.gradePool(POOL_ID_2, 2);

        // Payouts and commissions for POOL 1
        expect(await betting.totalCommissions(user.address, POOL_ID)).to.equal(convertToWei(1.5));
        expect(await betting.totalCommissions(user2.address, POOL_ID)).to.equal(convertToWei(0.5));
        expect(await betting.totalCommissions(user3.address, POOL_ID)).to.equal(0);

        await betting.connect(user).claimCommission(POOL_ID);
        await betting.connect(user2).claimCommission(POOL_ID);
        await expect(betting.connect(user3).claimCommission(POOL_ID)).to.be.revertedWith(
          "Betting: No commission to claim"
        );

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(602));

        expect(await betting.totalPayouts(user.address, POOL_ID)).to.equal(convertToWei(300));
        expect(await betting.totalPayouts(user2.address, POOL_ID)).to.equal(0);
        expect(await betting.totalPayouts(user3.address, POOL_ID)).to.equal(0);

        await betting.connect(user).claimPayment(POOL_ID);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(302));

        // Payouts and commissions for POOL 2
        expect(await betting.totalCommissions(user.address, POOL_ID_2)).to.equal(0);
        expect(await betting.totalCommissions(user2.address, POOL_ID_2)).to.equal(convertToWei(1.5));
        expect(await betting.totalCommissions(user3.address, POOL_ID_2)).to.equal(convertToWei(0.5));

        await expect(betting.connect(user).claimCommission(POOL_ID_2)).to.be.revertedWith(
          "Betting: No commission to claim"
        );
        await betting.connect(user2).claimCommission(POOL_ID_2);
        await betting.connect(user3).claimCommission(POOL_ID_2);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(300));

        expect(await betting.totalPayouts(user.address, POOL_ID_2)).to.equal(0);
        expect(await betting.totalPayouts(user2.address, POOL_ID_2)).to.equal(0);
        expect(await betting.totalPayouts(user3.address, POOL_ID_2)).to.equal(convertToWei(300));

        await betting.connect(user3).claimPayment(POOL_ID_2);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(0));
      });

      it("Should allow user to claim commission by signature", async function () {
        const { bettingAdmin, betting, usdc, eventName, teams, uri, startTime, duration, owner, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p = await bettingAdmin.getPool(POOL_ID);
        await initializeERC1155(_p.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(POOL_ID);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p2 = await bettingAdmin.getPool(POOL_ID_2);
        await initializeERC1155(_p2.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(1);

        await betting.connect(user).placeBet(POOL_ID, 1, convertToWei(100));
        await betting.connect(user2).placeBet(POOL_ID_2, 0, convertToWei(100));
        await betting.connect(user2).placeBet(POOL_ID, 0, convertToWei(100));
        await betting.connect(user3).placeBet(POOL_ID_2, 2, convertToWei(100));
        await betting.connect(user3).placeBet(POOL_ID, 2, convertToWei(100));
        await betting.connect(user2).placeBet(POOL_ID_2, 1, convertToWei(100));

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.totalAmount).to.equal(convertToWei(300));
        expect(pool.totalBets).to.equal(3);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(604));

        await time.increaseTo(startTime);
        await bettingAdmin.closePool(POOL_ID);
        await bettingAdmin.closePool(POOL_ID_2);
        await bettingAdmin.gradePool(POOL_ID, 1);
        await bettingAdmin.gradePool(POOL_ID_2, 2);

        // Payouts and commissions for POOL 1
        expect(await betting.totalCommissions(user.address, POOL_ID)).to.equal(convertToWei(1.5));
        expect(await betting.totalCommissions(user2.address, POOL_ID)).to.equal(convertToWei(0.5));
        expect(await betting.totalCommissions(user3.address, POOL_ID)).to.equal(0);

        const commission1 = betting.totalCommissions(user.address, POOL_ID);
        const commission2 = betting.totalCommissions(user2.address, POOL_ID);
        const commission3 = betting.totalCommissions(user3.address, POOL_ID);

        const block = 40;
        const msgHash1 = await betting.getMessageHash(user.address, POOL_ID, commission1, block);
        const msgHash2 = await betting.getMessageHash(user2.address, POOL_ID, commission2, block);
        const msgHash3 = await betting.getMessageHash(user3.address, POOL_ID, commission3, block);

        const sign1 = await owner.signMessage(ethers.utils.arrayify(msgHash1));
        const sign2 = await owner.signMessage(ethers.utils.arrayify(msgHash2));
        const sign3 = await owner.signMessage(ethers.utils.arrayify(msgHash3));

        await betting.connect(user).claimCommissionWithSignature(POOL_ID, commission1, block, sign1);
        await betting.connect(user2).claimCommissionWithSignature(POOL_ID, commission2, block, sign2);
        await expect(betting.connect(user3).claimCommissionWithSignature(POOL_ID, commission3, block, sign3)).to.be.revertedWith(
          "Betting: No commission to claim"
        );

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(602));

        expect(await betting.totalPayouts(user.address, POOL_ID)).to.equal(convertToWei(300));
        expect(await betting.totalPayouts(user2.address, POOL_ID)).to.equal(0);
        expect(await betting.totalPayouts(user3.address, POOL_ID)).to.equal(0);

        await betting.connect(user).claimPayment(POOL_ID);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(302));

        // Payouts and commissions for POOL 2
        expect(await betting.totalCommissions(user.address, POOL_ID_2)).to.equal(0);
        expect(await betting.totalCommissions(user2.address, POOL_ID_2)).to.equal(convertToWei(1.5));
        expect(await betting.totalCommissions(user3.address, POOL_ID_2)).to.equal(convertToWei(0.5));
          
        const commission1_1 = betting.totalCommissions(user.address, POOL_ID_2);
        const commission2_1 = betting.totalCommissions(user2.address, POOL_ID_2);
        const commission3_1 = betting.totalCommissions(user3.address, POOL_ID_2);

        const msgHash1_1 = await betting.getMessageHash(user.address, POOL_ID_2, commission1_1, block);
        const msgHash2_1 = await betting.getMessageHash(user2.address, POOL_ID_2, commission2_1, block);
        const msgHash3_1 = await betting.getMessageHash(user3.address, POOL_ID_2, commission3_1, block);

        const sign1_1 = await owner.signMessage(ethers.utils.arrayify(msgHash1_1));
        const sign2_1 = await owner.signMessage(ethers.utils.arrayify(msgHash2_1));
        const sign3_1 = await owner.signMessage(ethers.utils.arrayify(msgHash3_1));

        await expect(betting.connect(user).claimCommissionWithSignature(POOL_ID_2, commission1_1, block, sign1_1)).to.be.revertedWith(
          "Betting: No commission to claim"
        );
        await betting.connect(user2).claimCommissionWithSignature(POOL_ID_2, commission2_1, block, sign2_1);
        await betting.connect(user3).claimCommissionWithSignature(POOL_ID_2, commission3_1, block, sign3_1);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(300));

        expect(await betting.totalPayouts(user.address, POOL_ID_2)).to.equal(0);
        expect(await betting.totalPayouts(user2.address, POOL_ID_2)).to.equal(0);
        expect(await betting.totalPayouts(user3.address, POOL_ID_2)).to.equal(convertToWei(300));

        await betting.connect(user3).claimPayment(POOL_ID_2);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(0));
      });

      it("Should allow user to claim batch commission by signature", async function () {
        const { bettingAdmin, betting, usdc, eventName, teams, uri, startTime, duration, owner, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p = await bettingAdmin.getPool(POOL_ID);
        await initializeERC1155(_p.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(POOL_ID);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        const _p2 = await bettingAdmin.getPool(POOL_ID_2);
        await initializeERC1155(_p2.mintContract, user, user2, user3, betting.address);
        await bettingAdmin.startPool(1);

        await betting.connect(user).placeBet(POOL_ID, 1, convertToWei(100));
        await betting.connect(user2).placeBet(POOL_ID_2, 0, convertToWei(100));
        await betting.connect(user2).placeBet(POOL_ID, 0, convertToWei(100));
        await betting.connect(user3).placeBet(POOL_ID_2, 2, convertToWei(100));
        await betting.connect(user3).placeBet(POOL_ID, 2, convertToWei(100));
        await betting.connect(user2).placeBet(POOL_ID_2, 1, convertToWei(100));

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.totalAmount).to.equal(convertToWei(300));
        expect(pool.totalBets).to.equal(3);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(604));

        await time.increaseTo(startTime);
        await bettingAdmin.closePool(POOL_ID);
        await bettingAdmin.closePool(POOL_ID_2);
        await bettingAdmin.gradePool(POOL_ID, 1);
        await bettingAdmin.gradePool(POOL_ID_2, 2);

        // Payouts and commissions for POOL 1
        expect(await betting.totalCommissions(user.address, POOL_ID)).to.equal(convertToWei(1.5));
        expect(await betting.totalCommissions(user2.address, POOL_ID)).to.equal(convertToWei(0.5));
        expect(await betting.totalCommissions(user3.address, POOL_ID)).to.equal(0);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(604));

        expect(await betting.totalPayouts(user.address, POOL_ID)).to.equal(convertToWei(300));
        expect(await betting.totalPayouts(user2.address, POOL_ID)).to.equal(0);
        expect(await betting.totalPayouts(user3.address, POOL_ID)).to.equal(0);

        await betting.connect(user).claimPayment(POOL_ID);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(304));

        // Payouts and commissions for POOL 2
        expect(await betting.totalCommissions(user.address, POOL_ID_2)).to.equal(0);
        expect(await betting.totalCommissions(user2.address, POOL_ID_2)).to.equal(convertToWei(1.5));
        expect(await betting.totalCommissions(user3.address, POOL_ID_2)).to.equal(convertToWei(0.5));

        const block = 40;
        
        const commission1 = await betting.totalCommissions(user.address, POOL_ID);
        const commission2 = await betting.totalCommissions(user2.address, POOL_ID);
        const commission3 = await betting.totalCommissions(user3.address, POOL_ID);

        const commission1_1 = await betting.totalCommissions(user.address, POOL_ID_2);
        const commission2_1 = await betting.totalCommissions(user2.address, POOL_ID_2);
        const commission3_1 = await betting.totalCommissions(user3.address, POOL_ID_2);
        
        const msgHash1_1 = await betting.getMessageHashBatch(user.address, [POOL_ID, POOL_ID_2], [commission1, commission1_1], commission1.add(commission1_1), block);
        const msgHash2_1 = await betting.getMessageHashBatch(user2.address, [POOL_ID, POOL_ID_2], [commission2, commission2_1], commission2.add(commission2_1), block);
        const msgHash3_1 = await betting.getMessageHashBatch(user3.address, [POOL_ID, POOL_ID_2], [commission3, commission3_1], commission3.add(commission3_1), block);

        const sign1_1 = await owner.signMessage(ethers.utils.arrayify(msgHash1_1));
        const sign2_1 = await owner.signMessage(ethers.utils.arrayify(msgHash2_1));
        const sign3_1 = await owner.signMessage(ethers.utils.arrayify(msgHash3_1));

        await betting.connect(user).claimCommissionWithSignatureBatch([POOL_ID, POOL_ID_2], [commission1, commission1_1], commission1.add(commission1_1), block, sign1_1);
        await betting.connect(user2).claimCommissionWithSignatureBatch([POOL_ID, POOL_ID_2], [commission2, commission2_1], commission2.add(commission2_1), block, sign2_1);
        await betting.connect(user3).claimCommissionWithSignatureBatch([POOL_ID, POOL_ID_2], [commission3, commission3_1], commission3.add(commission3_1), block, sign3_1);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(300));

        expect(await betting.totalPayouts(user.address, POOL_ID_2)).to.equal(0);
        expect(await betting.totalPayouts(user2.address, POOL_ID_2)).to.equal(0);
        expect(await betting.totalPayouts(user3.address, POOL_ID_2)).to.equal(convertToWei(300));

        await betting.connect(user3).claimPayment(POOL_ID_2);

        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(0));
      });

    });
  });
  