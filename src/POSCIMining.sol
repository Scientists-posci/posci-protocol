// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title  POSCIMining — Proof-of-Work mining for POSCI
/// @notice Mechanically equivalent to 0xBitcoin / WOTS:
///         hash includes msg.sender so a copied nonce is worthless to anyone else.
///
///         Two startup gates (both must pass):
///           Gate 1 (TIME): block.timestamp >= miningStartTime  (set immutably at construction)
///           Gate 2 (POOL): poolGateOpen == true                (set once by the bound Genesis contract)
///
///         No owner. No pause. No mint. No upgrade.
///         The only privileged action is `bindGenesis`, which is gated to the
///         deploy-time `msg.sender` (the deployer EOA), atomic with renouncement,
///         and callable exactly once. After that single tx the contract has no
///         privileged caller of any kind.
contract POSCIMining {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Constants — Bitcoin-style schedule, 20M emission cap
    // 1000 POSCI/reward * 10_000 rewards/halving * 2 (geometric series) = 20M
    // ---------------------------------------------------------------------
    uint256 public constant INITIAL_REWARD = 1_000 * 1e18;
    uint256 public constant HALVING_INTERVAL = 10_000;       // rewards per halving
    uint256 public constant MAX_HALVINGS = 64;               // reward effectively 0 after this
    uint256 public constant BLOCKS_PER_READJUSTMENT = 1024;  // rewards per difficulty retarget
    uint256 public constant TARGET_INTERVAL = 60;            // seconds per reward target
    uint256 public constant MAXIMUM_TARGET = 2 ** 234;       // easiest difficulty (retarget upper bound)
    uint256 public constant MINIMUM_TARGET = 2 ** 16;        // hardest difficulty cap
    // Initial difficulty is set 64x harder than MAXIMUM_TARGET so the first
    // 1024-mine epoch can't be vacuumed up by the first wallet to send a tx.
    // Calibration: at ~5 MH/s aggregate hashrate this gives ~60s per mine,
    // matching TARGET_INTERVAL. Retarget self-corrects from mine 1024 onward.
    uint256 public constant INITIAL_TARGET = 2 ** 228;
    uint256 public constant TOTAL_MINING_SUPPLY = 20_000_000 * 1e18;

    // ---------------------------------------------------------------------
    // Immutable
    // ---------------------------------------------------------------------
    IERC20  public immutable token;
    uint256 public immutable miningStartTime;
    /// @notice The EOA that deployed this contract — the only address allowed
    ///         to call `bindGenesis`. Captured from msg.sender at construction.
    ///         Without this guard, anyone could race the deployer to bind a
    ///         malicious genesis contract before the legit one is wired in.
    address public immutable deployer;

    // ---------------------------------------------------------------------
    // Mining state
    // ---------------------------------------------------------------------
    bytes32 public challengeNumber;
    uint256 public miningTarget;
    uint256 public epochCount;       // how many rewards have been paid out
    uint256 public tokensMinted;     // total POSCI emitted by this contract
    uint256 public lastRetargetTime; // timestamp of last difficulty retarget
    uint256 public lastRetargetEpoch;

    mapping(bytes32 => bool) public solutionForChallenge;

    // ---------------------------------------------------------------------
    // Genesis binding (one-shot, atomic — `bindGenesis` self-renounces)
    // ---------------------------------------------------------------------
    address public genesis;
    bool    public poolGateOpen;
    /// @notice True once `bindGenesis` has been called (by the deployer).
    ///         After this, the deployer has no privileges over this contract.
    bool    public bindingRenounced;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------
    event Mined(
        address indexed miner,
        uint256 reward,
        uint256 epochCount,
        bytes32 newChallengeNumber
    );
    event DifficultyRetargeted(
        uint256 oldTarget,
        uint256 newTarget,
        uint256 actualTime,
        uint256 expectedTime
    );
    event GenesisBound(address indexed genesis);
    event BindingRenounced();
    event PoolGateOpened();

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------
    error MiningNotStarted();
    error PoolGateClosed();
    error WrongDigest();
    error DifficultyNotMet();
    error SolutionAlreadyClaimed();
    error MiningExhausted();
    error AlreadyBound();
    error Renounced();
    error NotGenesis();
    error NotDeployer();
    error ZeroAddress();

    constructor(IERC20 _token, uint256 _miningStartTime) {
        if (address(_token) == address(0)) revert ZeroAddress();
        token = _token;
        miningStartTime = _miningStartTime;
        deployer = msg.sender;

        miningTarget = INITIAL_TARGET;
        lastRetargetTime = _miningStartTime;
        // First challenge uses deployment block hash; subsequent challenges
        // use the previous block's hash on every successful mint.
        challengeNumber = blockhash(block.number - 1);
    }

    // ---------------------------------------------------------------------
    // One-shot Genesis binding (deployer-only, self-renouncing)
    // ---------------------------------------------------------------------

    /// @notice Bind the Genesis contract that is allowed to open the pool gate
    ///         and atomically renounce the deployer's binding power. Callable
    ///         exactly once, by the deployer EOA.
    function bindGenesis(address _genesis) external {
        if (msg.sender != deployer)     revert NotDeployer();
        if (bindingRenounced)           revert Renounced();
        if (genesis != address(0))      revert AlreadyBound();
        if (_genesis == address(0))     revert ZeroAddress();
        genesis = _genesis;
        bindingRenounced = true;
        emit GenesisBound(_genesis);
        emit BindingRenounced();
    }

    /// @notice Called by the bound Genesis contract once the V4 pool is up.
    ///         One-way switch.
    function openPoolGate() external {
        if (msg.sender != genesis) revert NotGenesis();
        if (!poolGateOpen) {
            poolGateOpen = true;
            // Reset retarget clock so that the first epoch isn't penalised by
            // however long it took the genesis sale to fill.
            lastRetargetTime = block.timestamp;
            emit PoolGateOpened();
        }
    }

    // ---------------------------------------------------------------------
    // Mining
    // ---------------------------------------------------------------------

    /// @notice Submit a valid PoW solution to mint POSCI.
    /// @param  nonce             Miner-chosen nonce.
    /// @param  challengeDigest   Must equal keccak256(challengeNumber, msg.sender, nonce).
    function mine(uint256 nonce, bytes32 challengeDigest) external {
        if (block.timestamp < miningStartTime) revert MiningNotStarted();
        if (!poolGateOpen) revert PoolGateClosed();
        if (tokensMinted >= TOTAL_MINING_SUPPLY) revert MiningExhausted();

        bytes32 digest = keccak256(abi.encodePacked(challengeNumber, msg.sender, nonce));
        if (digest != challengeDigest) revert WrongDigest();
        if (uint256(digest) > miningTarget) revert DifficultyNotMet();
        if (solutionForChallenge[digest]) revert SolutionAlreadyClaimed();

        solutionForChallenge[digest] = true;

        uint256 reward = getMiningReward();
        // Cap the final reward so we never exceed TOTAL_MINING_SUPPLY by 1 wei.
        uint256 remaining = TOTAL_MINING_SUPPLY - tokensMinted;
        if (reward > remaining) reward = remaining;

        unchecked {
            epochCount += 1;
            tokensMinted += reward;
        }

        token.safeTransfer(msg.sender, reward);

        // Difficulty retarget every BLOCKS_PER_READJUSTMENT rewards.
        if (epochCount % BLOCKS_PER_READJUSTMENT == 0) {
            _reTarget();
        }

        challengeNumber = blockhash(block.number - 1);
        emit Mined(msg.sender, reward, epochCount, challengeNumber);
    }

    // ---------------------------------------------------------------------
    // Internal — difficulty retarget (Bitcoin-style, clamped 1/4 .. 4x)
    // ---------------------------------------------------------------------
    function _reTarget() internal {
        uint256 actualTime = block.timestamp - lastRetargetTime;
        if (actualTime == 0) actualTime = 1;
        uint256 expectedTime = TARGET_INTERVAL * BLOCKS_PER_READJUSTMENT;

        uint256 oldTarget = miningTarget;
        // newTarget = oldTarget * actualTime / expectedTime
        // (faster mining => actualTime < expectedTime => target shrinks => harder)
        uint256 newTarget = (oldTarget * actualTime) / expectedTime;

        // Clamp adjustment to [oldTarget/4, oldTarget*4]
        if (newTarget < oldTarget / 4) newTarget = oldTarget / 4;
        if (newTarget > oldTarget * 4) newTarget = oldTarget * 4;

        // Clamp to absolute bounds
        if (newTarget > MAXIMUM_TARGET) newTarget = MAXIMUM_TARGET;
        if (newTarget < MINIMUM_TARGET) newTarget = MINIMUM_TARGET;

        miningTarget = newTarget;
        lastRetargetTime = block.timestamp;
        lastRetargetEpoch = epochCount;
        emit DifficultyRetargeted(oldTarget, newTarget, actualTime, expectedTime);
    }

    // ---------------------------------------------------------------------
    // Views (frontend / dashboards)
    // ---------------------------------------------------------------------

    function getMiningReward() public view returns (uint256) {
        uint256 halvings = epochCount / HALVING_INTERVAL;
        if (halvings >= MAX_HALVINGS) return 0;
        return INITIAL_REWARD >> halvings;
    }

    function getMiningDifficulty() external view returns (uint256) {
        return MAXIMUM_TARGET / miningTarget;
    }

    function getChallengeNumber() external view returns (bytes32) {
        return challengeNumber;
    }

    function getMiningTarget() external view returns (uint256) {
        return miningTarget;
    }

    function getRemainingSupply() external view returns (uint256) {
        return TOTAL_MINING_SUPPLY - tokensMinted;
    }

    function getEpochsUntilHalving() external view returns (uint256) {
        return HALVING_INTERVAL - (epochCount % HALVING_INTERVAL);
    }

    /// @notice Convenience — what would `digest` be for these inputs?
    ///         Useful for off-chain miners cross-checking.
    function checkDigest(address miner, uint256 nonce) external view returns (bytes32) {
        return keccak256(abi.encodePacked(challengeNumber, miner, nonce));
    }
}
