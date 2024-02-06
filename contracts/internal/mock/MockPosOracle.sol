// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;

import {IPoSOracle} from "../../interfaces/IPoSOracle.sol";

contract MockPosOracle is IPoSOracle {
    /* ================================== Mocks ====================================== */
    uint256 _posBlockHeight;
    uint256 _posEpochHeight;
    uint256 _powEpochNumber;
    mapping(uint256 => mapping(address => uint256)) private _userVoteInfos; // epochNumber => (powAccount => availableVotes)

    mapping(uint256 => mapping(address => uint256)) private _userPosRewardInfos; // epochNumber => (powAccount => RewardInfo)

    mapping(bytes32 => IPoSOracle.PoSAccountInfo)
        private _userPosAccountCurrentInfos; // posAccount => PoSAccountInfo

    mapping(address => bytes32) powAddr2posAddr;

    function setposBlockHeight(uint256 val) public {
        _posBlockHeight = val;
    }

    function setposEpochHeight(uint256 val) public {
        _posEpochHeight = val;
    }

    function setpowEpochNumber(uint256 val) public {
        _powEpochNumber = val;
    }

    function setUserVotes(
        uint256 epochNumber,
        address posAddr,
        uint256 amount
    ) public {
        _userVoteInfos[epochNumber][posAddr] = amount;
    }

    function setUserPoSReward(
        uint256 epoch,
        address powAddr,
        uint256 reward
    ) public {
        _userPosRewardInfos[epoch][powAddr] = reward;
    }

    function setPosAccountCurrentInfos(
        bytes32 posAddr,
        IPoSOracle.PoSAccountInfo memory info
    ) public {
        _userPosAccountCurrentInfos[posAddr].availableVotes = info.availableVotes;
        _userPosAccountCurrentInfos[posAddr].unlocked = info.unlocked;
        _userPosAccountCurrentInfos[posAddr].locked = info.locked;
        _userPosAccountCurrentInfos[posAddr].forfeited = info.forfeited;
        _userPosAccountCurrentInfos[posAddr].forceRetired = info.forceRetired;
        _userPosAccountCurrentInfos[posAddr].blockNumber = info.blockNumber;
        _userPosAccountCurrentInfos[posAddr].epochNumber = info.epochNumber;
    }

    function setPosAccountCurrentInfos(
        address powAddr,
        IPoSOracle.PoSAccountInfo memory info
    ) public {
        bytes32 posAddr = powAddr2posAddr[powAddr];
        setPosAccountCurrentInfos(posAddr,info);
    }

    function setPosAddrOfPow(bytes32 posAddr, address powAddr) public {
        powAddr2posAddr[powAddr] = posAddr;
    }

    /* =============================================================================== */
    function posBlockHeight() external view override returns (uint256) {
        return _posBlockHeight;
    }

    function posEpochHeight() external view override returns (uint256) {
        return _posEpochHeight;
    }

    function powEpochNumber() external view override returns (uint256) {
        return _powEpochNumber;
    }

    function getUserVotes(
        uint256 epoch,
        address posAddr
    ) external view override returns (uint256) {
        return _userVoteInfos[epoch][posAddr];
    }

    function getUserPoSReward(
        uint256 epoch,
        address powAddr
    ) external view override returns (uint256) {
        return _userPosRewardInfos[epoch][powAddr];
    }

    function getPoSAccountInfo(
        bytes32 posAddr
    ) external view override returns (PoSAccountInfo memory) {
        return _userPosAccountCurrentInfos[posAddr];
    }

    function getPoSAccountInfo(
        address powAddr
    ) external view override returns (PoSAccountInfo memory) {
        bytes32 posAddr = powAddr2posAddr[powAddr];
        return _userPosAccountCurrentInfos[posAddr];
    }
}
