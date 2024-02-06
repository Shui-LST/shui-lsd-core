// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import {sCFX} from "../espace/sCFX.sol";

contract DebugSCFX is sCFX {
    constructor() {
        initialize();
        _setupRole(MINTER_ROLE, _msgSender());
    }

    receive() external payable {}

    function setTotalDeposited(uint256 value) public {
        totalDeposited = value;
    }

    function setTotalClaimed(uint256 value) public {
        totalClaimed = value;
    }

    function setUserWithdrawable(address user, uint amount) public {
        userWithdrawable[user] = amount;
    }

    function setUserClaimed(address user, uint amount) public {
        userClaimed[user] = amount;
    }
}
