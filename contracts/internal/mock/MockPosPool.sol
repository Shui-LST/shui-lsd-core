//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0;

import {IPoSPool} from "../../interfaces/IPoSPool.sol";
import {VotePowerQueue} from "../../utils/VotePowerQueue.sol";
import {ParamsControl} from "@confluxfans/contracts/InternalContracts/ParamsControl.sol";
import {IVotingEscrow} from "../../interfaces/IVotingEscrow.sol";

contract MockPosPool is IPoSPool {
    /* ======= help variables and functions for test*/
    mapping(address => uint) public userInterests;
    mapping(address => UserSummary) private userSummaries;

    event EventIncreaseStake(uint256 votePower);
    event EventDecreaseStake(uint256 votePower);
    event EventWithdrawStake(uint256 votePower);
    event EventLockForVotePower(uint256 amount, uint256 unlockBlockNumber);
    event EventCastVote(uint64 vote_round, ParamsControl.Vote[] vote_data);

    receive() external payable {}

    function depositUserIntrest(address user) public payable {
        userInterests[user] = msg.value;
    }

    function setUserSummary(
        address user,
        UserSummary memory _userSummary
    ) public {
        userSummaries[user] = _userSummary;
    }

    /* ======= implementations =========*/

    function register(
        bytes32 indentifier,
        uint64 votePower,
        bytes calldata blsPubKey,
        bytes calldata vrfPubKey,
        bytes[2] calldata blsPubKeyProof
    ) external payable override {}

    function setPoolUserShareRatio(uint32 ratio) external override {}

    function setLockPeriod(uint64 period) external override {}

    function setPoolName(string memory name) external override {}

    function reStake(uint64 votePower) external override {}

    function poolSummary()
        external
        view
        override
        returns (PoolSummary memory)
    {}

    function poolAPY() external view override returns (uint32) {}

    function poolUserShareRatio() external view override returns (uint64) {}

    function poolName() external view override returns (string memory) {}

    function _poolLockPeriod() external view override returns (uint64) {}

    function increaseStake(uint64 votePower) external payable override {
        // userSummaries[msg.sender].locked += votePower;
        // userSummaries[msg.sender].votes += votePower;
        // userSummaries[msg.sender].available += votePower;
        emit EventIncreaseStake((votePower));
    }

    function decreaseStake(uint64 votePower) external override {
        // userSummaries[msg.sender].unlocked += votePower;
        // userSummaries[msg.sender].available -= votePower;
        // userSummaries[msg.sender].locked -= votePower;
        emit EventDecreaseStake((votePower));
    }

    function withdrawStake(uint64 votePower) external override {
        // userSummaries[msg.sender].unlocked -= votePower;
        // userSummaries[msg.sender].votes -= votePower;
        emit EventWithdrawStake((votePower));
    }

    function userInterest(
        address _address
    ) external view override returns (uint256) {
        return userInterests[_address];
    }

    function claimInterest(uint256 amount) external override {
        payable(msg.sender).transfer(amount);
    }

    function claimAllInterest() external override {}

    function userSummary(
        address _user
    ) external view override returns (UserSummary memory) {
        return userSummaries[_user];
    }

    function posAddress() external view override returns (bytes32) {}

    function userInQueue(
        address account
    ) external view override returns (VotePowerQueue.QueueNode[] memory) {}

    function userOutQueue(
        address account
    ) external view override returns (VotePowerQueue.QueueNode[] memory) {}

    function userInQueue(
        address account,
        uint64 offset,
        uint64 limit
    ) external view override returns (VotePowerQueue.QueueNode[] memory) {}

    function userOutQueue(
        address account,
        uint64 offset,
        uint64 limit
    ) external view override returns (VotePowerQueue.QueueNode[] memory) {}

    function lockForVotePower(
        uint256 amount,
        uint256 unlockBlockNumber
    ) external override {
        emit EventLockForVotePower(amount, unlockBlockNumber);
    }

    function castVote(
        uint64 vote_round,
        ParamsControl.Vote[] calldata vote_data
    ) external override {
        emit EventCastVote(vote_round, vote_data);
    }

    function userLockInfo(
        address user
    ) external view override returns (IVotingEscrow.LockInfo memory) {}

    function votingEscrow() external view override returns (address) {}

    function userVotePower(
        address user
    ) external view override returns (uint256) {}
}
