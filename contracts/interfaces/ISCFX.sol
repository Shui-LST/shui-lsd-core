// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

// import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

interface ISCFX is IERC20MetadataUpgradeable {
    /**
     * @dev Deposit CFX into this contract and get sCFX
     */
    function deposit() external payable;

    function redeem(uint256 shares) external;

    /**
     * @dev Withdraw CFX from this contract by burning sCFX, need approve first
     */
    function withdraw(uint256 amount) external;

    function ratioDepositedBySupply() external view returns (uint256);
}
