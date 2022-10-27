const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
  const { expect } = require("chai");
  const { ethers, upgrades } = require("hardhat");

  describe("Betting", function () {
    const NUMBER_OF_TEAMS = 3;
    const POOL_ID = 0;
    const POOL_ID_2 = 1;
    const PoolStatus = {
      Created: 0,
      Running: 1,
      Over: 2,
      Expired: 3    
    };

    function convertToWei(amount) {
      return (amount * 1000000000000000000) + ""
    }

    function toString(amount) {
      return (amount.toString())
    }
    
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshopt in every test.
    async function deployInitializeFixture() {
      // Contracts are deployed using the first signer/account by default
      const startTime = await time.latest();
      const duration = startTime + 1000;
      const eventName = "US Open";
      const teams = [{id: 0, name: "Team1", status: 0}, {id: 1, name: "Team2", status: 0}, {id: 2, name: "Team3", status: 0}];
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

      const erc1155_2 = await ERC1155PresetMinterPauser.deploy("test 2");
      await erc1155_2.deployed();
      
      const BettingAdmin = await ethers.getContractFactory("BettingAdmin");
      const bAdmin = await upgrades.deployProxy(BettingAdmin, [
        usdc.address, vault.address, owner.address
      ]);
      const bettingAdmin = await bAdmin.deployed();

      const Betting = await ethers.getContractFactory("BettingV2");
      const b = await upgrades.deployProxy(Betting, [
        bAdmin.address
      ]);
      const betting = await b.deployed(); 
      
      await bettingAdmin.grantRole("0xa5a0b70b385ff7611cd3840916bd08b10829e5bf9e6637cf79dd9a427fc0e2ab", owner.address);
      await bettingAdmin.updateBettingAddress(betting.address);
      
      await usdc.connect(user).approve(betting.address, convertToWei(500))
      await usdc.connect(user2).approve(betting.address, convertToWei(500))
      await usdc.connect(user3).approve(betting.address, convertToWei(500))
      
      await usdc.connect(user).mint(user.address, convertToWei(500))
      await usdc.connect(user2).mint(user2.address, convertToWei(500))
      await usdc.connect(user3).mint(user3.address, convertToWei(500))

      await erc1155.grantRole("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", betting.address);
      await erc1155.connect(user).setApprovalForAll(betting.address, true);
      await erc1155.connect(user2).setApprovalForAll(betting.address, true);
      await erc1155.connect(user3).setApprovalForAll(betting.address, true);

      await erc1155_2.grantRole("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", betting.address);
      await erc1155_2.connect(user).setApprovalForAll(betting.address, true);
      await erc1155_2.connect(user2).setApprovalForAll(betting.address, true);
      await erc1155_2.connect(user3).setApprovalForAll(betting.address, true);

      return { betting , bettingAdmin, usdc, vault, erc1155, erc1155_2, owner, user, user2, user3, startTime, duration, eventName, teams};
    }

    describe("PlaceBet", function () {
      it("Should allow user to place bet", async function () {
        const { bettingAdmin, betting, erc1155, eventName, teams, startTime, duration, user, usdc } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, erc1155.address, teams);
        await bettingAdmin.startPool(POOL_ID);

        console.log(await bettingAdmin.getPool(POOL_ID));
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
        expect(await erc1155.totalSupply(0)).to.equal(0);
        expect(await erc1155.totalSupply(1)).to.equal(convertToWei(100));
        expect(await erc1155.totalSupply(2)).to.equal(0);
      });
    });

    describe("ClaimWinning", function () {
      it("Should allow user to claim winnings", async function () {
        const { bettingAdmin, betting, erc1155, eventName, teams, startTime, duration, user, user2, user3, usdc } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, erc1155.address, teams);
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

        expect(await erc1155.totalSupply(0)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(1)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(2)).to.equal(convertToWei(100));

        await bettingAdmin.gradePool(POOL_ID, 1);

        expect(await betting.totalPayouts(user.address, POOL_ID)).to.equal(convertToWei(700));
        expect(await betting.totalPayouts(user2.address, POOL_ID)).to.equal(0);
        expect(await betting.totalPayouts(user3.address, POOL_ID)).to.equal(0);

        await betting.connect(user).claimPayment(POOL_ID);

        expect(await betting.totalCommissions(user.address, POOL_ID)).to.equal(convertToWei(3.1));
        expect(await betting.totalCommissions(user2.address, POOL_ID)).to.equal(convertToWei(0.733333333333333333));
        expect(await betting.totalCommissions(user3.address, POOL_ID)).to.equal(convertToWei(0.1667));

        await betting.connect(user).claimCommission(POOL_ID);
        await betting.connect(user2).claimCommission(POOL_ID);
        await betting.connect(user3).claimCommission(POOL_ID);

        expect(await usdc.balanceOf(betting.address)).to.equal(1);
      });

      it("Should allow multiple users to claim winnings ", async function () {
        const { bettingAdmin, betting, erc1155, usdc, eventName, teams, startTime, duration, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, erc1155.address, teams);
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

        expect(await erc1155.totalSupply(0)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(1)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(2)).to.equal(convertToWei(100));

        await bettingAdmin.gradePool(POOL_ID, 0);

        expect(await betting.totalPayouts(user.address, POOL_ID)).to.equal(convertToWei(toString(233.333333333333333333)));
        expect(await betting.totalPayouts(user2.address, POOL_ID)).to.equal(convertToWei(toString(466.666666666666666666)));
        expect(await betting.totalPayouts(user3.address, POOL_ID)).to.equal(0);

        await betting.connect(user).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(470.666666666666666667));

        await betting.connect(user2).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(4));
      });

      it("Should allow users to claim winnings in case of tie", async function () {
        const { bettingAdmin, betting, erc1155, usdc, eventName, teams, startTime, duration, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, erc1155.address, teams);
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

        expect(await erc1155.totalSupply(0)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(1)).to.equal(convertToWei(300));
        expect(await erc1155.totalSupply(2)).to.equal(convertToWei(100));

        await bettingAdmin.markPoolTie(POOL_ID, [0, 1]);

        expect(await betting.totalPayouts(user.address, POOL_ID)).to.equal(convertToWei(toString(466.666666666666666666)));
        expect(await betting.totalPayouts(user2.address, POOL_ID)).to.equal(convertToWei(toString(233.333333333333333333)));
        expect(await betting.totalPayouts(user3.address, POOL_ID)).to.equal(0);

        await betting.connect(user2).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(470.666666666666666667));

        await betting.connect(user).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(4));
      });

      it("Should allow users to claim winnings in case of tie - 2", async function () {
        const { bettingAdmin, betting, erc1155, usdc, eventName, teams, startTime, duration, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        const teams2 = [...teams];
        teams2.push({id: 3, name: "xyz", status: 0});

        await bettingAdmin.createPool(NUMBER_OF_TEAMS + 1, eventName, startTime, duration, erc1155.address, teams2);
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

        expect(await erc1155.totalSupply(0)).to.equal(convertToWei(2));
        expect(await erc1155.totalSupply(1)).to.equal(convertToWei(3));
        expect(await erc1155.totalSupply(2)).to.equal(convertToWei(4));
        expect(await erc1155.totalSupply(3)).to.equal(convertToWei(15));

        await bettingAdmin.markPoolTie(POOL_ID, [2, 3]);

        expect(await betting.totalPayouts(user.address, POOL_ID)).to.equal(convertToWei(toString(11.666666666666666666)));
        expect(await betting.totalPayouts(user2.address, POOL_ID)).to.equal(convertToWei(toString(6.5)));
        expect(await betting.totalPayouts(user3.address, POOL_ID)).to.equal(convertToWei(toString(5.833333333333333)));

        await betting.connect(user2).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(17.72));

        await betting.connect(user).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(6.05333333333333333));

        await betting.connect(user3).claimPayment(POOL_ID);
        expect(await usdc.balanceOf(betting.address)).to.equal(convertToWei(0.22));
      });
  
    });

    describe("ClaimRefund", function () {
      it("Should allow user to claim refunds", async function () {
        const { bettingAdmin, betting, erc1155, usdc, eventName, teams, startTime, duration, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, erc1155.address, teams);
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
      it("Should allow user to claim pool", async function () {
        const { bettingAdmin, betting, erc1155, erc1155_2, usdc, eventName, teams, startTime, duration, user, user2, user3 } = await loadFixture(deployInitializeFixture);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, erc1155.address, teams);
        await bettingAdmin.startPool(POOL_ID);

        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, erc1155_2.address, teams);
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
    });
  });
  