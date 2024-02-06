// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;

import {IVotingEscrow} from "../../interfaces/IVotingEscrow.sol";
import {ParamsControl} from "@confluxfans/contracts/InternalContracts/ParamsControl.sol";

contract MockVotingEscrow is IVotingEscrow {
    /* ================================== Mocks ====================================== */
    mapping(address => uint256) public userStakeAmounts;
    mapping(address => LockInfo) public userLockInfos;
    mapping(address => mapping(uint => LockInfo)) public userBlockLockInfos;
    mapping(address => uint256) public userVotePowers;
    mapping(address => mapping(uint => uint)) public userBlockVotePowers;
    mapping(uint64 => mapping(uint16 => uint256[3])) public poolVoteInfo;
    uint public _lastUnlockBlock;
    mapping(uint => uint) public _globalLockAmount;
    mapping(address => uint256) _userStakeableAmount;

    event EventCreateLock(uint256 amount, uint256 unlockBlock);
    event EventIncreaseLock(uint256 amount);
    event EventExtendLockTime(uint256 unlockBlock);
    event EventCastVote(
        uint64 vote_round,
        uint16 topic_index,
        uint256[3] votes
    );
    event EventSetCoreInfo(uint256, uint64);

    function setUserStakeAmount(address user, uint amount) public {
        userStakeAmounts[user] = amount;
    }


    function setUserStakeableAmount(address user, uint amount) public {
        _userStakeableAmount[user] = amount;
    }

    function setUserLockInfo(address user, LockInfo memory lockInfo) public {
        userLockInfos[user] = lockInfo;
    }

    function setUserBlockLockInfo(
        address user,
        uint blockNumber,
        LockInfo memory lockInfo
    ) public {
        userBlockLockInfos[user][blockNumber] = lockInfo;
    }

    function setUserVotePower(address user, uint amount) public {
        userVotePowers[user] = amount;
    }

    function setUserVotePower(
        address user,
        uint blockNumber,
        uint amount
    ) public {
        userBlockVotePowers[user][blockNumber] = amount;
    }

    function setLastUnlockBlock(uint val) public {
        _lastUnlockBlock = val;
    }

    function setGlobalLockAmount(uint256 lockBlock, uint amount) public {
        _globalLockAmount[lockBlock] = amount;
    }

    function setPoolVoteInfo(
        uint64 round,
        uint16 topicIndex,
        uint[3] memory value
    ) public {
        poolVoteInfo[round][topicIndex] = value;
    }


    /* ============================================================================= */

    function userStakableAmount(
        address user
    ) external view override returns (uint256) {
        return _userStakeableAmount[user];
    }

    function createLock(uint256 amount, uint256 unlockBlock) external override {
        emit EventCreateLock(amount, unlockBlock);
    }

    function increaseLock(uint256 amount) external override {
        emit EventIncreaseLock(amount);
    }

    function extendLockTime(uint256 unlockBlock) external override {
        emit EventExtendLockTime(unlockBlock);
    }

    function userLockInfo(
        address user
    ) external view override returns (LockInfo memory) {
        return userLockInfos[user];
    }

    function userLockInfo(
        address user,
        uint256 blockNumber
    ) external view override returns (LockInfo memory) {
        return userBlockLockInfos[user][blockNumber];
    }

    function userVotePower(
        address user
    ) external view override returns (uint256) {
        return userVotePowers[user];
    }

    function userVotePower(
        address user,
        uint256 blockNumber
    ) external view override returns (uint256) {
        return userBlockVotePowers[user][blockNumber];
    }

    function castVote(
        uint64 vote_round,
        uint16 topic_index,
        uint256[3] memory votes
    ) external override {
        emit EventCastVote(vote_round, topic_index, votes);
    }

    function readVote(
        address addr,
        uint16 topicIndex
    ) external view override returns (ParamsControl.Vote memory) {}

    function setCoreInfo(uint256 blockNumber, uint64 voteRound) public {
        emit EventSetCoreInfo(blockNumber, voteRound);
    }

    function lastUnlockBlock() public view returns (uint) {
        return _lastUnlockBlock;
    }

    function globalLockAmount(uint256 lockBlock) public view returns (uint) {
        return _globalLockAmount[lockBlock];
    }

    function getPoolVoteInfo(
        uint64 round,
        uint16 topicIndex
    ) public view returns (uint256[3] memory) {
        return poolVoteInfo[round][topicIndex];
    }
}
