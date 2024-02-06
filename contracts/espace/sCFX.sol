// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import {ERC20PresetMinterPauserUpgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {RedeemQueue} from "../utils/RedeemQueue.sol";
import {IVotingEscrow} from "../interfaces/IVotingEscrow.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ISCFX} from "../interfaces/ISCFX.sol";

contract sCFX is ISCFX, ERC20PresetMinterPauserUpgradeable {
    using RedeemQueue for RedeemQueue.Queue;
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 constant TOKEN_ADMIN_ROLE = keccak256("TOKEN_ADMIN_ROLE");
    uint256 constant RATIO_BASE = 1000_000_000;

    address public mappedsCFXBridge;
    uint256 public totalDeposited;
    uint256 public totalClaimed;

    mapping(address => uint256) public userClaimed;
    mapping(address => uint256) public userWithdrawable;

    EnumerableSet.AddressSet private _stakers;
    RedeemQueue.Queue private _redeemQueue;

    address public votingEscrow;

    event Deposit(address indexed user, uint256 amount, uint256 share);
    event Claim(address indexed user, uint256 share, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    modifier onlyBridge() {
        require(msg.sender == mappedsCFXBridge, "Only bridge is allowed");
        _;
    }

    function initialize() public initializer {
        super.initialize("Shui CFX", "sCFX");
        _setupRole(TOKEN_ADMIN_ROLE, _msgSender());
    }

    function deposit() public payable {
        require(msg.value > 0, "deposit amount must be greater than 0");
        uint256 amount = msg.value;

        uint256 value = 0;
        if (totalSupply() == 0) {
            value = amount;
        } else {
            value = (amount * totalSupply()) / totalDeposited;
        }
        totalDeposited += amount;
        _mint(msg.sender, value);
        _transferToBridge(amount);

        emit Deposit(msg.sender, amount, value);
    }

    function redeem(uint256 value) public {
        require(value > 0, "redeem amount must be greater than 0");
        require(balanceOf(msg.sender) >= value, "balance not enough");

        uint256 amount = (value * totalDeposited) / totalSupply();

        totalDeposited -= amount;

        _redeemQueue.enqueue(RedeemQueue.Node({amount: amount, user: msg.sender}));
        userClaimed[msg.sender] += amount;

        totalClaimed += amount;
        _burn(msg.sender, value);

        emit Claim(msg.sender, value, amount);
    }

    function withdraw(uint256 amount) public {
        require(amount > 0, "withdraw amount must be greater than 0");
        require(amount <= userWithdrawable[msg.sender], "not enough claimable amount");
        require(amount <= address(this).balance, "not enough contract balance");
        userWithdrawable[msg.sender] -= amount;
        address payable receiver = payable(msg.sender);
        receiver.transfer(amount);

        emit Withdraw(msg.sender, amount);
    }

    function ratioDepositedBySupply() public view returns (uint256) {
        if (totalSupply() == 0) return RATIO_BASE;
        return totalDeposited * RATIO_BASE / totalSupply();
    }

    function stakerNumber() public view returns (uint256) {
        return _stakers.length();
    }

    function stakerAddress(uint256 i) public view returns (address) {
        return _stakers.at(i);
    }

    function redeemLen() public view returns (uint256) {
        return _redeemQueue.end - _redeemQueue.start;
    }

    function firstRedeemAmount() public view returns (uint256) {
        if (_redeemQueue.end == _redeemQueue.start) return 0;
        return _redeemQueue.items[_redeemQueue.start].amount;
    }

    function userVotePower(address user) external view returns (uint256) {
        return IVotingEscrow(votingEscrow).userVotePower(user);
    }

    function redeemQueue() public view returns (RedeemQueue.Node[] memory) {
        RedeemQueue.Node[] memory nodes = new RedeemQueue.Node[](_redeemQueue.end - _redeemQueue.start);
        for (uint256 i = _redeemQueue.start; i < _redeemQueue.end; i++) {
            nodes[i - _redeemQueue.start] = _redeemQueue.items[i];
        }
        return nodes;
    }

    function redeemQueue(uint256 offset, uint256 limit) public view returns (RedeemQueue.Node[] memory) {
        uint256 start = Math.min( _redeemQueue.start + offset, _redeemQueue.end);
        uint256 end = Math.min(_redeemQueue.start + offset + limit, _redeemQueue.end);
        RedeemQueue.Node[] memory nodes = new RedeemQueue.Node[](end - start);
        for (uint256 i = start; i < end; i++) {
            nodes[i - start] = _redeemQueue.items[i];
        }
        return nodes;
    }

    function handleRedeem() public payable onlyBridge {
        require(_redeemQueue.end - _redeemQueue.start > 0, "redeeming queue is empty");
        uint256 _value = msg.value;
        RedeemQueue.Node memory node = _redeemQueue.dequeue();
        require(node.amount == _value, "redeem amount not match");
        require(_value <= totalClaimed, "abnormal value");
        totalClaimed -= _value;
        userWithdrawable[node.user] += _value;
        userClaimed[node.user] -= _value;
    }

    function addAssets(uint256 delta) public onlyBridge {
        totalDeposited += delta;
    }

    function setmappedsCFXBridge(address bridge) public onlyRole(TOKEN_ADMIN_ROLE) {
        mappedsCFXBridge = bridge;
    }

    function setVotingEscrow(address escrow) public onlyRole(TOKEN_ADMIN_ROLE) {
        votingEscrow = escrow;
    }

    function _transferToBridge(uint256 amount) private {
        uint256 _balance = address(this).balance;
        require(amount <= _balance, "not enough balance");
        address payable receiver = payable(mappedsCFXBridge);
        receiver.transfer(amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        if (amount > 0 && to != address(0)) {
            _stakers.add(to);
        }
    }

    function _afterTokenTransfer(address from, address to, uint256 amount) internal override {
        if (balanceOf(from) == 0 && from != address(0)) {
            _stakers.remove(from);
        }
    }
}
