// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

interface IPoSOracle {
    struct VoteInfo {
        uint256 power;
        uint256 endBlockNumber; // end PoS block number
    }

    struct RewardInfo {
        bytes32 posAddress;
        address powAddress;
        uint256 reward;
    }

    struct PoSAccountInfo {
        uint256 epochNumber; // pos epoch number
        uint256 blockNumber; // pos block number
        uint256 availableVotes;
        uint256 unlocked;
        uint256 locked;
        uint256 forfeited;
        bool forceRetired;
        VoteInfo[] inQueue;
        VoteInfo[] outQueue;
    }

    function posBlockHeight() external view returns (uint256);
    function posEpochHeight() external view returns (uint256);
    function powEpochNumber() external view returns (uint256);
    function getUserVotes(uint256 epoch, address powAddr) external view returns (uint256);
    function getUserPoSReward(uint256 epoch, address powAddr) external view returns (uint256);
    function getPoSAccountInfo(bytes32 posAddr) external view returns (PoSAccountInfo memory);
    function getPoSAccountInfo(address powAddr) external view returns (PoSAccountInfo memory);
}
