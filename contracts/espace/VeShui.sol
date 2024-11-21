// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

contract veShui is Ownable, Initializable {
    using EnumerableSet for EnumerableSet.AddressSet; // Add the library methods
    using EnumerableSet for EnumerableSet.UintSet;

    uint public constant ONE_YEAR = 365 days;
    uint public constant PERIOD_YEAR = 100; // Denominator for calculating lock time, e.g. period of 100 means 1 year

    IERC20 public shuiToken; // SHUI token interface

    struct Lock {
        address user;
        uint256 amount; // Amount of SHUI locked
        uint256 veShuiAmount; // Amount of veShui received for the lock
        uint64 lockDay; // Lock date
        uint64 unlockDay; // Unlock date
        bool isHandledUnlock; // true means the amount has been counted into user's unlocked amount, but the lastSettleDay may be less than unlock time, so this object may not be deleted yet
        bool isHandledLock; // true means veShuiAmount has been added to user's total veShui
    }

    struct UserInfo {
        EnumerableSet.UintSet locks;
        uint256 userRewardPerTokenPaid;
        uint256 reward;
        uint256 unlockedShui;
        uint256 totalVeShui;
    }

    mapping(uint256 => Lock) public locks; //  index => lock
    uint256 locksNextIndex;

    mapping(uint256 => uint256[]) public dayLocks; // lock_date => lock_indexs
    mapping(uint256 => EnumerableSet.AddressSet) dayLockUsers; // date => lock_users

    mapping(uint256 => uint256[]) public dayUnlocks; // unlock_date => lock_indexs
    mapping(uint256 => EnumerableSet.AddressSet) dayUnlockUsers; // date => unlock_users

    EnumerableSet.AddressSet users;
    mapping(address => UserInfo) userInfos; // user => user_info

    uint256 private totalVeShui;
    uint256 private totalLocked;
    uint256 public accRewardPerVeShui; // Actual accumulated reward per veShui is accRewardPerVeShui/1e18
    uint256 public lastSettleDay; // The most recent date for processing unlocks and settlements. Updates: UserInfo.userRewardPerTokenPaid+reward+locks+totalVeShui+unlockedShui / accRewardPerVeShui/ remove expired dayUnlockUsers/totalVeShui/ remove expired locks/ remove expired dayUnlocks/ remove expired UserInfo locks
    uint256 public aprOnLastSettleDay; // Unit: cfxPerVeShui

    event Locked(uint indexed lockIndex, address indexed user, uint256 amount, uint256 veShuiAmount, uint256 unlockDay);
    event Unlocked(address indexed user, uint256 amount);
    event Withdrawed(address indexed user, uint256 reward);
    event Claimed(address indexed user, uint256 reward);
    event CFXDeposited(uint256 amount);

    constructor() {
        _disableInitializers();
    }

    function initialize(address _shuiToken) public initializer {
        _transferOwnership(_msgSender());
        shuiToken = IERC20(_shuiToken);
        lastSettleDay = date(block.timestamp);
    }

    function lock(uint256 _amount, uint256 _lockPeriod) external {
        require(_amount > 0, "Amount must be greater than 0");
        if (!users.contains(msg.sender)) {
            users.add(msg.sender);
        }
        saveLock(_amount, _lockPeriod);
    }

    function saveLock(uint256 _amount, uint256 _lockPeriod) internal returns (uint) {
        uint256 veShuiAmount = calculateVeShui(_amount, _lockPeriod);
        uint64 lockDay = calcLockDate(block.timestamp);
        uint64 unlockDay = calcUnlockDate(block.timestamp, _lockPeriod);

        shuiToken.transferFrom(msg.sender, address(this), _amount);
        Lock memory _lock = Lock(msg.sender, _amount, veShuiAmount, lockDay, unlockDay, false, false);

        uint256 lockIndex = locksNextIndex;
        locks[lockIndex] = _lock;
        locksNextIndex++;

        dayLocks[_lock.lockDay].push(lockIndex);
        dayLockUsers[_lock.lockDay].add(_lock.user);

        dayUnlocks[_lock.unlockDay].push(lockIndex);
        dayUnlockUsers[_lock.unlockDay].add(_lock.user);

        userInfos[msg.sender].locks.add(lockIndex);
        totalLocked += _amount;

        emit Locked(lockIndex, msg.sender, _amount, veShuiAmount, unlockDay);

        return lockIndex;
    }

    function depositProfit() public payable onlyOwner {
        require(msg.value > 0, "Amount must be greater than 0");

        uint256 today = date(block.timestamp);
        require(today > lastSettleDay, "Already settled for today");

        processPendingLocksAndDistributeRewards(msg.value, today);
        emit CFXDeposited(msg.value);
    }

    // Distribute rewards before 00:00 every day by default, so rewards are from lastSettleDay to today.
    function processPendingLocksAndDistributeRewards(uint256 _amount, uint256 endDay) private {
        uint256[] memory dayTotalVeshuis = new uint256[](endDay - lastSettleDay);

        uint startDay = lastSettleDay + 1;

        for (uint256 day = startDay; day <= endDay; day++) {
            handleLocksOfDay(day);
            uint256 dayTotalVeshui = handleUnlocksOfDay(day);
            dayTotalVeshuis[day - startDay] = dayTotalVeshui;
        }

        uint256 validDayNum = 0;
        for (uint256 i = 0; i < dayTotalVeshuis.length; i++) {
            if (dayTotalVeshuis[i] > 0) {
                validDayNum++;
            }
        }

        require(validDayNum > 0, "No valid veShui from last settle day to today");

        uint256 dayProfit = _amount / validDayNum;

        for (uint256 day = startDay; day <= endDay; day++) {
            handleProfitOfDay(day, dayTotalVeshuis[day - startDay], dayProfit);
        }
    }

    function handleLocksOfDay(uint day) private returns (uint256) {
        uint256[] memory _dayLocks = dayLocks[day];
        for (uint256 i = 0; i < _dayLocks.length; i++) {
            uint256 lockIndex = _dayLocks[i];
            Lock memory _lock = locks[lockIndex];

            if (!_lock.isHandledLock) {
                userInfos[_lock.user].totalVeShui += _lock.veShuiAmount;
                totalVeShui += _lock.veShuiAmount;
                locks[lockIndex].isHandledLock = true; // storage
            }
        }
        delete dayLocks[day];
        return totalVeShui;
    }

    // After handling unlocks, return the totalVeShui of the day, used to calculate dayProfit.
    // dayProfit = profit / number of days with non-zero veShui
    // Each day's accCFXPerVeShui += profit / totalVeShui of that day
    function handleUnlocksOfDay(uint day) private returns (uint256) {
        uint256[] memory todayUnlocks = dayUnlocks[day];
        for (uint256 i = 0; i < todayUnlocks.length; i++) {
            uint256 lockIndex = todayUnlocks[i];
            Lock memory _lock = locks[lockIndex];

            unlockShuiButNotReleaseVeShui(lockIndex);
            releaseVeshui(_lock);

            delete locks[lockIndex];
            userInfos[_lock.user].locks.remove(lockIndex);
        }
        delete dayUnlocks[day];

        return totalVeShui;
    }

    function unlockShuiButNotReleaseVeShui(uint lockIndex) private {
        Lock memory _lock = locks[lockIndex];
        if (!_lock.isHandledUnlock) {
            userInfos[_lock.user].unlockedShui += _lock.amount;
            totalLocked -= _lock.amount;
            locks[lockIndex].isHandledUnlock = true;
        }
    }

    function releaseVeshui(Lock memory _lock) private {
        userInfos[_lock.user].totalVeShui -= _lock.veShuiAmount;
        totalVeShui -= _lock.veShuiAmount;
    }

    function handleProfitOfDay(uint day, uint dayTotalVeshui, uint256 profit) private {
        if (dayTotalVeshui == 0) {
            require(profit == 0, "Profit must be 0 when dayTotalVeshui is 0");
        } else {
            accRewardPerVeShui += (profit * 1e18) / dayTotalVeshui;
        }

        address[] memory todayLockUsers = dayLockUsers[day].values();
        for (uint i = 0; i < todayLockUsers.length; i++) {
            settleUser(todayLockUsers[i]);
        }
        delete dayLockUsers[day];

        address[] memory todayUnlockUsers = dayUnlockUsers[day].values();
        for (uint i = 0; i < todayUnlockUsers.length; i++) {
            settleUser(todayUnlockUsers[i]);
        }
        delete dayUnlockUsers[day];

        lastSettleDay = day;
        aprOnLastSettleDay = (profit * 1e18 * 365) / totalVeShui;
    }

    function settleUser(address user) private {
        userInfos[user].reward += (userInfos[user].totalVeShui * (accRewardPerVeShui - userInfos[user].userRewardPerTokenPaid)) / 1e18;
        userInfos[user].userRewardPerTokenPaid = accRewardPerVeShui;
    }

    function withdraw() external {
        uint today = date(block.timestamp);
        uint256[] memory lockIndexes = userInfos[msg.sender].locks.values();

        for (uint256 i = 0; i < lockIndexes.length; i++) {
            uint256 lockIndex = lockIndexes[i];
            if (locks[lockIndex].unlockDay <= today) {
                unlockShuiButNotReleaseVeShui(lockIndex);
            }
        }

        require(userInfos[msg.sender].unlockedShui > 0, "No unlocked shui");

        uint256 userUnlockedShui = userInfos[msg.sender].unlockedShui;
        userInfos[msg.sender].unlockedShui = 0;
        shuiToken.transfer(msg.sender, userUnlockedShui);

        emit Withdrawed(msg.sender, userUnlockedShui);
    }

    function claim() external {
        settleUser(msg.sender);
        require(userInfos[msg.sender].reward > 0, "No reward");

        uint256 reward = userInfos[msg.sender].reward;
        userInfos[msg.sender].reward = 0;
        payable(msg.sender).transfer(reward);

        emit Claimed(msg.sender, reward);
    }

    function getUserInfo(address _user) public view returns (Lock[] memory, uint, uint, uint) {
        uint256[] memory lockIndexes = userInfos[_user].locks.values();
        Lock[] memory userLocks = new Lock[](lockIndexes.length);
        for (uint256 i = 0; i < lockIndexes.length; i++) {
            userLocks[i] = locks[lockIndexes[i]];
        }

        uint reward = userInfos[_user].reward;
        uint unlockedShui = userInfos[_user].unlockedShui;
        uint totalVeShuiLastSettleDay = userInfos[_user].totalVeShui;
        uint totalVeShuiToday = totalVeShuiLastSettleDay;

        uint today = date(block.timestamp);
        for (uint256 i = 0; i < lockIndexes.length; i++) {
            uint256 lockIndex = lockIndexes[i];

            if (locks[lockIndex].lockDay <= today && !locks[lockIndex].isHandledLock) {
                totalVeShuiToday += locks[lockIndex].veShuiAmount;
            }

            if (locks[lockIndex].unlockDay <= today && !locks[lockIndex].isHandledUnlock) {
                unlockedShui += locks[lockIndex].amount;
                totalVeShuiToday -= locks[lockIndex].veShuiAmount;
            }
        }

        reward += (totalVeShuiLastSettleDay * (accRewardPerVeShui - userInfos[_user].userRewardPerTokenPaid)) / 1e18;

        return (userLocks, reward, unlockedShui, totalVeShuiToday);
    }

    /// @return usersLength Number of users
    /// @return _totalVeShui Current total veShui amount
    /// @return _totalLocked Current total locked amount
    /// @return accRewardPerVeShui Current accCFXPerVeShui (average APR)
    /// @return lastSettleDay Last settlement date
    /// @return aprOnLastSettleDay APR on last settlement date
    function summary() public view returns (uint256, uint256, uint256, uint256, uint256, uint256) {
        uint _totalVeShui = totalVeShui;
        uint _totalLocked = totalLocked;

        uint today = date(block.timestamp);
        for (uint day = lastSettleDay + 1; day <= today; day++) {
            uint256[] memory _dayLocks = dayLocks[day];
            for (uint i = 0; i < _dayLocks.length; i++) {
                if (!locks[_dayLocks[i]].isHandledLock) {
                    _totalVeShui += locks[_dayLocks[i]].veShuiAmount;
                }
            }

            uint256[] memory _dayUnlocks = dayUnlocks[day];
            for (uint i = 0; i < _dayUnlocks.length; i++) {
                if (!locks[_dayUnlocks[i]].isHandledUnlock) {
                    _totalVeShui -= locks[_dayUnlocks[i]].veShuiAmount;
                    _totalLocked -= locks[_dayUnlocks[i]].amount;
                }
            }
        }

        return (users.length(), _totalVeShui, _totalLocked, accRewardPerVeShui, lastSettleDay, aprOnLastSettleDay);
    }

    function getDayLocks(uint256 day) public view returns (uint256[] memory) {
        return dayLocks[day];
    }

    function getDayLockUsers(uint256 day) public view returns (address[] memory) {
        return dayLockUsers[day].values();
    }

    function getDayUnlocks(uint256 day) public view returns (uint256[] memory) {
        return dayUnlocks[day];
    }

    function getDayUnlockUsers(uint256 day) public view returns (address[] memory) {
        return dayUnlockUsers[day].values();
    }

    function calculateVeShui(uint256 _amount, uint256 _lockPeriod) public pure returns (uint256) {
        require(_lockPeriod == 50 || _lockPeriod == 100 || _lockPeriod == 200 || _lockPeriod == 400, "Invalid lock period");
        return (_amount * _lockPeriod) / 4 / PERIOD_YEAR;
    }

    function calcUnlockDate(uint256 lockTime, uint256 lockPeriod) public pure returns (uint64) {
        uint unlockTime = lockTime + ((lockPeriod * ONE_YEAR) / PERIOD_YEAR);
        return uint64(date(unlockTime) + 1);
    }

    function calcLockDate(uint256 lockTime) public pure returns (uint64) {
        return uint64(date(lockTime) + 1);
    }

    function date(uint256 timeStamp) public pure returns (uint256) {
        return timeStamp / 1 days;
    }
}
