// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import "forge-std/Test.sol";
import "../contracts/utils/VotePowerQueue.sol";

contract RedeemQueueTest is Test {
    using VotePowerQueue for VotePowerQueue.InOutQueue;

    VotePowerQueue.InOutQueue public queue;

    function setUp() public {
    }

    function test_enqueueAndDequeue() public {
        queue.enqueue(VotePowerQueue.QueueNode(1, block.number));
        queue.enqueue(VotePowerQueue.QueueNode(2, block.number));

        assertEq(queue.length(), 2);
        assertEq(queue.queueItems().length, 2);

        VotePowerQueue.QueueNode memory node = queue.dequeue();
        assertEq(node.votePower, 1);
        assertEq(queue.length(), 1);

        queue.clear();
        assertEq(queue.length(), 0);
    }

    function test_sumAndCollect() public {
        queue.enqueue(VotePowerQueue.QueueNode(1, block.number));
        queue.enqueue(VotePowerQueue.QueueNode(2, block.number +10));
        vm.roll(block.number+5);

        assertEq(queue.sumEndedVotes(), 1);

        assertEq(queue.collectEndedVotes(), 1);
        assertEq(queue.length(), 1);

        queue.clear();
        assertEq(queue.length(), 0);
    }

}
