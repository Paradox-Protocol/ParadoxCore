const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
  const { expect } = require("chai");
  const { ethers, upgrades } = require("hardhat");

  describe("BettingAdmin", function () {
    const NUMBER_OF_TEAMS = 3;
    const POOL_ID = 0;
    const PoolStatus = {
      Created: 0,
      Running: 1,
      Over: 2,
      Expired: 3,   
      Closed: 4,
    };
    
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshopt in every test.
    async function deployInitializeFixture() {
      // Contracts are deployed using the first signer/account by default
      const startTime = await time.latest() + 1000;
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
      const erc1155 = await ERC1155PresetMinterPauser.deploy(ERC1155PresetMinterPauser);
      await erc1155.deployed();

      const Proxy = await ethers.getContractFactory("Proxy");
      const proxy = await Proxy.deploy(erc1155.address);
      await proxy.deployed();
      
      const BettingAdmin = await ethers.getContractFactory("BettingAdmin");
      const bAdmin = await upgrades.deployProxy(BettingAdmin, [
        usdc.address, vault.address, owner.address, proxy.address
      ]);
      const bettingAdmin = await bAdmin.deployed();
      await bettingAdmin.grantRole(bettingAdmin.MULTISIG_ROLE(), owner.address);
      await bettingAdmin.grantRole(bettingAdmin.GAME_ADMIN_ROLE(), owner.address);
      await bettingAdmin.grantRole(bettingAdmin.ADMIN_ROLE(), owner.address);

      return { bettingAdmin, usdc, vault, erc1155, user, user2, user3, startTime, duration, eventName, teams, uri};
    }
  
    describe("Initialize", function () {
      it("Should set the right vault address", async function () {
        const { bettingAdmin, vault } = await loadFixture(deployInitializeFixture);
        expect(await bettingAdmin.vaultContract()).to.equal(vault.address);
      });
  
      it("Should set the right usdc address", async function () {
        const { bettingAdmin, usdc } = await loadFixture(deployInitializeFixture);
        expect(await bettingAdmin.erc20Contract()).to.equal(usdc.address);
      });
    });

    describe("CreatePool", function () {
      it("Should allow owner to create pool", async function () {
        const { bettingAdmin, eventName, teams, uri, startTime, duration } = await loadFixture(deployInitializeFixture);
          
        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.id).equal(POOL_ID);
        expect(pool.numberOfTeams).equal(NUMBER_OF_TEAMS);
        expect(pool.eventName).equal(eventName);
        expect(pool.totalBets).equal(0);
        expect(pool.totalAmount).equal(0);
        expect(pool.status).equal(PoolStatus.Created);
        expect(pool.winners.length).equal(0);
        expect(pool.startTime).equal(startTime);
        expect(pool.endTime).equal(startTime + duration);
        // expect(pool.mintContract).equal(erc1155.address);

        const poolTeams =  await bettingAdmin.getPoolTeams(POOL_ID);
        expect(poolTeams.length).equal(NUMBER_OF_TEAMS);
        expect(poolTeams[0].name).equal(teams[0]);
        expect(poolTeams[1].name).equal(teams[1]);
        expect(poolTeams[2].name).equal(teams[2]);

      });
  
      it("Should not allow non-owner to create pool", async function () {
        const { bettingAdmin, eventName, teams, user, uri } = await loadFixture(deployInitializeFixture);
  
        await expect(bettingAdmin.connect(user).createPool(NUMBER_OF_TEAMS, eventName, 0, 0, teams, uri)).to.be.revertedWith(
          "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x9b7946abd96dccbe6cfc6cc2c13300ab429d93e16fa72dc459eeccda73817f08"
        );
      });
    });

    describe("StartPool", function () {
      it("Should allow owner to start pool", async function () {
        const { bettingAdmin, eventName, teams, uri, startTime, duration } = await loadFixture(deployInitializeFixture);
        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);

        await bettingAdmin.startPool(POOL_ID);
        const pool =  await bettingAdmin.pools(POOL_ID);

        expect(pool.status).to.equal(PoolStatus.Running);
      });
  
      it("Should not allow non-owner to start pool", async function () {
        const { bettingAdmin, user } = await loadFixture(deployInitializeFixture);
  
        await expect(bettingAdmin.connect(user).startPool(POOL_ID)).to.be.revertedWith(
          "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x9b7946abd96dccbe6cfc6cc2c13300ab429d93e16fa72dc459eeccda73817f08"
        );
      });
    });

    describe("GradePool", function () {
      it("Should allow owner to grade pool", async function () {
        const { bettingAdmin, uri, eventName, teams, startTime, duration } = await loadFixture(deployInitializeFixture);
        
        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        await bettingAdmin.startPool(POOL_ID);
        await time.increaseTo(startTime);
        await bettingAdmin.closePool(POOL_ID);
        await bettingAdmin.gradePool(POOL_ID, 1);

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.status).to.equal(PoolStatus.Over);
        expect(pool.winners.length).to.equal(1);
        expect(pool.winners[0]).to.equal(1);
      });
  
      it("Should not allow non-owner to grade pool", async function () {
        const { bettingAdmin, user, startTime } = await loadFixture(deployInitializeFixture);
        
        await time.increaseTo(startTime);
        await expect(bettingAdmin.connect(user).gradePool(POOL_ID, 1)).to.be.revertedWith(
          "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0xa5a0b70b385ff7611cd3840916bd08b10829e5bf9e6637cf79dd9a427fc0e2ab"
        );
      });
    });

    describe("CancelPool", function () {
      it("Should allow owner to cancel pool", async function () {
        const { bettingAdmin, uri, eventName, teams, startTime, duration } = await loadFixture(deployInitializeFixture);
          
        await bettingAdmin.createPool(NUMBER_OF_TEAMS, eventName, startTime, duration, teams, uri);
        await bettingAdmin.cancelPool(POOL_ID);

        const pool =  await bettingAdmin.getPool(POOL_ID);
        expect(pool.status).to.equal(PoolStatus.Expired);
        expect(pool.winners.length).to.equal(0);
      });
  
      it("Should not allow non-owner to cancel pool", async function () {
        const { bettingAdmin, user } = await loadFixture(deployInitializeFixture);
  
        await expect(bettingAdmin.connect(user).cancelPool(POOL_ID)).to.be.revertedWith(
          "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0xa5a0b70b385ff7611cd3840916bd08b10829e5bf9e6637cf79dd9a427fc0e2ab"
        );
      });
    });
  });
  