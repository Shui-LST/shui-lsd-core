// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import "forge-std/Test.sol";
import "../contracts/espace/Farming.sol";
import "../contracts/utils/Proxy1967.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract FarmingTest is Test {

    address public user1 = address(1111);
    address public user2 = address(1112);

    ERC20PresetMinterPauser public stakeToken;
    ERC20PresetMinterPauser public rewardToken;

    Farming public farming;

    function setUp() public {
        stakeToken = new ERC20PresetMinterPauser("StakeToken", "ST");
        stakeToken.mint(user1, 1000_000_000 ether);
        stakeToken.mint(user2, 1000_000_000 ether);

        rewardToken = new ERC20PresetMinterPauser("RewardToken", "RT");
        rewardToken.mint(user2, 1000_000_000 ether);

        Farming impl = new Farming();
        Proxy1967 p1 = new Proxy1967(address(impl), abi.encodeWithSignature("initialize()"));
        farming = Farming(address(p1));

        rewardToken.mint(farming.owner(), 1000_000_000 ether);
        // console.log(farming.owner());

        rewardToken.approve(address(farming), 1000_000_000 ether);
        farming.addPool(address(stakeToken), address(rewardToken), 1000 ether, 1000, 2000);
        
        vm.deal(user1, 1000_000_000 ether);
        vm.deal(user2, 1000_000_000 ether);
    }

    function test_deposit() public {
        assertEq(farming.poolLength(), 1);

        uint256 _pid = 0;
        uint256 startBlock = 1000;

        vm.startPrank(user1);
        stakeToken.approve(address(farming), 1000 ether);

        vm.roll(startBlock);
        farming.deposit(_pid, 1000 ether);
        
        (uint amount, uint rewardPerToken, uint reward) = farming.userInfo(user1, _pid);
        assertEq(amount, 1000 ether);
        // console.log(rewardPerToken, reward);
        
        vm.roll(startBlock + 1);

        (uint lastBlock, uint accReward, uint totalStake) = farming.poolStakeInfo(_pid);
        assertEq(lastBlock, 1000);
        assertEq(totalStake, 1000 ether);
        

        assertEq(farming.reward(user1, _pid), 1 ether);

        vm.roll(startBlock + 2);
        assertEq(farming.reward(user1, _pid), 2 ether);

        farming.claim(_pid);
        assertEq(farming.reward(user1, _pid), 0);

        vm.roll(startBlock + 3);
        assertEq(farming.reward(user1, _pid), 1 ether);

        vm.stopPrank();

        vm.startPrank(user2);
        stakeToken.approve(address(farming), 1000 ether);

        farming.deposit(_pid, 1000 ether);

        vm.roll(startBlock + 4);
        assertEq(farming.reward(user2, _pid), 0.5 ether);

        vm.roll(startBlock + 1000);
        assertEq(farming.reward(user2, _pid), 997 ether / 2);

        vm.roll(startBlock + 1005);
        assertEq(farming.reward(user2, _pid), 997 ether / 2);

        farming.withdraw(_pid, 999 ether);
        (uint amount1, ,) = farming.userInfo(user2, _pid);
        assertEq(amount1, 1 ether);

        vm.stopPrank();
    }
}