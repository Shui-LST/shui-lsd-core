// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.18;

// Difference with Staking: deposit is payable for test
interface IStaking {
    function getStakingBalance(address user) external view returns (uint256);
    function getLockedStakingBalance(address user, uint256 blockNumber) external view returns (uint256);
    function getVotePower(address user, uint256 blockNumber) external view returns (uint256);
    function deposit(uint256 amount) payable external;
    function withdraw(uint256 amount) external;
    function voteLock(uint256 amount, uint256 unlockBlockNumber) external;
}