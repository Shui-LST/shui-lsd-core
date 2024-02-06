// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

library RedeemQueue {
    struct Node {
        uint256 amount;
        address user;
    }

    struct Queue {
        uint256 start;
        uint256 end;
        mapping(uint256 => Node) items;
    }

    function enqueue(Queue storage queue, Node memory item) internal {
        queue.items[queue.end++] = item;
    }

    function dequeue(Queue storage queue) internal returns (Node memory) {
        require(queue.start < queue.end, "Queue is empty");
        Node memory item = queue.items[queue.start];
        delete queue.items[queue.start++];
        return item;
    }

    function length(Queue storage queue) internal view returns (uint256) {
        return queue.end - queue.start;
    }
}
