// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "../common/Storage.sol";

contract BettingAdmin is Storage, UUPSUpgradeable, AccessControlUpgradeable {
    IERC20Upgradeable public usdcContract;
    // Vault contract address where unclaimed winnings and payouts will be transferred for insurance
    address public vaultContract;

    // Array of all pools
    Pool[] public pools;
    // Array of all bets
    Bet[] public bets;

    // Mapping from poolid -> Teams in a pool
    mapping(uint256 => Team[]) public poolTeams;
    // Address used to sign commission amount for the user
    // Off-chain commission calculated is signed by this address so that user cannot claim more than they are eligible
    address public signer;

    // Address of main betting contract
    address public betting;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    bytes32 public constant MULTISIG_ROLE = keccak256("MULTISIG_ROLE");

    // Mapping from poolid -> bet indexes placed against this pool
    mapping (uint256 => uint256[]) public poolBets; 

    // Mapping from poolstatus -> poolId. Used to filter pools based on status
    mapping(uint256 => uint256) public poolStatus;

    event PoolCreated(uint256 indexed poolId, uint256 numberOfTeams, uint256 startTime);
    event PoolCanceled(uint256 indexed poolId);
    event PoolStarted(uint256 indexed poolId);
    event PoolGraded(uint256 indexed poolId, uint256[] winnerId);

    event CommissionTransferredToVault(uint256 indexed poolId, uint256 amount);
    event PayoutTransferredToVault(uint256 indexed poolId, uint256 amount);

    event TeamAdded(uint256 indexed poolId, uint256 teamId);
    event TeamRemoved(uint256 indexed poolId, uint256 teamId);

    // poolId should be > 0 and less than total number of pools
    modifier validPool(uint256 poolId_) {
        require(poolId_ >= 0 && poolId_ < pools.length, "Betting: Id is not valid");
        _;
    }

    // Checks if status of pool matches required status
    modifier validStatus(uint256 status_, uint256 requiredStatus_) {
        require(status_ == requiredStatus_, "Betting: pool status does not match");
        _;
    }

    modifier onlyBetting() {
        require(msg.sender == betting, "BettingAdmin: Only betting contract is authorized for this operation");
        _;
    }

    // Initializes initial contract state
    // Since we are using UUPS proxy, we cannot use contructor instead need to use this
    function initialize(address usdcContract_, address vaultContract_, address signer_) public initializer {
        __UUPSUpgradeable_init();

        usdcContract = IERC20Upgradeable(usdcContract_);
        vaultContract = vaultContract_;
        signer = signer_;
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Allow only admins to perform a future upgrade to the contract
    function _authorizeUpgrade (address newImplementation) internal virtual override onlyRole(ADMIN_ROLE) {

    }

    // Allows admin to create a new pool
    function createPool(uint256 numberOfTeams_, string memory eventName_, uint256 startTime_, uint256 duration_, address mint_, Team[] memory teams_) external onlyRole(MULTISIG_ROLE) {
        uint256 poolId = pools.length;
        require(teams_.length == numberOfTeams_, "Betting: Mismatching teams and numberOfTeams");
        uint256[] memory _winners;
        pools.push(Pool(poolId, numberOfTeams_, eventName_, 0, 0, 0, 0, 0, PoolStatus.Created, _winners, startTime_, startTime_ + duration_,  IERC1155PresetMinterPauser(mint_)));

        for (uint256 i = 0; i < numberOfTeams_; i++) {
            poolTeams[poolId].push(teams_[i]);
        }

        emit PoolCreated(poolId, numberOfTeams_, startTime_);
    }

    // Allows admin to add a new team to pool
    function createTeam(uint256 poolId_, Team memory team_) external onlyRole(MULTISIG_ROLE) validPool(poolId_) {
        Pool storage pool = pools[poolId_];
        require(pool.status == PoolStatus.Created, "Betting: Pool status should be Created");

        uint256 teamId_ = pool.numberOfTeams;
        pool.numberOfTeams += 1;
        poolTeams[poolId_].push(team_);
        emit TeamAdded(poolId_, teamId_);
    }

    // Allows admin to cancel a pool making all pool proceeds including commission to be eligible for refund
    function cancelPool(uint256 poolId_) external onlyRole(MULTISIG_ROLE) validPool(poolId_) {
        Pool storage pool = pools[poolId_];
        require(pool.status == PoolStatus.Created || pool.status == PoolStatus.Running, "Betting: Pool status should be Created or Running");

        pool.status = PoolStatus.Canceled;

        emit PoolCanceled(poolId_);
    }

    // Allows admin to start a pool
    function startPool(uint256 poolId_) external onlyRole(MULTISIG_ROLE) validPool(poolId_) {
        Pool storage pool = pools[poolId_];
        require(pool.status == PoolStatus.Created, "Betting: Pool status should be Created");

        pool.status = PoolStatus.Running;

        emit PoolStarted(poolId_);
    }

    // Allows admin to decide winner of a pool. More than 1 winners can be in case of a tie/washout.
    function gradePool(uint256 poolId_, uint256 winnerId_) external onlyRole(MULTISIG_ROLE) validPool(poolId_) {
        Pool storage pool = pools[poolId_];
        require(pool.status == PoolStatus.Running, "Betting: Pool status should be Running");

        // Mark pool as closed
        pool.status = PoolStatus.Decided;
        pool.winners.push(winnerId_);

        emit PoolGraded(poolId_, pool.winners);
    }

    // Allows admin to decide more than one winners of a pool. More than 1 winners can be in case of a tie/washout.
    function markPoolTie(uint256 poolId_, uint256[] memory winnerIds_) external onlyRole(MULTISIG_ROLE) validPool(poolId_) {
        Pool storage pool = pools[poolId_];
        require(pool.status == PoolStatus.Running, "Betting: Pool status should be Running");

        // Mark pool as closed
        pool.status = PoolStatus.Decided;
        pool.winners = winnerIds_;

        emit PoolGraded(poolId_, pool.winners);
    }

    // Allows admin to transfer unclaimed commission to insurance vault
    function transferCommissionToVault(uint256 poolId_) external onlyRole(MULTISIG_ROLE) validPool(poolId_) {
        Pool storage pool = pools[poolId_];
        require(pool.status == PoolStatus.Decided, "Betting: Pool status should be Decided");
        require((pool.endTime + 30 days) >= block.timestamp, "Betting: Cannot transfer before 30 days deadline");

        uint256 _unclaimedCommission = pool.totalCommissions - pool.commissionsClaimed;
        usdcContract.transferFrom(betting, vaultContract, _unclaimedCommission);

        emit CommissionTransferredToVault(poolId_, _unclaimedCommission);
    }

    // Allows admin to transfer unclaimed payout to insurance vault
    function transferPayoutToVault(uint256 poolId_) external onlyRole(MULTISIG_ROLE) validPool(poolId_) {
        Pool storage pool = pools[poolId_];
        require(pool.status == PoolStatus.Decided, "Betting: Pool status should be Decided");
        require((pool.endTime + 90 days) >= block.timestamp, "Betting: Cannot transfer before 90 days deadline");

        uint256 _unclaimedPayout = pool.totalAmount - pool.payoutClaimed;
        usdcContract.transferFrom(betting, vaultContract, _unclaimedPayout);

        emit PayoutTransferredToVault(poolId_, _unclaimedPayout);
    }

    // Allows admin to refund a single team in pool, making all bets placed on that team only eligible for refund
    function refundTeam(uint256 poolId_, uint256 teamId_) external onlyRole(MULTISIG_ROLE) validPool(poolId_) {
        // Remove player from pool and issue refund
        Pool storage pool = pools[poolId_];
        require(pool.status == PoolStatus.Running, "Betting: Pool status should be Running");

        Team storage team = poolTeams[poolId_][teamId_];
        team.status = TeamStatus.Refunded;

        emit TeamRemoved(poolId_, teamId_);
    }

    // Allows admin to update start time and duration of a pool
    function updateStartTime(uint256 poolId_, uint256 startTime_, uint256 duration_) external onlyRole(MULTISIG_ROLE) validPool(poolId_) {
        Pool storage pool = pools[poolId_];
        require(pool.status == PoolStatus.Created, "Betting: Pool status should be Created");

        pool.startTime = startTime_;
        pool.endTime = startTime_ + duration_;
    }

    // Allows admin to update signer address
    function updateVeraSignerAddress(address signer_)
        external
        onlyRole(MULTISIG_ROLE)
    {
        require(signer_ != address(0), "Zero Signer address");
        signer = signer_;
    }

    // Allows admin to update usdc contract address
    function updateUsdcContract(address usdcContract_)
        external
        onlyRole(MULTISIG_ROLE)
    {
        require(usdcContract_ != address(0), "Zero usdcContract address");
        usdcContract = IERC20Upgradeable(usdcContract_);
    }

    // Allows admin to update vault contract address
    function updateVaultContract(address vaultContract_)
        external
        onlyRole(MULTISIG_ROLE)
    {
        require(vaultContract_ != address(0), "Zero vaultContract address");
        vaultContract = vaultContract_;
    }

    // Allows admin to update vault contract address
    function updateBettingAddress(address betting_)
        external
        onlyRole(MULTISIG_ROLE)
    {
        require(betting_ != address(0), "Zero betting address");
        betting = betting_;
    }

    function placeBet(address player_, uint256 poolId_, uint256 teamId_, uint256 amount_, uint256 commission_) external onlyBetting returns (bool) {
        Pool storage pool = pools[poolId_];
        
        // Update pool statistics
        pool.totalAmount += amount_;
        pool.totalBets += 1;
        pool.totalCommissions += commission_;
        return true; 
    }

    function payoutClaimed(address player_, uint256 poolId_, uint256 amount_) external onlyBetting returns (bool) { 
        Pool storage pool = pools[poolId_];
        pool.payoutClaimed += amount_;

        return true;
    }

    function commissionClaimed(address player_, uint256 poolId_, uint256 amount_) external onlyBetting returns (bool) { 
        Pool storage pool = pools[poolId_];
        pool.commissionsClaimed += amount_;

        return true;
    }

    function refundClaimed(address player_, uint256 poolId_, uint256 amount_) external onlyBetting returns (bool) { 
       
    }

    // Returns all teams of a pool
    function getPoolTeams(uint256 poolId_) external view returns(Team[] memory) {
        return poolTeams[poolId_];
    }

    function getTotalPools() external view returns(uint256) {
        return pools.length;
    }

    function getPool(uint256 poolId_) external view returns (Pool memory) {
        return pools[poolId_];
    }

    // Returns all teams of a pool
    function getPoolTeam(uint256 poolId_, uint256 teamId_) external view returns(Team memory) {
        return poolTeams[poolId_][teamId_];
    }
}
