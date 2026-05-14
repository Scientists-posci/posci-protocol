// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {POSCIToken}  from "../src/POSCIToken.sol";
import {POSCIMining} from "../src/POSCIMining.sol";

contract POSCIMiningTest is Test {
    POSCIToken  token;
    POSCIMining mining;

    address constant FAKE_GENESIS = address(0xCAFE);
    uint256 constant START_DELAY  = 1 days;

    function setUp() public {
        token = new POSCIToken(address(this));
        mining = new POSCIMining(token, block.timestamp + START_DELAY);
        token.transfer(address(mining), mining.TOTAL_MINING_SUPPLY());

        // Wire a fake "Genesis" — atomic, self-renouncing.
        mining.bindGenesis(FAKE_GENESIS);

        // Production starts at INITIAL_TARGET (2^228) so _findNonce would
        // exceed its 20M brute-force budget. Reset to MAXIMUM_TARGET (2^234)
        // for fast nonce search; mining logic under test is independent of
        // the specific target value.
        // miningTarget lives in storage slot 1 (slot 0 = challengeNumber).
        vm.store(address(mining), bytes32(uint256(1)), bytes32(mining.MAXIMUM_TARGET()));
    }

    // ------------------------------------------------------------------
    // Gates
    // ------------------------------------------------------------------

    function test_Gate_TimeNotReached_Reverts() public {
        // Open the pool gate so only the time gate is closed.
        vm.prank(FAKE_GENESIS);
        mining.openPoolGate();
        // A trivially solvable target (max difficulty) so the failure is purely the gate.
        bytes32 dummyDigest = keccak256(abi.encodePacked(mining.challengeNumber(), address(this), uint256(0)));
        vm.expectRevert(POSCIMining.MiningNotStarted.selector);
        mining.mine(0, dummyDigest);
    }

    function test_Gate_PoolClosed_Reverts() public {
        vm.warp(block.timestamp + START_DELAY + 1);
        bytes32 dummyDigest = keccak256(abi.encodePacked(mining.challengeNumber(), address(this), uint256(0)));
        vm.expectRevert(POSCIMining.PoolGateClosed.selector);
        mining.mine(0, dummyDigest);
    }

    function test_Binding_OnlyOnce() public {
        // Already bound + renounced in setUp() via the same atomic call.
        vm.expectRevert(POSCIMining.Renounced.selector);
        mining.bindGenesis(address(0xDEAD));
    }

    function test_Binding_OnlyDeployer() public {
        // Spin up a fresh mining contract so we can prove non-deployers cannot bind.
        POSCIMining fresh = new POSCIMining(token, block.timestamp + START_DELAY);
        address attacker = address(0xBAD);
        vm.prank(attacker);
        vm.expectRevert(POSCIMining.NotDeployer.selector);
        fresh.bindGenesis(attacker);
    }

    function test_OpenPoolGate_OnlyGenesis() public {
        vm.expectRevert(POSCIMining.NotGenesis.selector);
        mining.openPoolGate();
    }

    // ------------------------------------------------------------------
    // Mining mechanics
    // ------------------------------------------------------------------

    function test_Mine_HappyPath() public {
        _openGates();
        (uint256 nonce, bytes32 digest) = _findNonce(address(this));
        uint256 reward = mining.getMiningReward();
        uint256 balBefore = token.balanceOf(address(this));

        mining.mine(nonce, digest);

        assertEq(token.balanceOf(address(this)), balBefore + reward, "reward paid");
        assertEq(mining.epochCount(), 1);
        assertTrue(mining.solutionForChallenge(digest));
        // Leaderboard tracking is recorded on every successful mine.
        assertEq(mining.solutionsByMiner(address(this)), 1, "leaderboard count");
        assertEq(mining.minersCount(), 1, "miners enumerable");
        assertEq(mining.miners(0), address(this), "miner address recorded");
    }

    function test_Leaderboard_MultipleMinersAndBatch() public {
        _openGates();

        // 4 unique miners, each mines once. We can't easily mine twice from
        // the same address in this fork-test because the challengeNumber
        // would need to rotate between txs and the simplest way to do that
        // (`vm.store`) interacts oddly with array-literal addressing — using
        // `makeAddr` avoids that landmine. Single-mine each is enough to
        // prove solutionsByMiner increments and miners[] grows.
        address mA = makeAddr("minerA");
        address mB = makeAddr("minerB");
        address mC = makeAddr("minerC");
        address mD = makeAddr("minerD");
        address[4] memory addrs;
        addrs[0] = mA;
        addrs[1] = mB;
        addrs[2] = mC;
        addrs[3] = mD;

        for (uint256 i = 0; i < 4; i++) {
            // Rotate challengeNumber so each search hits a unique digest space.
            vm.store(address(mining), bytes32(uint256(0)), bytes32(uint256(0x100 + i)));
            (uint256 n, bytes32 d) = _findNonce(addrs[i]);
            vm.prank(addrs[i]);
            mining.mine(n, d);
        }

        assertEq(mining.minersCount(), 4, "4 unique miners tracked");
        for (uint256 i = 0; i < 4; i++) {
            assertEq(mining.solutionsByMiner(addrs[i]), 1, "single solution recorded");
        }

        // Page 0..2 returns the first two miners in insertion order.
        (address[] memory page, uint256[] memory wins) = mining.topMinersBatch(0, 2);
        assertEq(page.length, 2);
        assertEq(page[0], mA);
        assertEq(wins[0], 1);
        assertEq(page[1], mB);
        assertEq(wins[1], 1);

        // Page past the end clamps cleanly.
        (address[] memory tail, uint256[] memory tailWins) = mining.topMinersBatch(3, 10);
        assertEq(tail.length, 1, "clamped to remaining");
        assertEq(tail[0], mD);
        assertEq(tailWins[0], 1);

        // Page entirely out of range returns empty.
        (address[] memory empty, ) = mining.topMinersBatch(99, 10);
        assertEq(empty.length, 0);
    }

    function test_Mine_WrongDigest_Reverts() public {
        _openGates();
        bytes32 bogus = keccak256("bogus");
        vm.expectRevert(POSCIMining.WrongDigest.selector);
        mining.mine(0, bogus);
    }

    /// @notice Anti-frontrun: another address cannot reuse our nonce because
    ///         msg.sender is in the hash.
    function test_AntiFrontrun_StolenNonceFails() public {
        _openGates();
        (uint256 nonce, bytes32 digest) = _findNonce(address(this));
        // Attacker copies the same nonce and digest.
        address attacker = address(0xBAD);
        vm.deal(attacker, 1 ether);
        vm.prank(attacker);
        vm.expectRevert(POSCIMining.WrongDigest.selector);
        mining.mine(nonce, digest);
    }

    function test_DifficultyView() public view {
        assertGt(mining.getMiningDifficulty(), 0);
    }

    function test_HalvingMath() public view {
        // Reward at epoch 0 = INITIAL_REWARD
        assertEq(mining.getMiningReward(), mining.INITIAL_REWARD());
    }

    // Sum-bound check: total emission can never exceed 20M even at best case.
    function test_TotalEmissionBound() public view {
        uint256 sum;
        uint256 reward = mining.INITIAL_REWARD();
        for (uint256 h = 0; h < mining.MAX_HALVINGS(); h++) {
            sum += reward * mining.HALVING_INTERVAL();
            reward >>= 1;
            if (reward == 0) break;
        }
        assertLe(sum, mining.TOTAL_MINING_SUPPLY());
    }

    // -------- additional edge-case tests --------

    /// Reward goes to 0 once halvings >= MAX_HALVINGS.
    function test_Halving_RewardZeroAtMaxHalvings() public {
        // Slot 2 = epochCount (challengeNumber=0, miningTarget=1). Force epochCount.
        uint256 epochCountSlot = 2;
        uint256 forcedEpoch = mining.MAX_HALVINGS() * mining.HALVING_INTERVAL();
        vm.store(address(mining), bytes32(epochCountSlot), bytes32(forcedEpoch));
        assertEq(mining.epochCount(), forcedEpoch, "epoch storage match");
        assertEq(mining.getMiningReward(), 0, "reward should be 0 past last halving");
    }

    /// Reward halves precisely after each HALVING_INTERVAL.
    function test_Halving_RewardSchedule() public {
        uint256 epochCountSlot = 2;
        for (uint256 h = 0; h < 5; h++) {
            uint256 epoch = h * mining.HALVING_INTERVAL();
            vm.store(address(mining), bytes32(epochCountSlot), bytes32(epoch));
            uint256 expected = mining.INITIAL_REWARD() >> h;
            assertEq(mining.getMiningReward(), expected, "halving step");
        }
    }

    /// Mining cleanly exhausts when tokensMinted reaches TOTAL_MINING_SUPPLY.
    function test_Mine_RevertsWhenExhausted() public {
        _openGates();
        // Fast-forward tokensMinted (slot 3) to exactly TOTAL.
        uint256 tokensMintedSlot = 3;
        vm.store(address(mining), bytes32(tokensMintedSlot), bytes32(mining.TOTAL_MINING_SUPPLY()));
        (uint256 nonce, bytes32 digest) = _findNonce(address(this));
        vm.expectRevert(POSCIMining.MiningExhausted.selector);
        mining.mine(nonce, digest);
    }

    /// Reward is automatically capped to remaining supply on the last block.
    function test_Mine_RewardCappedToRemaining() public {
        _openGates();
        // Set tokensMinted to TOTAL - 5 wei. Reward (1000e18) gets capped to 5 wei.
        uint256 tokensMintedSlot = 3;
        vm.store(address(mining), bytes32(tokensMintedSlot), bytes32(mining.TOTAL_MINING_SUPPLY() - 5));

        (uint256 nonce, bytes32 digest) = _findNonce(address(this));
        uint256 balBefore = token.balanceOf(address(this));
        mining.mine(nonce, digest);
        assertEq(token.balanceOf(address(this)) - balBefore, 5, "reward capped to 5 wei");
        assertEq(mining.tokensMinted(), mining.TOTAL_MINING_SUPPLY(), "exactly fills supply");
    }

    /// `solutionForChallenge` prevents double-spend of the same solution.
    /// Within the same block, `challengeNumber` after the first mine equals
    /// what it was before (the contract sets it to `blockhash(N-1)` which is
    /// invariant within block N), so the digest check passes but the mapping
    /// flags the solution as already claimed.
    function test_Mine_SameSolutionTwiceReverts_SameBlock() public {
        _openGates();
        (uint256 nonce, bytes32 digest) = _findNonce(address(this));
        mining.mine(nonce, digest);
        vm.expectRevert(POSCIMining.SolutionAlreadyClaimed.selector);
        mining.mine(nonce, digest);
    }

    /// Deployer has no special powers over `mine` itself — same path as anyone.
    function test_Deployer_CannotMineWithoutSolution() public {
        _openGates();
        bytes32 bogus = keccak256("not a real solution");
        vm.expectRevert(POSCIMining.WrongDigest.selector);
        mining.mine(0, bogus);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function _openGates() internal {
        vm.warp(block.timestamp + START_DELAY + 1);
        vm.prank(FAKE_GENESIS);
        mining.openPoolGate();
    }

    /// @dev Brute-force a nonce satisfying the (very easy) MAXIMUM_TARGET.
    ///      Uses inline assembly to reuse a single 84-byte memory buffer across
    ///      iterations. Without this, Solidity's `abi.encodePacked` allocates
    ///      fresh memory on every iteration and the quadratic memory expansion
    ///      cost OOMs around iteration ~50k. MAXIMUM_TARGET = 2^234, so the
    ///      expected number of iterations is ~2^22 ≈ 4M.
    function _findNonce(address miner) internal view returns (uint256 nonce, bytes32 digest) {
        bytes32 ch = mining.challengeNumber();
        uint256 target = mining.miningTarget();
        assembly {
            // Use a 84-byte scratch buffer at offset 128 (past Solidity's
            // reserved scratch + free-pointer slots).
            let p := 128
            mstore(p, ch)
            // miner << 96 places the 20-byte address at bytes [32..51], with
            // 12 trailing zero bytes that the next mstore overwrites with nonce.
            mstore(add(p, 32), shl(96, miner))
            for { } 1 { } {
                mstore(add(p, 52), nonce)
                digest := keccak256(p, 84)
                if iszero(gt(digest, target)) { break }
                nonce := add(nonce, 1)
                if eq(nonce, 20000000) { revert(0, 0) }
            }
        }
    }

    receive() external payable {}
}
