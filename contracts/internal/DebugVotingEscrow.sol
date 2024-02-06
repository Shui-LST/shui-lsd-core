// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import {EVotingEscrow} from "../espace/VotingEscrow.sol";

import {ParamsControl} from "@confluxfans/contracts/InternalContracts/ParamsControl.sol";
import {CrossSpaceCall} from "@confluxfans/contracts/InternalContracts/CrossSpaceCall.sol";

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract DebugEVotingEscrow is EVotingEscrow {
    using EnumerableSet for EnumerableSet.AddressSet; // Add the library methods

    function getUserLockInfo(
        address user
    ) public view returns (LockInfo memory) {
        return _userLockInfo[user];
    }

    function getStakedAmount(address user) public view returns (uint256) {
        return stakedAmount[user];
    }

    function getUserVoteInfo(
        uint64 round,
        address user,
        uint16 topic,
        uint256 index
    ) public view returns (uint256) {
        return userVoteInfo[round][user][topic][index];
    }

    function getUserVoteMeta(
        uint64 round,
        address user,
        uint16 topic
    ) public view returns (VoteMeta memory) {
        return userVoteMeta[round][user][topic];
    }

    function getTopicSpecialVoters(
        uint64 round,
        uint16 topic,
        uint256 userIndex
    ) public view returns (address) {
        return topicSpecialVoters[round][topic].at(userIndex);
    }

    function getTopicSpecialVotersLength(
        uint64 round,
        uint16 topic
    ) public view returns (uint256) {
        return topicSpecialVoters[round][topic].length();
    }

    function currentRoundEndBlock() public view returns (uint256) {
        return _currentRoundEndBlock();
    }
}
