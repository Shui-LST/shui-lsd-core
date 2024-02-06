// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.18;

import {ISCFX} from "../../interfaces/ISCFX.sol";
import {ERC20Upgradeable, IERC20Upgradeable, ERC20PresetMinterPauserUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";
// import {ERC20Upgradeable,IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {RedeemQueue} from "../../utils/RedeemQueue.sol";

contract MockScfx is ISCFX, ERC20PresetMinterPauserUpgradeable {
    using RedeemQueue for RedeemQueue.Queue;
    uint256 constant RATIO_BASE = 1000_000_000;

    /* ================================== Mocks ====================================== */
    uint public redeemLen;
    uint public firstRedeemAmount;
    uint public totalClaimed;
    uint public stakerNumber;
    uint public totalDeposited;
    uint private _totalSupply;

    event EventAddAssets(uint256 amount);
    event EventDeposit(uint256 amount);
    event EventRedeem(uint256 amount);
    event EventHandleRedeem(uint256 amount);
    event EventWithdraw(uint256 amount);

    RedeemQueue.Queue private _redeemQueue;

    constructor() {
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function setRedeemLen(uint val) external {
        redeemLen = val;
    }

    function setFirstRedeemAmount(uint val) external {
        firstRedeemAmount = val;
    }

    function setTotalClaimed(uint val) external {
        totalClaimed = val;
    }

    function setStakerNumber(uint val) external {
        stakerNumber = val;
    }

    function setTotalDeposited(uint val) external {
        totalDeposited = val;
    }

    function setTotalSupply(uint val) external {
        _totalSupply = val;
    }

    /* =============================== implements ======================================== */

    function addAssets(uint256 amount) external {
        // totalDeposited += val;
        emit EventAddAssets(amount);
    }

    function deposit() public payable {
        // uint256 amount = msg.value;
        // totalDeposited += amount;
        emit EventDeposit(msg.value);
    }

    function redeem(uint256 amount) public {
        // _redeemQueue.enqueue(
        //     RedeemQueue.Node({amount: value, user: msg.sender})
        // );
        // totalClaimed += value;
        emit EventRedeem(amount);
    }

    function handleRedeem() external payable {
        // _redeemQueue.dequeue();
        // totalClaimed -= msg.value;
        emit EventHandleRedeem(msg.value);
    }

    function withdraw(uint256 amount) public {
        // address payable receiver = payable(msg.sender);
        // receiver.transfer(amount);
        emit EventWithdraw(amount);
    }

    // function redeemLen() public view returns (uint256) {
    // return _redeemQueue.end - _redeemQueue.start;
    // }

    // function firstRedeemAmount() public view returns (uint256) {
    // if (_redeemQueue.end == _redeemQueue.start) return 0;
    // return _redeemQueue.items[_redeemQueue.start].amount;
    // }

    function totalSupply()
        public
        view
        override(ERC20Upgradeable, IERC20Upgradeable)
        returns (uint256)
    {
        return _totalSupply;
    }

    receive() external payable {}

    function ratioDepositedBySupply()
        external
        pure
        override
        returns (uint256)
    {
        return RATIO_BASE;
    }
}
