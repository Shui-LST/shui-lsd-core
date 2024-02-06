// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;
import {ParamsControl} from "@confluxfans/contracts/InternalContracts/ParamsControl.sol";

contract MockParamsControl is ParamsControl {
    function castVote(
        uint64 vote_round,
        Vote[] calldata vote_data
    ) external override {}

    function readVote(
        address addr
    ) external view override returns (Vote[] memory) {}

    function currentRound() external view override returns (uint64) {}

    function totalVotes(
        uint64 vote_round
    ) external view override returns (Vote[] memory) {}

    function posStakeForVotes(
        uint64
    ) external view override returns (uint256) {}
}
