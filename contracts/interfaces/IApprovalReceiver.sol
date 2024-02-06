// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

interface IApprovalReceiver {
    function onTokenApproval(address, uint256, bytes calldata) external returns (bool);
}
