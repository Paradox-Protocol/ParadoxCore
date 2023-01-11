// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

interface IProxy {
    function createClone(bytes32 salt) external returns (address);
}