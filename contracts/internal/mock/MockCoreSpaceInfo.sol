// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;
import {ICoreSpaceInfo} from "../../interfaces/ICoreSpaceInfo.sol";

contract MockCoreSpaceInfo is ICoreSpaceInfo {
    /* ================================== Helps ====================================== */
    uint256 _blockNumber = 1;
    uint64 _currentVoteRound = 1;

    function setBlockNumber(uint256 value) public {
        _blockNumber = value;
    }

    function setCurrentVoteRound(uint64 value) public {
        _currentVoteRound = value;
    }

    /* ================================== Impls ====================================== */
    function blockNumber() external view override returns (uint256) {
        return _blockNumber;
    }

    function currentVoteRound() external view override returns (uint64) {
        return _currentVoteRound;
    }
}
