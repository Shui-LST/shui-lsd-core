// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.18;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Proxy1967 is ERC1967Proxy {
    // initialize() - "0x8129fc1c"
    constructor(address logic, bytes memory data) ERC1967Proxy(logic, data) {
        _changeAdmin(msg.sender);
    }

    modifier onlyAdmin() {
        require(msg.sender == _getAdmin(), "Proxy1967: admin only");
        _;
    }

    function implementation() public view returns (address) {
        return _implementation();
    }

    function upgradeTo(address newImplementation) public onlyAdmin {
        _upgradeTo(newImplementation);
    }

    function changeAdmin(address newAdmin) public onlyAdmin {
        require(_getAdmin() != newAdmin, "Proxy1967: admin not changed");
        _changeAdmin(newAdmin);
    }

    function getAdmin() public view returns (address) {
        return _getAdmin();
    }
}
