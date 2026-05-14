// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {POSCIToken} from "../src/POSCIToken.sol";

contract POSCITokenTest is Test {
    POSCIToken token;
    address recipient = address(0xBEEF);

    function setUp() public {
        token = new POSCIToken(recipient);
    }

    function test_Metadata() public view {
        assertEq(token.name(), "Proof of Scientist");
        assertEq(token.symbol(), "POSCI");
        assertEq(token.decimals(), 18);
    }

    function test_TotalSupply_Is21M() public view {
        assertEq(token.totalSupply(), 21_000_000 * 1e18);
        assertEq(token.MAX_SUPPLY(),  21_000_000 * 1e18);
    }

    function test_AllSupplyToRecipient() public view {
        assertEq(token.balanceOf(recipient), 21_000_000 * 1e18);
    }

    function test_Constructor_RejectsZero() public {
        vm.expectRevert(bytes("POSCI: zero recipient"));
        new POSCIToken(address(0));
    }

    function test_NoMintOrOwnerFunctions() public {
        // The contract intentionally has no mint/owner. We assert by attempting
        // a low-level call to standard admin selectors and expecting failure.
        bytes4[5] memory absentSelectors = [
            bytes4(keccak256("mint(address,uint256)")),
            bytes4(keccak256("owner()")),
            bytes4(keccak256("transferOwnership(address)")),
            bytes4(keccak256("pause()")),
            bytes4(keccak256("burnFrom(address,uint256)"))
        ];
        for (uint256 i = 0; i < absentSelectors.length; i++) {
            (bool ok, ) = address(token).call(abi.encodeWithSelector(absentSelectors[i]));
            assertFalse(ok, "absent selector unexpectedly succeeded");
        }
    }

    function test_TransferAndApprove() public {
        vm.prank(recipient);
        token.transfer(address(0xCAFE), 1000e18);
        assertEq(token.balanceOf(address(0xCAFE)), 1000e18);

        vm.prank(address(0xCAFE));
        token.approve(address(this), 500e18);
        assertEq(token.allowance(address(0xCAFE), address(this)), 500e18);
    }
}
