// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import "forge-std/Test.sol";
import "../contracts/utils/RedeemQueue.sol";

contract RedeemQueueTest is Test {
    using RedeemQueue for RedeemQueue.Queue;

    RedeemQueue.Queue public redeemQueue;

    function setUp() public {
    }

    function test_enqueueAndDequeue() public {
        redeemQueue.enqueue(RedeemQueue.Node(1, address(0x1)));
        redeemQueue.enqueue(RedeemQueue.Node(2, address(0x2)));

        assertEq(redeemQueue.length(), 2);

        RedeemQueue.Node memory node = redeemQueue.dequeue();

        assertEq(node.amount, 1);
        assertEq(redeemQueue.length(), 1);
    }

}
