// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import {sCFXBridge} from "../core/sCFXBridge.sol";

import {ParamsControl} from "@confluxfans/contracts/InternalContracts/ParamsControl.sol";
import {CrossSpaceCall} from "@confluxfans/contracts/InternalContracts/CrossSpaceCall.sol";

contract DebugScfxBridge is sCFXBridge {
    // for test
    function initialize(
        address _crossSpaceCall,
        address _paramsControl
    ) public {
        initialize();
        CROSS_SPACE_CALL = CrossSpaceCall(_crossSpaceCall);
        PARAMS_CONTROL = ParamsControl(_paramsControl);
    }

    function setPoolAccInterest(uint amount) public payable onlyOwner {
        poolAccInterest += amount;
    }
}
