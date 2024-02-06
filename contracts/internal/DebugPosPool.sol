// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import {PoSPool} from "../core/PoSPool.sol";
import {ParamsControl} from "@confluxfans/contracts/InternalContracts/ParamsControl.sol";
// import "hardhat/console.sol";

contract DebugPoSPool is PoSPool {
    // for test
    receive() external payable {
        // console.log("received %s %s", msg.sender, msg.value);
    }

    // for test
    function initialize(
        address _staking,
        address _posRegister,
        address _paramsControl
    ) public {
        super.initialize();
        paramsControl = ParamsControl(_paramsControl);
        super.initialize(_staking, _posRegister);
    }
}
