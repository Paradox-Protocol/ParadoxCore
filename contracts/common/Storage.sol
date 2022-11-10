// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;
import "../interfaces/IERC1155PresetMinterPauser.sol";

contract Storage {
    // Pool statuses
    // 0 - Created
    // 1 - Running
    // 2 - Decided
    // 3 - Canceled
    enum PoolStatus{ Created, Running, Decided, Canceled, Closed }
    // Team Statuses
    // 0 - Created
    // 1 - Refunded
    enum TeamStatus{ Created, Refunded }

    // Struct to hold pool data
    struct Pool {
        // Pool id
        uint256 id;
        // Total teams in pool
        uint256 numberOfTeams;
        // Name of the event
        string eventName;
        // Total number of bets placed
        uint256 totalBets;
        // Total bet amount
        uint256 totalAmount;
        // Payout claimed
        uint256 payoutClaimed;
        // Total commisions
        uint256 totalCommissions;
        // Commissions claimed
        uint256 commissionsClaimed;
        // Pool status
        PoolStatus status;
        // Winning teams
        uint256[] winners;
        // When pool starts
        uint256 startTime;
        // When pool ends
        uint256 endTime;
        // Address of the ERC1155 contract where tokens will be minted
        IERC1155PresetMinterPauser mintContract;
        // No more commission payment allowed
        bool commissionDisabled;
        // No more payouts allowed
        bool paymentDisabled;
    }

    // Struct to hold individual bet data
    struct Bet {
        uint256 id;
        // Pool against which bet is made
        uint256 poolId;
        // team for which bet is placed
        uint256 teamId;
        // Amount 
        uint256 amount;
        // Participant address
        address player;
        // Time bet was placed
        uint256 createdAt;
    }

    // Struct to hold commission data
    struct Commission {
        // Commission generated by the bet
        uint256 amount;
        // Current total amount of the pool
        uint256 totalAmount;
        // Player who placed the bet
        address player;
    }

    // Struct to hold team data
    struct Team {
        // Team id
        uint256 id;
        // Team name
        string name;
        // Team status
        TeamStatus status;
        // Total amount bet
        uint256 totalAmount;
    }
}