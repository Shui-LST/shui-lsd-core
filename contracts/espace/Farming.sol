// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Farming is Ownable, Initializable {
    using EnumerableSet for EnumerableSet.UintSet;
    using SafeERC20 for IERC20;

    struct FarmPool {
        uint256 id;
        IERC20 stakeToken;
        IERC20 rewardToken;
        uint256 rewardPerBlock; // reward rate
        uint256 startBlock;
        uint256 endBlock;
        string name;
    }

    struct PoolStakeInfo {
        uint256 lastRewardBlock;
        uint256 accRewardPerShare;
        uint256 totalStaked;
    }

    struct UserStakeInfo {
        uint256 amount;
        uint256 userRewardPerTokenPaid;
        uint256 reward;
    }

    uint256 public nextPoolId;
    EnumerableSet.UintSet private poolIds;
    mapping(uint256 => FarmPool) public poolInfo;
    mapping(uint256 => PoolStakeInfo) public poolStakeInfo;
    
    // user => poolId => UserStakeInfo
    mapping(address => mapping(uint256 => UserStakeInfo)) public userStakeInfo;

    event UserDeposit(address indexed user, uint256 indexed pid, uint256 amount);
    event UserWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event UserClaim(address indexed user, uint256 indexed pid, uint256 amount);

    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        _transferOwnership(_msgSender());
    }

    modifier updateReward(address _user, uint256 _pid) {
        poolStakeInfo[_pid].accRewardPerShare = rewardPerToken(_pid);
        poolStakeInfo[_pid].lastRewardBlock = lastTimeRewardApplicable(_pid);

        if (_user != address(0)) {
            userStakeInfo[_user][_pid].reward = reward(_user, _pid);
            userStakeInfo[_user][_pid].userRewardPerTokenPaid = poolStakeInfo[_pid].accRewardPerShare;
        }

        _;
    }

    function deposit(uint256 _pid, uint256 _amount) public updateReward(msg.sender, _pid) {
        FarmPool memory pool = poolInfo[_pid];
        require(block.number >= pool.startBlock, "Farming: not started yet");
        require(block.number <= pool.endBlock, "Farming: already ended");
        require(_amount > 0, "Farming: invalid amount");

        require(pool.stakeToken.allowance(msg.sender, address(this)) >= _amount, "Farming: not enough allowance");
        pool.stakeToken.safeTransferFrom(msg.sender, address(this), _amount);

        poolStakeInfo[_pid].totalStaked += _amount;
        userStakeInfo[msg.sender][_pid].amount += _amount;

        emit UserDeposit(msg.sender, _pid, _amount);
    }

    function withdraw(uint256 _pid, uint256 _amount) public updateReward(msg.sender, _pid) {
        require(_amount <= userStakeInfo[msg.sender][_pid].amount, "Farming: not enough balance");

        poolStakeInfo[_pid].totalStaked -= _amount;
        userStakeInfo[msg.sender][_pid].amount -= _amount;

        FarmPool memory pool = poolInfo[_pid];
        pool.stakeToken.safeTransfer(msg.sender, _amount);

        emit UserWithdraw(msg.sender, _pid, _amount);
    }

    function claim(uint256 _pid) public  updateReward(msg.sender, _pid){
        require(userStakeInfo[msg.sender][_pid].reward > 0, "Farming: no reward");
        
        uint256 _reward = userStakeInfo[msg.sender][_pid].reward;
        userStakeInfo[msg.sender][_pid].reward = 0;

        poolInfo[_pid].rewardToken.safeTransfer(msg.sender, _reward);

        emit UserClaim(msg.sender, _pid, _reward);
    }

    function reward(address _user, uint256 _pid) public view returns (uint256) {
        UserStakeInfo memory sInfo = userStakeInfo[_user][_pid];
        return (
            (
                sInfo.amount * (rewardPerToken(_pid) - sInfo.userRewardPerTokenPaid)
            ) / 1e18
        ) + sInfo.reward;
    }

    function poolLength() public view returns (uint256) {
        return poolIds.length();
    }

    function poolIdsAt(uint256 _index) public view returns (uint256) {
        return poolIds.at(_index);
    }

    function getPools() public view returns (FarmPool[] memory) {
        uint256 _length = poolLength();
        FarmPool[] memory _pools = new FarmPool[](_length);
        for (uint256 i = 0; i < _length; i++) {
            _pools[i] = poolInfo[poolIdsAt(i)];
        }
        return _pools;
    }

    function getPools(uint256 skip, uint256 limit) public view returns (FarmPool[] memory) {
        uint256 _length = poolLength();
        require(skip < _length, "Farming: invalid skip");
        uint256 _end = (skip + limit) > _length ? _length : (skip + limit);
        FarmPool[] memory _pools = new FarmPool[](_end - skip);
        for (uint256 i = skip; i < _end; i++) {
            _pools[i - skip] = poolInfo[poolIdsAt(i)];
        }
        return _pools;
    }

    function addPool(
        address _stakeToken,
        address _rewardToken,
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _endBlock,
        string memory _name
    ) public onlyOwner {
        require(_startBlock > block.number, "Farming: invalid start block");
        require(_endBlock > _startBlock, "Farming: invalid end block");

        require(IERC20Metadata(_rewardToken).decimals() == 18, "Farming: reward token decimals must be 18");
        require(IERC20Metadata(_stakeToken).decimals() == 18, "Farming: stake token decimals must be 18");

        uint256 _totalReward = _rewardPerBlock * (_endBlock - _startBlock);
        require(IERC20(_rewardToken).allowance(_msgSender(), address(this)) >= _totalReward, "Farming: not enough allowance");
        IERC20(_rewardToken).safeTransferFrom(_msgSender(), address(this), _totalReward);
        
        uint256 _pid = nextPoolId++;

        poolInfo[_pid] = FarmPool({
            id: _pid,
            stakeToken: IERC20(_stakeToken),
            rewardToken: IERC20(_rewardToken),
            rewardPerBlock: _rewardPerBlock,
            startBlock: _startBlock,
            endBlock: _endBlock,
            name: _name
        });

        poolIds.add(_pid);

        poolStakeInfo[_pid] = PoolStakeInfo({
            lastRewardBlock: _startBlock,
            accRewardPerShare: 0,
            totalStaked: 0
        });
    }

    function lastTimeRewardApplicable(uint256 _pid) public view returns (uint256) {
        return _min(poolInfo[_pid].endBlock, block.number);
    }

    function rewardPerToken(uint256 _pid) public view returns (uint256) {
        PoolStakeInfo memory pStakeInfo = poolStakeInfo[_pid];
        if (pStakeInfo.totalStaked == 0) {
            return pStakeInfo.accRewardPerShare;
        }

        FarmPool memory pool = poolInfo[_pid];

        return pStakeInfo.accRewardPerShare
            + (pool.rewardPerBlock * (lastTimeRewardApplicable(_pid) - pStakeInfo.lastRewardBlock) * 1e18)
                / pStakeInfo.totalStaked;
    }

    function _min(uint256 x, uint256 y) private pure returns (uint256) {
        return x <= y ? x : y;
    }
}