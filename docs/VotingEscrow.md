# VotingEscrow

This contract allows users to lock their sCFX tokens for a certain period of time and receive a voting power to be used in the governance of the Conflux Network.

## Lockup Period

The longer the lockup period, the more voting power the user will receive. The relationship between the lockup period and the voting power is as follows:

- 1 quarter (3 months) lockup period: 0.25x voting power
- 2 quarters (6 months) lockup period: 0.5x voting power
- 3 quarters (9 months) lockup period: 0.5x voting power
- 4 quarters (12 months) lockup period: 1x voting power

Which is same as [Conflux Network's official Voting strategy](https://doc.confluxnetwork.org/docs/general/conflux-basics/conflux-governance/governance-overview).

The lockup period is calculated in **Core Space blocks**, and the user can withdraw their tokens after the lockup period ends. One block is approximately 0.5 second.

### Note

1. If the lockup period is longer than 12 months, the user will also receive 1x voting power for one CFX.
2. As the block number increases (the lockup period decreases), the voting power will also decrease.

## Contract Interface

```solidity
struct LockInfo {
    uint256 amount;
    uint256 unlockBlock;
}

// Returns the current round of Core Space voting
function coreVoteRound() external view returns (uint64);
// Returns the current block number of Core Space
function coreBlockNumber() external view returns (uint256);
// Returns the CFX amount that the user's sCFX can exchange
function userStakableAmount(address user) external view returns (uint256);
// If the user haven't locked any sCFX, use this function to create a lock
// @param amount The amount of sCFX to lock, before calling this function, the user should approve the sCFX to this contract
// @param unlockBlock The block number when the lock period ends, the lock period is calculated in Core Space blocks, one block is approximately 0.5 second, inside this function, the actually unlock block will be calculated by the formula: (unlockBlock / QUARTER_BLOCK_NUMBER + 1) * QUARTER_BLOCK_NUMBER, to make sure the unlock block is the end of a quarter
// 
function createLock(uint256 amount, uint256 unlockBlock) external;
// If user have already locked sCFX, use this function to increase the lock amount
function increaseLock(uint256 amount) external;
// If user have already locked sCFX, use this function to extend the lock time
function extendLockTime(uint256 unlockBlock) external;
// Returns the lock information of the user
function userLockInfo(address user) external view returns (LockInfo memory);
// Returns the lock information of the user at a certain block
function userLockInfo(address user, uint256 blockNumber) external view returns (LockInfo memory);
// Returns the voting power of the user
function userVotePower(address user) external view returns (uint256);
// Returns the voting power of the user at a certain block
function userVotePower(address user, uint256 blockNumber) external view returns (uint256);
// Withdraw the sCFX after the lock period ends
function withdraw() external;
```

After user locked sCFX and received voting power, the user can use the voting power to vote in the [governance of the Conflux Network](https://confluxhub.io/governance/dashboard).