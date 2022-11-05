// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

pragma solidity >=0.7.0 <0.9.0;

contract Proxy is Ownable {
    using Clones for address;
    address public master;

    event CloneCreated(address indexed contractAddress);
    event MasterChanged(address indexed masterAddress);

    mapping(address => address) public cloneToMaster;

    constructor(address _master) {
        master = _master;
    }

    function getCloneAddress(bytes32 salt) external view returns (address) {
        require(master != address(0), "Proxy: Master must be set");
        return master.predictDeterministicAddress(salt);
    }

    function createClone(bytes32 salt) external returns (address) {
        address _cloneAddress = master.cloneDeterministic(salt);
        cloneToMaster[_cloneAddress] = master;

        emit CloneCreated(_cloneAddress);

        return _cloneAddress;
    }

    function updateMaster(address _master) external onlyOwner {
        require(_master != address(0), "Proxy: invalid address provided"); 
        master = _master;

        emit MasterChanged(master);
    }
}