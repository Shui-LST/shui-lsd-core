// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {ParamsControl} from "@confluxfans/contracts/InternalContracts/ParamsControl.sol";
import {CrossSpaceCall} from "@confluxfans/contracts/InternalContracts/CrossSpaceCall.sol";
import {IPoSPool} from "../interfaces/IPoSPool.sol";
import {IPoSOracle} from "../interfaces/IPoSOracle.sol";
// import "hardhat/console.sol";

contract sCFXBridge is Ownable, Initializable {
    CrossSpaceCall internal CROSS_SPACE_CALL;
    ParamsControl internal PARAMS_CONTROL;
    uint256 public constant QUARTER_BLOCK_NUMBER = 2 * 3600 * 24 * 365 / 4; // 3 months
    uint256 public constant CFX_PER_VOTE = 1000 ether;
    uint256 public constant RATIO_BASE = 1000_000_000;

    IPoSPool internal posPoolInterface;
    address public posPoolAddr;
    address public sCFXAddr;

    IPoSOracle public posOracle;

    uint256 public aprPeriodCount;
    uint256 public poolShareRatio;
    uint256 public poolAccInterest;
    uint256 public maxRedeemLenPerCall;

    // voting escrow related states
    address public eSpaceVotingEscrow;
    mapping(uint256 => uint256) public globalLockAmount; // unlock block => amount (user total lock amount)
    mapping(uint64 => mapping(uint16 => uint256[3])) public poolVoteInfo;
    uint16 public totalTopic;
    address public shuiTreasury; // shui treasury address, which is a eSpace account

    function initialize() public initializer {
        _transferOwnership(_msgSender());
        CROSS_SPACE_CALL = CrossSpaceCall(0x0888000000000000000000000000000000000006);
        PARAMS_CONTROL = ParamsControl(0x0888000000000000000000000000000000000007);
        aprPeriodCount = 48;
        poolShareRatio = 100_000_000; // 10% fee
        maxRedeemLenPerCall = 30; // max length per minute
        totalTopic = 3;
    }

    function setShuiTreasury(address addr) public onlyOwner {
        shuiTreasury = addr;
    }

    function setTotalTopic(uint16 value) public onlyOwner{
        totalTopic = value;
    }

    function setPoSOracle(address addr) public onlyOwner {
        posOracle = IPoSOracle(addr);
    }

    function setPoolShareRatio(uint256 ratio) public onlyOwner {
        poolShareRatio = ratio;
    }

    function setEspaceVotingEscrow(address addr) public onlyOwner {
        eSpaceVotingEscrow = addr;
    }

    function setPoSPool(address poolAddress) public onlyOwner {
        posPoolAddr = poolAddress;
        posPoolInterface = IPoSPool(poolAddress);
    }

    function setESpacePool(address sCFXAddress) public onlyOwner {
        sCFXAddr = sCFXAddress;
    }

    /* function depositPoolInterest() public payable onlyOwner {
        poolAccInterest += msg.value;
    } */

    function withdrawPoolInterest(uint256 amount) public onlyOwner {
        require(amount <= poolAccInterest, "sCFXBridge: insufficient pool interest");
        require(amount <= address(this).balance, "sCFXBridge: insufficient balance");
        poolAccInterest -= amount;
        payable(owner()).transfer(amount);
    }
    
    function stakeableBalance() public view returns (uint256) {
        uint256 balance = _balance();
        if (balance <= poolAccInterest) return 0;
        balance -= poolAccInterest;
        uint256 _needRedeem = eSpacePoolTotalClaimed();
        if (balance <= _needRedeem) return 0;
        balance -= _needRedeem;
        return balance;
    }

    // reward rate of latest 'aprPeriodCount' period
    function poolPeriodRewardRate() public view returns (uint256) {
        uint256 posEpoch = posOracle.posEpochHeight();
        uint256 totalVotes;
        uint256 totalReward;

        if(posEpoch < aprPeriodCount) return 0;
            
        for (uint256 i = 1; i <= aprPeriodCount; i++) {
            uint256 epoch = posEpoch - i;
            
            uint256 reward = posOracle.getUserPoSReward(epoch, posPoolAddr);
            uint256 votes = posOracle.getUserVotes(epoch, posPoolAddr);
            
            if (votes == 0) continue; // skip empty epoch

            totalVotes += votes;
            totalReward += reward;
        }

        if(totalReward == 0|| totalVotes == 0) return 0;

        uint256 apr = (totalReward * RATIO_BASE) / (totalVotes * CFX_PER_VOTE);
        return apr;
    }

    function claimInterest() public onlyOwner {
        uint256 interest = poolInterest();
        if (interest == 0) return;
        uint256 poolShare = (interest * poolShareRatio) / RATIO_BASE;
        poolAccInterest += poolShare;
        eSpaceAddAssets(interest - poolShare);
        posPoolInterface.claimInterest(interest);

        sendPoolInterestToTreasury();
    }

    function sendPoolInterestToTreasury() internal {
        if (shuiTreasury == address(0)) return;
        uint256 _interest = poolAccInterest;
        if (_interest == 0) return;
        poolAccInterest = 0;
        CROSS_SPACE_CALL.transferEVM{value: _interest}(bytes20(shuiTreasury));
    }

    function stakeVotes() public onlyOwner {
        uint256 _amount = _balance();

        uint256 _needRedeem = eSpacePoolTotalClaimed();
        if (_amount <= _needRedeem) return;
        _amount -= _needRedeem;

        if (_amount <= poolAccInterest) return;
        _amount -= poolAccInterest;

        if (_amount < CFX_PER_VOTE) return;

        uint256 _vote = _amount / CFX_PER_VOTE;
        posPoolInterface.increaseStake{value: _vote * CFX_PER_VOTE}(uint64(_vote));
    }

    function unstakeVotes(uint64 _votes) public onlyOwner {
        IPoSPool.UserSummary memory userSummary = poolSummary();
        require(userSummary.locked >= _votes, "sCFXBridge: insufficient votes");
        posPoolInterface.decreaseStake(_votes);
    }

    function handleRedeem() public onlyOwner {
        // withdraw unlocked votes
        IPoSPool.UserSummary memory userSummary = poolSummary();
        if (userSummary.unlocked > 0) {
            posPoolInterface.withdrawStake(userSummary.unlocked);
        }

        // Use current balance handle redeem request
        uint256 rL = eSpaceRedeemLen();
        if (rL == 0) return;
        if (rL > maxRedeemLenPerCall) rL = maxRedeemLenPerCall;
        for (uint256 i = 0; i < rL; i++) {
            bool handled = handleFirstRedeem();
            if (!handled) break;
        }

        if (userSummary.locked == 0) return;

        uint256 totalRedeeming = eSpacePoolTotalClaimed();
        if (totalRedeeming == 0) return;

        // use total redeemed amount minus current unlocking votes, calculate need unstake votes
        uint256 unlocking = userSummary.votes - userSummary.available - userSummary.unlocked;

        if (unlocking * CFX_PER_VOTE + _balance() >= totalRedeeming) return;

        uint256 needUnstake = (totalRedeeming - unlocking * CFX_PER_VOTE) / CFX_PER_VOTE;
        if (totalRedeeming % CFX_PER_VOTE > 0) needUnstake += 1;

        if (needUnstake > userSummary.locked) needUnstake = userSummary.locked;

        posPoolInterface.decreaseStake(uint64(needUnstake));
    }

    function handleFirstRedeem() public onlyOwner returns (bool) {
        uint256 _amount = eSpaceFirstRedeemAmount();
        if (_balance() < _amount) return false;
        eSpaceHandleRedeem(_amount);
        return true;
    }

    function transferFromEspace(uint256 amount) public onlyOwner {
        require(mappedBalance() >= amount, "Not enough balance");
        CROSS_SPACE_CALL.withdrawFromMapped(amount);
    }

    function transferFromEspace() public onlyOwner {
        uint256 _amount = mappedBalance();
        CROSS_SPACE_CALL.withdrawFromMapped(_amount);
    }

    function poolInterest() public view returns (uint256) {
        uint256 interest = posPoolInterface.userInterest(address(this));
        return interest;
    }

    function poolSummary() public view returns (IPoSPool.UserSummary memory) {
        IPoSPool.UserSummary memory userSummary = posPoolInterface.userSummary(address(this));
        return userSummary;
    }

    function mappedBalance() public view returns (uint256) {
        return CROSS_SPACE_CALL.mappedBalance(address(this));
    }

    function _ePoolAddrB20() internal view returns (bytes20) {
        return bytes20(sCFXAddr);
    }

    function eSpaceAddAssets(uint256 amount) public onlyOwner {
        CROSS_SPACE_CALL.callEVM(_ePoolAddrB20(), abi.encodeWithSignature("addAssets(uint256)", amount));
    }

    function eSpaceHandleRedeem(uint256 amount) public onlyOwner {
        require(_balance() >= amount,"sCFXBridge: insufficient balance");
        CROSS_SPACE_CALL.callEVM{value: amount}(_ePoolAddrB20(), abi.encodeWithSignature("handleRedeem()"));
    }

    function eSpaceRedeemLen() public view returns (uint256) {
        bytes memory num = CROSS_SPACE_CALL.staticCallEVM(_ePoolAddrB20(), abi.encodeWithSignature("redeemLen()"));
        return abi.decode(num, (uint256));
    }

    function eSpaceFirstRedeemAmount() public view returns (uint256) {
        bytes memory num =
            CROSS_SPACE_CALL.staticCallEVM(_ePoolAddrB20(), abi.encodeWithSignature("firstRedeemAmount()"));
        return abi.decode(num, (uint256));
    }

    function eSpacePoolTotalClaimed() public view returns (uint256) {
        bytes memory num = CROSS_SPACE_CALL.staticCallEVM(_ePoolAddrB20(), abi.encodeWithSignature("totalClaimed()"));
        return abi.decode(num, (uint256));
    }

    function eSpacePoolStakerNumber() public view returns (uint256) {
        bytes memory num = CROSS_SPACE_CALL.staticCallEVM(_ePoolAddrB20(), abi.encodeWithSignature("stakerNumber()"));
        return abi.decode(num, (uint256));
    }

    function eSpacePoolTotalDeposited() public view returns (uint256) {
        bytes memory num = CROSS_SPACE_CALL.staticCallEVM(_ePoolAddrB20(), abi.encodeWithSignature("totalDeposited()"));
        return abi.decode(num, (uint256));
    }

    function eSpacePoolTotalSupply() public view returns (uint256) {
        bytes memory num = CROSS_SPACE_CALL.staticCallEVM(_ePoolAddrB20(), abi.encodeWithSignature("totalSupply()"));
        return abi.decode(num, (uint256));
    }

    function _ePoolVotingAddrB20() internal view returns (bytes20) {
        return bytes20(eSpaceVotingEscrow);
    }

    function eSpaceVotingLastUnlockBlock() public view returns (uint256) {
        bytes memory num =
            CROSS_SPACE_CALL.staticCallEVM(_ePoolVotingAddrB20(), abi.encodeWithSignature("lastUnlockBlock()"));
        return abi.decode(num, (uint256));
    }

    function eSpaceVotingGlobalLockAmount(uint256 lockBlock) public view returns (uint256) {
        bytes memory num = CROSS_SPACE_CALL.staticCallEVM(
            _ePoolVotingAddrB20(), abi.encodeWithSignature("globalLockAmount(uint256)", lockBlock)
        );
        return abi.decode(num, (uint256));
    }

    function eSpaceVotingPoolVoteInfo(uint64 round, uint16 topic) public view returns (uint256[3] memory) {
        bytes memory votes = CROSS_SPACE_CALL.staticCallEVM(
            _ePoolVotingAddrB20(), abi.encodeWithSignature("getPoolVoteInfo(uint64,uint16)", round, topic)
        );
        return abi.decode(votes, (uint256[3]));
    }

    function isLockInfoChanged() public view returns (bool) {
        uint256 lastUnlockBlock = eSpaceVotingLastUnlockBlock();
        // max lock period is 1 year, so the max loop times is 4
        while (lastUnlockBlock > block.number) {
            uint256 amount = eSpaceVotingGlobalLockAmount(lastUnlockBlock);
            if (globalLockAmount[lastUnlockBlock] != amount) {
                return true;
            }
            
            if(lastUnlockBlock < QUARTER_BLOCK_NUMBER){
                return false;
            }
            lastUnlockBlock -= QUARTER_BLOCK_NUMBER;
        }
        return false;
    }

    function syncLockInfo() public {
        uint256 unlockBlock = eSpaceVotingLastUnlockBlock();
        uint256 accLockAmount = 0;
        // max lock period is 1 year, so the max loop times is 4
        while (unlockBlock > block.number) {
            uint256 amount = eSpaceVotingGlobalLockAmount(unlockBlock);
            globalLockAmount[unlockBlock] = amount;
            
            accLockAmount += amount;
            posPoolInterface.lockForVotePower(accLockAmount, unlockBlock);

            
            if(unlockBlock < QUARTER_BLOCK_NUMBER){
                return;
            }
            unlockBlock -= QUARTER_BLOCK_NUMBER;
        }
    }

    function isVoteInfoChanged() public view returns (bool) {
        uint64 round = PARAMS_CONTROL.currentRound();
        uint16 topic = 0;
        while (topic < totalTopic) {
            uint256[3] memory votes = eSpaceVotingPoolVoteInfo(round, topic);
            if (!isVotesEqual(votes, poolVoteInfo[round][topic])) {
                return true;
            }
            topic++;
        }
        return false;
    }

    function syncVoteInfo() public {
        uint64 round = PARAMS_CONTROL.currentRound();
        uint16 topic = 0;
        while (topic < totalTopic) {
            uint256[3] memory votes = eSpaceVotingPoolVoteInfo(round, topic);
            if (!isVotesEqual(votes, poolVoteInfo[round][topic])) {
                poolVoteInfo[round][topic] = votes;

                ParamsControl.Vote[] memory structVotes = new ParamsControl.Vote[](1);
                structVotes[0] = ParamsControl.Vote(topic, votes);
                posPoolInterface.castVote(round, structVotes);
            }
            topic++;
        }
    }

    function isVotesEqual(uint256[3] memory votes1, uint256[3] memory votes2) public pure returns (bool) {
        return votes1[0] == votes2[0] && votes1[1] == votes2[1] && votes1[2] == votes2[2];
    }

    /* function transferToEspacePool(uint256 amount) public onlyOwner {
        require(amount <= _balance(), "Not enough balance");
        CROSS_SPACE_CALL.transferEVM{value: amount}(_ePoolAddrB20());
    }

    function transferToEspacePool() public onlyOwner {
        uint256 _amount = _balance();
        CROSS_SPACE_CALL.transferEVM{value: _amount}(_ePoolAddrB20());
    } */

    function _balance() internal view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}
}
