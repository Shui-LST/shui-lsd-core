# Farming

This contract is a farming contract that allows users to stake their tokens and earn rewards. It can support multiple pools, each with its own reward token.

```solidity
struct FarmPool {
    uint256 id;
    IERC20 stakeToken;
    IERC20 rewardToken;
    uint256 rewardPerBlock; // reward rate
    uint256 startBlock; // eSpace block, approximately 1 block per 1 seconds
    uint256 endBlock;
    string name;
}

struct PoolStakeInfo {
    uint256 lastRewardBlock;
    uint256 accRewardPerShare;
    uint256 totalStaked; // total amount of staked tokens
}

struct UserStakeInfo {
    uint256 amount; // amount of staked tokens
    uint256 userRewardPerTokenPaid;
    uint256 reward; // pending reward, not realtime
}

// Returns the number of pools
function poolLength() public view returns (uint256);

// Returns the pool info
function getPools() public view returns (FarmPool[] memory);

// Returns the pool info in a range
function getPools(uint256 skip, uint256 limit) public view returns (FarmPool[] memory);

// Deposit tokens to the pool
// @param _pid The pool id
// @param _amount The amount of tokens to deposit
// @note Need to approve the contract to spend the token
// @note Required one pool is started and not ended
function deposit(uint256 _pid, uint256 _amount) public;

// Withdraw tokens from the pool
// Can withdraw at any time
function withdraw(uint256 _pid, uint256 _amount) public;

// Claim rewards
function claim(uint256 _pid) public;

// Returns the user's realtime reward
function reward(address _user, uint256 _pid) public;

// Returns the user's stake info for one pool, mainly the amount of staked tokens, the reward is not realtime
function userStakeInfo(address _user, uint256 _pid) public view returns(UserStakeInfo memory);
```