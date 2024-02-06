// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import "forge-std/Test.sol";
import "../contracts/espace/sCFX.sol";
import "../contracts/utils/Proxy1967.sol";

contract ScfxTest is Test {
    address public user1 = address(1111);
    address public user2 = address(1112);

    sCFX public scfx;
    MockScfxBridge public mockScfxBridge;

    function setUp() public {
        sCFX impl = new sCFX();
        Proxy1967 p1 = new Proxy1967(address(impl), abi.encodeWithSignature("initialize()"));
        scfx = sCFX(address(p1));
        
        mockScfxBridge = new MockScfxBridge(address(scfx));

        scfx.setmappedsCFXBridge(address(mockScfxBridge));

        vm.deal(user1, 1000_000_000 ether);
        vm.deal(user2, 1000_000_000 ether);
    }

    function test_deposit() public {
        vm.startPrank(user1);
        scfx.deposit{value: 10000 ether}();
        assertEq(scfx.balanceOf(user1), 10000 ether);
        vm.stopPrank();

        vm.startPrank(user2);
        mockScfxBridge.addAsset{value: 1 ether}();
        assertEq(scfx.totalDeposited() > scfx.totalSupply(), true);
        vm.stopPrank();

        vm.startPrank(user2);
        scfx.deposit{value: 100 ether}();
        assertTrue(scfx.balanceOf(user2) < 100 ether);
        assertTrue(scfx.balanceOf(user2) > 0);
        vm.stopPrank();
    }

    function test_redeem() public {
        vm.startPrank(user1);
        scfx.deposit{value: 10000 ether}();

        scfx.redeem(1000 ether);
        assertEq(scfx.balanceOf(user1), 9000 ether);
        vm.stopPrank();

        assertEq(scfx.firstRedeemAmount(), 1000 ether);
    }

    function test_withdraw() public {
        vm.startPrank(user1);
        scfx.deposit{value: 10000 ether}();
        vm.stopPrank();

        vm.startPrank(user2);
        mockScfxBridge.addAsset{value: 1 ether}();
        assertEq(scfx.totalDeposited() > scfx.totalSupply(), true);
        vm.stopPrank();

        vm.startPrank(user1);
        scfx.redeem(1000 ether);
        assertEq(scfx.balanceOf(user1), 9000 ether);
        vm.stopPrank();

        vm.startPrank(address(mockScfxBridge));
        assertTrue(scfx.firstRedeemAmount() > 1000 ether);
        scfx.handleRedeem{value: scfx.firstRedeemAmount()}();
        assertEq(scfx.firstRedeemAmount(), 0);
        vm.stopPrank();

        vm.startPrank(user1);
        scfx.withdraw(scfx.userWithdrawable(user1));
        assertEq(scfx.userWithdrawable(user1), 0);
        vm.stopPrank();
    }

}

contract MockScfxBridge {
    sCFX public scfx;

    constructor(address addr) {
        scfx = sCFX(addr);
    }

    function addAsset() public payable {
        scfx.addAssets(msg.value);
    }

    function handleRedeem() public {
        uint256 amount = scfx.firstRedeemAmount();
        scfx.handleRedeem{value: amount}();
    }

    fallback() external payable {
    }

    receive() external payable {
        // Handle received ether here
    }
}
