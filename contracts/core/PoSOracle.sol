// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ConfluxContext} from "@confluxfans/contracts/InternalContracts/ConfluxContext.sol";
import {PoSRegister} from "@confluxfans/contracts/InternalContracts/PoSRegister.sol";
import {IPoSOracle} from "../interfaces/IPoSOracle.sol";

contract PoSOracle is Ownable, IPoSOracle {
    ConfluxContext constant CFX_CONTEXT = ConfluxContext(0x0888000000000000000000000000000000000004);
    PoSRegister constant POS_REGISTER = PoSRegister(0x0888000000000000000000000000000000000005);

    uint256 public posEpochHeight; // PoS epoch height
    mapping(bytes32 => IPoSOracle.PoSAccountInfo) private _posAccountCurrentInfos; // posAccount => PoSAccountInfo
    mapping(uint256 => mapping(address => IPoSOracle.RewardInfo)) private _rewardInfos; // epochNumber => (powAccount => RewardInfo)
    mapping(uint256 => mapping(address => uint256)) private _userVoteInfos; // epochNumber => (powAccount => availableVotes)

    /**
     * @dev update account current, user vote info, pos epoch height
     * @param account pos address
     * @param epochNumber pos epoch number
     * @param blockNumber  pos block number
     * @param availableVotes available votes
     * @param unlocked unlocked votes
     * @param locked locked votes
     * @param forfeited pos node forfeited votes
     * @param forceRetired is pos node force retired
     * @param inQueue node in queue info
     * @param outQueue node out queue info
     */
    function updatePoSAccountInfo(
        bytes32 account,
        uint256 epochNumber,
        uint256 blockNumber,
        uint256 availableVotes,
        uint256 unlocked,
        uint256 locked,
        uint256 forfeited,
        bool forceRetired,
        IPoSOracle.VoteInfo[] memory inQueue,
        IPoSOracle.VoteInfo[] memory outQueue
    ) public onlyOwner {
        _posAccountCurrentInfos[account].availableVotes = availableVotes;
        _posAccountCurrentInfos[account].unlocked = unlocked;
        _posAccountCurrentInfos[account].locked = locked;
        _posAccountCurrentInfos[account].forfeited = forfeited;
        _posAccountCurrentInfos[account].forceRetired = forceRetired;
        _posAccountCurrentInfos[account].blockNumber = blockNumber;
        _posAccountCurrentInfos[account].epochNumber = epochNumber;

        delete _posAccountCurrentInfos[account].inQueue;
        for (uint256 i = 0; i < inQueue.length; i++) {
            _posAccountCurrentInfos[account].inQueue.push(inQueue[i]);
        }
        delete _posAccountCurrentInfos[account].outQueue;
        for (uint256 i = 0; i < outQueue.length; i++) {
            _posAccountCurrentInfos[account].outQueue.push(outQueue[i]);
        }

        // update userVoteInfos
        address _addr = POS_REGISTER.identifierToAddress(account);
        _userVoteInfos[epochNumber][_addr] = availableVotes;

        // update posEpochHeight
        updatePoSEpochHeight(epochNumber);
    }

    function updatePoSRewardInfo(uint256 epoch, address powAddress, bytes32 posAddress, uint256 reward)
        public
        onlyOwner
    {
        _rewardInfos[epoch][powAddress].posAddress = posAddress;
        _rewardInfos[epoch][powAddress].powAddress = powAddress;
        _rewardInfos[epoch][powAddress].reward = reward;
    }

    function updatePoSEpochHeight(uint256 latestPoSEpochHeight) public onlyOwner {
        posEpochHeight = latestPoSEpochHeight;
    }

    function updateUserVotes(uint256 epoch, address powAddr, uint256 availableVotes) public onlyOwner {
        _userVoteInfos[epoch][powAddr] = availableVotes;
        // update posEpochHeight
        updatePoSEpochHeight(epoch);
    }

    function getPoSAccountInfo(bytes32 posAddr) public view returns (IPoSOracle.PoSAccountInfo memory) {
        return _posAccountCurrentInfos[posAddr];
    }

    /**
     * @dev get latest PoS account info by pow address
     */
    function getPoSAccountInfo(address powAddr) public view returns (IPoSOracle.PoSAccountInfo memory) {
        bytes32 addr = POS_REGISTER.addressToIdentifier(powAddr);
        return _posAccountCurrentInfos[addr];
    }

    /**
     * @dev get user PoS reward info at specific epoch by pow address
     */
    function getUserPoSReward(uint256 epoch, address powAddr) public view returns (uint256) {
        return _rewardInfos[epoch][powAddr].reward;
    }

    /**
     * @dev get user PoS available votes at specific epoch by pow address
     */
    function getUserVotes(uint256 epoch, address powAddr) public view returns (uint256) {
        return _userVoteInfos[epoch][powAddr];
    }

    /**
     * @dev get pow epoch number
     */
    function powEpochNumber() public view returns (uint256) {
        return CFX_CONTEXT.epochNumber();
    }

    /**
     * @dev get pos block number/height
     */
    function posBlockHeight() public view returns (uint256) {
        return CFX_CONTEXT.posHeight();
    }
}
