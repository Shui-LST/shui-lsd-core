// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {ISCFX} from "../interfaces/ISCFX.sol";
import {ICoreSpaceInfo} from "../interfaces/ICoreSpaceInfo.sol";

import {IVotingEscrow} from "../interfaces/IVotingEscrow.sol";
import {ParamsControl} from "@confluxfans/contracts/InternalContracts/ParamsControl.sol";

contract EVotingEscrow is IVotingEscrow, Ownable, Initializable {
    using EnumerableSet for EnumerableSet.AddressSet; // Add the library methods

    struct VoteMeta {
        uint256 availablePower;
    }

    event VoteLock(address indexed user, uint256 indexed amount, uint256 indexed unlockBlock);
    // event CastVote(address indexed user, uint256 indexed round, uint256 indexed topicIndex, uint256[3] votes);

    uint256 private constant ONE_DAY_BLOCK_NUMBER = 2 * 3600 * 24;
    uint256 public constant QUARTER_BLOCK_NUMBER = ONE_DAY_BLOCK_NUMBER * 365 / 4; // 3 months

    ISCFX public sCFX; // sCFX token

    // The core space chain info oracle contract, which's data is maintained by Conflux Team
    ICoreSpaceInfo public coreSpaceInfo;
    //
    uint256 public lastUnlockBlock;
    // unlock block => amount (user total lock amount)
    mapping(uint256 => uint256) public globalLockAmount;
    //
    mapping(address => LockInfo) internal _userLockInfo;
    // round => user => topic => votes
    mapping(uint64 => mapping(address => mapping(uint16 => uint256[3]))) internal userVoteInfo;
    // round => topic => votes
    mapping(uint64 => mapping(uint16 => uint256[3])) public poolVoteInfo;
    // round => user => topic => meta
    mapping(uint64 => mapping(address => mapping(uint16 => VoteMeta))) internal userVoteMeta;
    // round => topic => users
    mapping(uint64 => mapping(uint16 => EnumerableSet.AddressSet)) internal topicSpecialVoters; // voters who's vote power maybe will change at round end block
    //
    mapping(address => uint256) public stakedAmount;
    // user staked sCFX amount


    function initialize() public initializer {
        _transferOwnership(_msgSender());
    }

    function setSCFX(address scfxAddr) public onlyOwner {
        sCFX = ISCFX(scfxAddr);
    }

    function setCoreSpaceInfo(address coreSpaceInfoAddr) public onlyOwner {
        coreSpaceInfo = ICoreSpaceInfo(coreSpaceInfoAddr);
    }

    function coreVoteRound() public view returns (uint64) {
        return coreSpaceInfo.currentVoteRound();
    }

    function coreBlockNumber() public view returns (uint256) {
        return coreSpaceInfo.blockNumber();
    }

    // available staked amount
    function userStakableAmount(address user) public view returns (uint256) {
        return _scfxToCfx(sCFX.balanceOf(user));
    }

    /*
        @param amount: sCFX amount
        @param unlockBlock: core space unlock block number
    */
    function createLock(uint256 amount, uint256 unlockBlock) public {
        require(_userLockInfo[msg.sender].unlockBlock < coreBlockNumber(), "Governance: already locked");
        require(stakedAmount[msg.sender] == 0, "Governance: already locked"); // need to withdraw existing staked amount first
        require(unlockBlock - coreBlockNumber() > QUARTER_BLOCK_NUMBER, "Governance: unlock block too close");
        
        uint256 realUnlockBlock = _adjustBlockNumber(unlockBlock);

        require(amount> 0,"Governance: amount must be positive");
        require(amount <= sCFX.balanceOf(msg.sender), "Governance: insufficient balance");
        require(sCFX.allowance(msg.sender, address(this)) >= amount, "sCFX allowance not enough");

        bool success = sCFX.transferFrom(msg.sender, address(this), amount);
        require(success, "sCFX transfer failed");
        stakedAmount[msg.sender] += amount;

        uint256 _lockAmount = _scfxToCfx(amount);

        _userLockInfo[msg.sender] = LockInfo(_lockAmount, realUnlockBlock);
        globalLockAmount[realUnlockBlock] += _lockAmount;

        _updateLastUnlockBlock(realUnlockBlock);
    }

    /*
        @param amount: sCFX amount
    */
    function increaseLock(uint256 amount) public {
        require(_userLockInfo[msg.sender].amount > 0, "Governance: not locked");
        require(_userLockInfo[msg.sender].unlockBlock > coreBlockNumber(), "Governance: already unlocked");
        require(amount > 0, "Governance: amount must be positive");
        require(
            amount <= sCFX.balanceOf(msg.sender), "Governance: insufficient balance"
        );
        require(sCFX.allowance(msg.sender, address(this)) >= amount, "sCFX allowance not enough");

        bool success = sCFX.transferFrom(msg.sender, address(this), amount);
        require(success, "sCFX transfer failed");
        stakedAmount[msg.sender] += amount;

        uint256 _lockAmount = _scfxToCfx(amount);
        uint256 unlockBlock = _userLockInfo[msg.sender].unlockBlock;
        _userLockInfo[msg.sender].amount += _lockAmount;
        globalLockAmount[unlockBlock] += _lockAmount;
    }

    function extendLockTime(uint256 unlockBlock) public {
        require(_userLockInfo[msg.sender].amount > 0, "Governance: not locked");
        require(_userLockInfo[msg.sender].unlockBlock > coreBlockNumber(), "Governance: already unlocked");
        require(unlockBlock > _userLockInfo[msg.sender].unlockBlock, "Governance: invalid unlock block");

        uint256 realUnlockBlock = _adjustBlockNumber(unlockBlock);

        uint256 oldUnlockNumber = _userLockInfo[msg.sender].unlockBlock;
        uint256 amount = _userLockInfo[msg.sender].amount;

        _userLockInfo[msg.sender].unlockBlock = realUnlockBlock;
        
        globalLockAmount[oldUnlockNumber] -= amount;
        globalLockAmount[realUnlockBlock] += amount;

        _updateLastUnlockBlock(realUnlockBlock);
    }

    function withdraw(uint256 amount) public {
        uint256 unlockBlock = _userLockInfo[msg.sender].unlockBlock;
        require(unlockBlock <= coreBlockNumber(), "Governance: not unlocked");
        require(stakedAmount[msg.sender] >= amount, "Governance: insufficient balance");

        sCFX.transfer(msg.sender, amount);
        stakedAmount[msg.sender] -= amount;
        
        delete _userLockInfo[msg.sender];
        globalLockAmount[unlockBlock] = 0; // as the lock period is expired, so we directly set it to 0
    }

    function userVotePower(address user, uint256 blockNumber) public view returns (uint256) {
        if (_userLockInfo[user].unlockBlock < blockNumber) {
            return 0;
        }
        uint256 period = (_userLockInfo[user].unlockBlock - blockNumber) / QUARTER_BLOCK_NUMBER;
        // full vote power if period >= 4
        if (period > 4) {
            period = 4;
        }
        if (period == 3) {
            // no 0.75
            period = 2;
        }
        return _userLockInfo[user].amount * period / 4;
    }

    function userVotePower(address user) public view returns (uint256) {
        return userVotePower(user, coreBlockNumber());
    }

    function userLockInfo(address user, uint256 blockNumber) public view returns (LockInfo memory) {
        LockInfo memory info = _userLockInfo[user];
        if (info.unlockBlock < blockNumber) {
            info.amount = 0;
            info.unlockBlock = 0;
        }
        return info;
    }

    function userLockInfo(address user) public view returns (LockInfo memory) {
        return userLockInfo(user, coreBlockNumber());
    }

    function castVote(uint64 vote_round, uint16 topic_index, uint256[3] memory votes) public {
        require(_onlyOneVote(votes), "Only one vote is allowed");
        require(vote_round == coreVoteRound(), "Governance: invalid vote round");
        uint256 totalVotes = _sumVote(votes);
        require(userVotePower(msg.sender) >= totalVotes, "Governance: insufficient vote power");

        // if one user's vote power maybe will change, add it to topicSpecialVoters
        if (userVotePower(msg.sender, _currentRoundEndBlock()) < totalVotes) {
            topicSpecialVoters[vote_round][topic_index].add(msg.sender);
            userVoteMeta[vote_round][msg.sender][topic_index] = VoteMeta(totalVotes);
        }


        // update userVoteInfo and poolVoteInfo
        for (uint16 i = 0; i < votes.length; i++) {
            uint256 lastVote = userVoteInfo[vote_round][msg.sender][topic_index][i];

            if (votes[i] > lastVote) {
                uint256 delta = votes[i] - lastVote;
                poolVoteInfo[vote_round][topic_index][i] += delta;
            } else {
                uint256 delta = lastVote - votes[i];
                poolVoteInfo[vote_round][topic_index][i] -= delta;
            }

            userVoteInfo[vote_round][msg.sender][topic_index][i] = votes[i];
        }

        // update users who's vote power have changed
        for (uint256 i = 0; i < topicSpecialVoters[vote_round][topic_index].length(); i++) {
            address addr = topicSpecialVoters[vote_round][topic_index].at(i);
            if (addr == msg.sender) continue;
            // uint256 lastBlockNumber = userVoteMeta[vote_round][addr][topic_index].blockNumber;
            uint256 lastPower = userVoteMeta[vote_round][addr][topic_index].availablePower;
            uint256 currentPower = userVotePower(addr);
            if (lastPower > currentPower) {
                // update userVoteInfo and poolVoteInfo
                uint256 delta = lastPower - currentPower;
                uint256 index = _findVoteIndex(userVoteInfo[vote_round][addr][topic_index]);
                userVoteInfo[vote_round][addr][topic_index][index] -= delta;
                poolVoteInfo[vote_round][topic_index][index] -= delta;
                // remove or update userVoteMeta
                if (currentPower == userVotePower(addr, _currentRoundEndBlock())) {
                    topicSpecialVoters[vote_round][topic_index].remove(msg.sender);
                    delete userVoteMeta[vote_round][addr][topic_index];
                } else {
                    userVoteMeta[vote_round][addr][topic_index] = VoteMeta(currentPower);
                }
            }
        }

        emit CastVote(msg.sender, vote_round, topic_index, votes);
    }

    function readVote(address addr, uint16 topicIndex) public view returns (ParamsControl.Vote memory) {
        ParamsControl.Vote memory vote = ParamsControl.Vote(topicIndex, userVoteInfo[coreVoteRound()][addr][topicIndex]);
        return vote;
    }

    function getPoolVoteInfo(uint64 round, uint16 topicIndex) public view returns (uint256[3] memory) {
        return poolVoteInfo[round][topicIndex];
    }

    function _scfxToCfx(uint256 amount) internal view returns (uint256) {
        return amount * sCFX.ratioDepositedBySupply() / 1e9;
    }

    function _currentRoundEndBlock() internal view returns (uint256) {
        return _onChainDaoStartBlock() + coreVoteRound() * ONE_DAY_BLOCK_NUMBER * 60;
    }

    function _onChainDaoStartBlock() internal view returns (uint256) {
        uint256 cid = _getChainID();
        if (cid == 1) {
            return 112400000;
        } else if (cid == 1029) {
            return 133800000;
        } else if (cid == 8888) {
            return 100000; // maybe will change
        }
        return 0;
    }

    function _getChainID() internal view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }

        // convert to core chain id
        if (id == 71) id = 1;
        if (id == 1030) id = 1029;

        return id;
    }

    function _updateLastUnlockBlock(uint256 unlockBlock) internal {
        if (unlockBlock > lastUnlockBlock) {
            lastUnlockBlock = unlockBlock;
        }
    }

    // internal functions
    function _adjustBlockNumber(uint256 blockNumber) internal pure returns (uint256) {
        uint256 adjusted = (blockNumber / QUARTER_BLOCK_NUMBER) * QUARTER_BLOCK_NUMBER;

        // if not divide exactly
        if (adjusted < blockNumber) {
            return adjusted + QUARTER_BLOCK_NUMBER;
        }

        return adjusted;
    }

    function _sumVote(uint256[3] memory votes) internal pure returns (uint256) {
        uint256 totalVotes = 0;
        for (uint16 i = 0; i < 3; i++) {
            totalVotes += votes[i];
        }
        return totalVotes;
    }

    function _onlyOneVote(uint256[3] memory votes) internal pure returns (bool) {
        uint256 count = 0;
        for (uint16 i = 0; i < 3; i++) {
            if (votes[i] > 0) {
                count++;
            }
        }
        return count == 1;
    }

    function _findVoteIndex(uint256[3] memory votes) internal pure returns (uint256) {
        for (uint16 i = 0; i < 3; i++) {
            if (votes[i] > 0) {
                return i;
            }
        }
        return votes.length; // no index found, should never happen
    }
}
