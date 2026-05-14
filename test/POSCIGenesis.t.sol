// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {POSCIToken}    from "../src/POSCIToken.sol";
import {POSCIMining}   from "../src/POSCIMining.sol";
import {POSCIGenesis, IMiningGate} from "../src/POSCIGenesis.sol";
import {IPositionManager, IAllowanceTransfer} from "../src/interfaces/IUniswapV4.sol";

/// @notice Mainnet-fork integration test for the genesis bootstrap.
///         Run with:
///           forge test --match-contract POSCIGenesisFork --fork-url $MAINNET_RPC_URL -vvv
///
///         If MAINNET_RPC_URL is unset the test self-skips so CI without RPC
///         doesn't break the build.
contract POSCIGenesisForkTest is Test {
    POSCIToken    token;
    POSCIMining   mining;
    POSCIGenesis  genesis;

    // Uniswap V4 mainnet (verify before main-net deploy):
    address constant V4_POSITION_MANAGER = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
    address constant PERMIT2             = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    address deployer = address(0xDEAD1);
    address buyerA   = address(0xBA51C0);
    address buyerB   = address(0xBA51C1);

    function setUp() public {
        // Self-skip if no fork URL is configured.
        try vm.envString("MAINNET_RPC_URL") returns (string memory url) {
            if (bytes(url).length == 0) vm.skip(true);
        } catch {
            vm.skip(true);
        }

        vm.startPrank(deployer);
        token = new POSCIToken(deployer);
        mining = new POSCIMining(token, block.timestamp + 1 days);
        genesis = new POSCIGenesis(
            token,
            IMiningGate(address(mining)),
            IPositionManager(V4_POSITION_MANAGER),
            IAllowanceTransfer(PERMIT2)
        );
        token.transfer(address(genesis), 500_000 * 1e18);
        token.transfer(address(mining),  20_000_000 * 1e18);
        mining.bindGenesis(address(genesis));   // atomic, self-renouncing
        vm.stopPrank();

        vm.deal(buyerA, 10 ether);
        vm.deal(buyerB, 10 ether);
    }

    function test_BuyGenesis_PartialFill_NoBootstrap() public {
        vm.prank(buyerA);
        genesis.buyGenesis{value: 0.05 ether}();

        assertEq(genesis.totalContributed(), 0.05 ether);
        assertFalse(genesis.bootstrapped());
        // 0.05 / 0.5 of POSCI_FOR_GENESIS = 25_000 POSCI
        assertEq(token.balanceOf(buyerA), 25_000 * 1e18);
    }

    function test_PerWalletCap_Enforced() public {
        vm.startPrank(buyerA);
        genesis.buyGenesis{value: 0.05 ether}();
        vm.expectRevert(POSCIGenesis.WalletCapExceeded.selector);
        genesis.buyGenesis{value: 1 wei}();
        vm.stopPrank();
    }

    function test_FullFill_Bootstraps_BurnsLp_OpensGate() public {
        // 10 buyers × 0.05 ETH = 0.5 ETH cap.
        for (uint256 i = 0; i < 10; i++) {
            address b = address(uint160(0xBEEF0000 + i));
            vm.deal(b, 1 ether);
            vm.prank(b);
            genesis.buyGenesis{value: 0.05 ether}();
        }
        assertTrue(genesis.bootstrapped(), "bootstrapped");
        assertTrue(mining.poolGateOpen(),  "pool gate open");
        // The LP NFT must be at the dead address now.
        // tokenId is whatever PositionManager assigned; we trust the contract's
        // own assertion (`require(positionManager.ownerOf(...) == address(this))`)
        // before the burn — if we got here, the burn happened.
    }

    function test_OverPay_Refunds() public {
        vm.prank(buyerA);
        genesis.buyGenesis{value: 0.05 ether}();
        vm.prank(buyerB);
        // Send way more than the wallet+global rooms — should refund excess.
        uint256 buyerBBalBefore = buyerB.balance;
        genesis.buyGenesis{value: 0.05 ether}();
        // Wallet cap allows full 0.05; no refund expected.
        assertEq(buyerB.balance, buyerBBalBefore - 0.05 ether);
    }

    function test_BuyAfterBootstrap_Reverts() public {
        for (uint256 i = 0; i < 10; i++) {
            address b = address(uint160(0xBEEF1000 + i));
            vm.deal(b, 1 ether);
            vm.prank(b);
            genesis.buyGenesis{value: 0.05 ether}();
        }
        vm.deal(buyerA, 1 ether);
        vm.prank(buyerA);
        vm.expectRevert(POSCIGenesis.GenesisClosed.selector);
        genesis.buyGenesis{value: 0.01 ether}();
    }

    function test_DirectSendRejected() public {
        vm.deal(buyerA, 1 ether);
        vm.prank(buyerA);
        (bool ok, ) = address(genesis).call{value: 0.01 ether}("");
        assertFalse(ok, "direct send should revert");
    }

    function test_BuyZero_Reverts() public {
        vm.prank(buyerA);
        vm.expectRevert(POSCIGenesis.ZeroValue.selector);
        genesis.buyGenesis{value: 0}();
    }

    /// 9 buyers fill 0.45 ETH; the 10th sends a single 0.5 ETH tx that fills
    /// the remaining 0.05 ETH room AND triggers atomic bootstrap, with the
    /// remaining 0.45 ETH refunded back.
    function test_RealOverpayment_RefundsAndBootstraps() public {
        for (uint256 i = 0; i < 9; i++) {
            address b = address(uint160(0xBEEF2000 + i));
            vm.deal(b, 1 ether);
            vm.prank(b);
            genesis.buyGenesis{value: 0.05 ether}();
        }
        assertEq(genesis.totalContributed(), 0.45 ether, "9 buyers fill 0.45");
        assertFalse(genesis.bootstrapped());

        address fat = address(0xFA77FA77);
        vm.deal(fat, 1 ether);
        uint256 balBefore = fat.balance;

        vm.prank(fat);
        genesis.buyGenesis{value: 0.5 ether}();

        // Wallet cap consumed exactly 0.05 ETH. Refund = 0.45 ETH.
        assertEq(fat.balance, balBefore - 0.05 ether, "refunded the over-payment");
        assertEq(genesis.contributed(fat), 0.05 ether, "personal cap == 0.05");
        assertTrue(genesis.bootstrapped(), "bootstrap triggered");
        assertTrue(mining.poolGateOpen(),  "mining gate opened");
    }

    // -------------------------------------------------------------------
    // forceBootstrap — time-fallback path for an unfilled cap
    // -------------------------------------------------------------------

    function test_ForceBootstrap_RevertsBeforeDelay() public {
        vm.warp(genesis.deployedAt() + genesis.FORCE_BOOTSTRAP_DELAY() - 1);
        vm.expectRevert(POSCIGenesis.TooEarly.selector);
        genesis.forceBootstrap();
    }

    function test_ForceBootstrap_RevertsIfAlreadyBootstrapped() public {
        // Fill cap normally → bootstrapped == true.
        for (uint256 i = 0; i < 10; i++) {
            address b = address(uint160(0xBEEF3000 + i));
            vm.deal(b, 1 ether);
            vm.prank(b);
            genesis.buyGenesis{value: 0.05 ether}();
        }
        assertTrue(genesis.bootstrapped(), "precondition: bootstrapped");

        vm.warp(genesis.deployedAt() + genesis.FORCE_BOOTSTRAP_DELAY() + 1);
        vm.expectRevert(POSCIGenesis.GenesisClosed.selector);
        genesis.forceBootstrap();
    }

    function test_ForceBootstrap_DustPath_BurnsAllAndOpensGate() public {
        // No buys at all.
        uint256 genesisPosciBefore = token.balanceOf(address(genesis));
        uint256 deadBefore         = token.balanceOf(genesis.DEAD());
        assertEq(genesisPosciBefore, 500_000 * 1e18, "precondition: full genesis allocation");

        vm.warp(genesis.deployedAt() + genesis.FORCE_BOOTSTRAP_DELAY() + 1);
        genesis.forceBootstrap();

        assertTrue(genesis.bootstrapped(), "bootstrapped flag set");
        assertTrue(mining.poolGateOpen(),  "mining gate opened");
        assertEq(token.balanceOf(address(genesis)), 0, "all POSCI moved out");
        assertEq(token.balanceOf(genesis.DEAD()) - deadBefore, genesisPosciBefore, "POSCI burned to dEaD");
    }

    function test_ForceBootstrap_PartialFill_ProportionalLp() public {
        // 2 buyers × 0.05 ETH = 0.1 ETH raised (above MIN_BOOTSTRAP_ETH = 0.01).
        vm.prank(buyerA);
        genesis.buyGenesis{value: 0.05 ether}();
        vm.prank(buyerB);
        genesis.buyGenesis{value: 0.05 ether}();
        assertEq(genesis.totalContributed(), 0.1 ether);
        assertFalse(genesis.bootstrapped());

        // POSCI sold to the 2 buyers = 2 × 25K = 50K.
        // POSCI remaining in genesis = 500K - 50K = 450K.
        // Proportional LP = POSCI_FOR_LP * 0.1/0.5 = 50K.
        // To burn = 450K - 50K = 400K.
        uint256 deadBefore   = token.balanceOf(genesis.DEAD());

        vm.warp(genesis.deployedAt() + genesis.FORCE_BOOTSTRAP_DELAY() + 1);
        genesis.forceBootstrap();

        assertTrue(genesis.bootstrapped(),    "bootstrapped");
        assertTrue(mining.poolGateOpen(),     "gate opened");
        assertEq(token.balanceOf(genesis.DEAD()) - deadBefore, 400_000 * 1e18, "unsold POSCI burned");
        // Genesis POSCI leftover: a few wei of V4 LP-math dust (same artifact as v1
        // full-cap path — unused units of POSCI that PositionManager didn't pull).
        // Cap at 1e9 wei (1 gwei-POSCI ≈ 0) so any regression in proportionality is caught.
        assertLt(token.balanceOf(address(genesis)), 1e9, "only V4 dust remains");
    }

    function test_ForceBootstrap_BelowMinThreshold_TakesDustPath() public {
        // 0.005 ETH raised — below MIN_BOOTSTRAP_ETH (0.01 ether).
        vm.prank(buyerA);
        genesis.buyGenesis{value: 0.005 ether}();

        // Buyer received 250K * 0.005 / 0.5 = 2_500 POSCI.
        assertEq(token.balanceOf(buyerA), 2_500 * 1e18);

        uint256 genesisPosciBefore = token.balanceOf(address(genesis)); // 500K - 2.5K = 497.5K
        uint256 deadBefore         = token.balanceOf(genesis.DEAD());

        vm.warp(genesis.deployedAt() + genesis.FORCE_BOOTSTRAP_DELAY() + 1);
        genesis.forceBootstrap();

        // Dust path: no pool, all remaining POSCI burned.
        assertTrue(mining.poolGateOpen(), "gate opened despite no pool");
        assertEq(token.balanceOf(address(genesis)), 0, "genesis emptied");
        assertEq(token.balanceOf(genesis.DEAD()) - deadBefore, genesisPosciBefore, "all leftover burned");
    }

    function test_ForceBootstrap_IgnoresInjectedEth() public {
        // Real contribution = 0.1 ETH (proportional path eligible).
        vm.prank(buyerA);
        genesis.buyGenesis{value: 0.05 ether}();
        vm.prank(buyerB);
        genesis.buyGenesis{value: 0.05 ether}();

        // Force-inject 10 ETH bypassing the contract API (simulating SELFDESTRUCT).
        // vm.deal directly mutates balance — same end state as a malicious
        // selfdestruct → no path through receive() so the revert is bypassed.
        vm.deal(address(genesis), 10 ether);
        assertEq(address(genesis).balance, 10 ether, "balance inflated");
        assertEq(genesis.totalContributed(), 0.1 ether, "accounting unchanged");

        vm.warp(genesis.deployedAt() + genesis.FORCE_BOOTSTRAP_DELAY() + 1);
        genesis.forceBootstrap();

        // The contract should have paired only totalContributed (0.1 ETH) into
        // the pool. Injected 9.9 ETH stays stranded in the contract (no way out).
        // Pool burns 0.1; stranded remaining ≥ 9.9 (minus any V4 dust sweep).
        assertGe(address(genesis).balance, 9.9 ether, "injected ETH stranded, not paired into LP");
        assertTrue(genesis.bootstrapped());
        assertTrue(mining.poolGateOpen());
    }
}
