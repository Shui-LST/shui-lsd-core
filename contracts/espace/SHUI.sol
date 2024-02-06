// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import {ERC20PresetMinterPauserUpgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";

contract SHUI is ERC20PresetMinterPauserUpgradeable {
    function initialize(address receiver) public initializer {
        super.initialize("Shui Token", "SHUI");
        _mint(receiver, 1_000_000 ether);
    }
}
