// SPDX-License-Identifier: BUSL-1.1
import {IStaking} from "../interfaces/IStaking.sol";
import {PoSRegister} from "@confluxfans/contracts/InternalContracts/PoSRegister.sol";
import "hardhat/console.sol";

pragma solidity ^0.8.18;

abstract contract PoolContext {

    address constant internalStaking = 0x0888000000000000000000000000000000000002;
    IStaking private STAKING;
    PoSRegister private POS_REGISTER;

    function _selfBalance() internal view virtual returns (uint256) {
        return address(this).balance;
    }

    function _blockNumber() internal view virtual returns (uint256) {
        return block.number;
    }

    function initialize(address staking, address posRegister) internal{
        STAKING = IStaking(staking);
        POS_REGISTER = PoSRegister(posRegister);
    }

    function _stakingDeposit(uint256 _amount) internal virtual {
        if(address(STAKING)!=internalStaking) {
            STAKING.deposit{value: _amount}(_amount);
        } else {
            STAKING.deposit(_amount);
        }
    }

    function _stakingWithdraw(uint256 _amount) internal virtual {
        STAKING.withdraw(_amount);
    }

    function _stakingBalance() internal view returns (uint256) {
        return STAKING.getStakingBalance(address(this));
    }

    function _stakingLockedStakingBalance(uint256 blockNumber) internal view returns (uint256) {
        return STAKING.getLockedStakingBalance(address(this), blockNumber);
    }

    function _stakingVotePower(uint256 blockNumber) internal view returns (uint256) {
        return STAKING.getVotePower(address(this), blockNumber);
    }

    function _stakingVoteLock(uint256 amount, uint256 unlockBlockNumber) internal {
        STAKING.voteLock(amount, unlockBlockNumber);
    }

    function _posRegisterRegister(
        bytes32 indentifier,
        uint64 votePower,
        bytes calldata blsPubKey,
        bytes calldata vrfPubKey,
        bytes[2] calldata blsPubKeyProof
    ) internal virtual {
        POS_REGISTER.register(indentifier, votePower, blsPubKey, vrfPubKey, blsPubKeyProof);
    }

    function _posRegisterIncreaseStake(uint64 votePower) internal virtual {
        POS_REGISTER.increaseStake(votePower);
    }

    function _posRegisterRetire(uint64 votePower) internal virtual {
        POS_REGISTER.retire(votePower);
    }

    function _posAddressToIdentifier(address _addr) internal view returns (bytes32) {
        return POS_REGISTER.addressToIdentifier(_addr);
    }
}
