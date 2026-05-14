// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title  Proof of Scientist (POSCI)
/// @notice Fixed-supply 21,000,000 ERC20 with EIP-2612 permit.
///         No owner. No mint. No pause. No upgrade. No fee.
///         Total supply is minted once in the constructor and from
///         that moment on the contract has no privileged functions.
contract POSCIToken is ERC20, ERC20Permit {
    uint256 public constant MAX_SUPPLY = 21_000_000 * 1e18;

    constructor(address recipient) ERC20("Proof of Scientist", "POSCI") ERC20Permit("Proof of Scientist") {
        require(recipient != address(0), "POSCI: zero recipient");
        _mint(recipient, MAX_SUPPLY);
    }
}
