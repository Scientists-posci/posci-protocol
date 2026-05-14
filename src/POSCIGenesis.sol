// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {Currency, IHooks, PoolKey, V4Actions, IPositionManager, IAllowanceTransfer} from "./interfaces/IUniswapV4.sol";

interface IMiningGate {
    function openPoolGate() external;
}

/// @title  POSCIGenesis — fair, atomic launch onto Uniswap V4
/// @notice Sells 250,000 POSCI for a 0.5 ETH cap. As soon as the cap fills,
///         the SAME transaction:
///           1. Initializes the POSCI/ETH V4 pool at the genesis price
///           2. Mints a full-range LP position with the collected ETH + 250k POSCI
///           3. Burns the LP NFT to 0xdEaD (permanent lock)
///           4. Opens the pool gate on the mining contract
///
///         No owner. No upgrade. No way to pull funds. The deployer never touches ETH.
contract POSCIGenesis is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Genesis economics — immutable, baked into the contract
    // ---------------------------------------------------------------------
    uint256 public constant GENESIS_HARD_CAP    = 0.5 ether;
    uint256 public constant GENESIS_PER_WALLET  = 0.05 ether;        // anti-whale: ≥ 10 buyers
    uint256 public constant POSCI_FOR_GENESIS   = 250_000 * 1e18;    // sold to genesis buyers
    uint256 public constant POSCI_FOR_LP        = 250_000 * 1e18;    // paired with collected ETH
    uint256 public constant TOKEN_PRICE_DENOM   = GENESIS_HARD_CAP;  // simplifies math

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // V4 full-range with fee tier 3000 → tickSpacing 60
    uint24 public constant POOL_FEE     = 3000;
    int24  public constant TICK_SPACING = 60;

    // Time-fallback so a never-filled cap can never permanently gate mining.
    uint256 public constant FORCE_BOOTSTRAP_DELAY = 1 days;
    // Below this, V4 LP math rounds to zero — fall back to "burn POSCI + open gate, no pool".
    uint256 public constant MIN_BOOTSTRAP_ETH     = 0.01 ether;

    // ---------------------------------------------------------------------
    // Immutable wiring
    // ---------------------------------------------------------------------
    IERC20            public immutable token;
    IMiningGate       public immutable mining;
    IPositionManager  public immutable positionManager;
    IAllowanceTransfer public immutable permit2;
    uint256           public immutable deployedAt;

    // ---------------------------------------------------------------------
    // Mutable state (only ever progresses forward)
    // ---------------------------------------------------------------------
    uint256 public totalContributed;
    bool    public bootstrapped;
    mapping(address => uint256) public contributed;

    // ---------------------------------------------------------------------
    // Events / errors
    // ---------------------------------------------------------------------
    event GenesisBuy(address indexed buyer, uint256 ethIn, uint256 posciOut);
    event Bootstrapped(uint256 ethToLp, uint256 posciToLp, uint256 lpTokenId);
    event LpBurned(uint256 lpTokenId);
    event ForceBootstrapped(uint256 ethToLp, uint256 posciToLp, uint256 posciBurned);

    error GenesisClosed();
    error WalletCapExceeded();
    error ZeroValue();
    error UseBuyGenesis();
    error TooEarly();
    error InsufficientPosci();

    constructor(
        IERC20            _token,
        IMiningGate       _mining,
        IPositionManager  _positionManager,
        IAllowanceTransfer _permit2
    ) {
        require(address(_token) != address(0), "zero token");
        require(address(_mining) != address(0), "zero mining");
        require(address(_positionManager) != address(0), "zero posMgr");
        require(address(_permit2) != address(0), "zero permit2");

        token            = _token;
        mining           = _mining;
        positionManager  = _positionManager;
        permit2          = _permit2;

        // Pre-approve POSCI to Permit2 (one-shot, max). Permit2 in turn will be
        // used to grant a long-lived allowance to PositionManager during bootstrap.
        IERC20(_token).approve(address(_permit2), type(uint256).max);

        deployedAt = block.timestamp;
    }

    // ---------------------------------------------------------------------
    // Public entry point
    // ---------------------------------------------------------------------

    /// @notice Buy POSCI at the fixed genesis price by sending ETH.
    ///         Triggers atomic bootstrap if this purchase fills the cap.
    function buyGenesis() external payable nonReentrant {
        if (bootstrapped) revert GenesisClosed();
        if (msg.value == 0) revert ZeroValue();

        uint256 ethIn = msg.value;
        uint256 ethRoom = GENESIS_HARD_CAP - totalContributed;
        // Cap to remaining room — refund the excess at the end.
        uint256 ethRefund = 0;
        if (ethIn > ethRoom) {
            ethRefund = ethIn - ethRoom;
            ethIn = ethRoom;
        }

        uint256 newPersonal = contributed[msg.sender] + ethIn;
        if (newPersonal > GENESIS_PER_WALLET) revert WalletCapExceeded();

        contributed[msg.sender] = newPersonal;
        totalContributed += ethIn;

        // POSCI out = POSCI_FOR_GENESIS * ethIn / GENESIS_HARD_CAP
        uint256 posciOut = (POSCI_FOR_GENESIS * ethIn) / GENESIS_HARD_CAP;
        token.safeTransfer(msg.sender, posciOut);

        emit GenesisBuy(msg.sender, ethIn, posciOut);

        // If we just filled the cap, bootstrap the pool in the same tx.
        if (totalContributed >= GENESIS_HARD_CAP) {
            _bootstrap();
        }

        // Refund any over-payment last (CEI).
        if (ethRefund > 0) {
            (bool ok, ) = msg.sender.call{value: ethRefund}("");
            require(ok, "refund failed");
        }
    }

    receive() external payable {
        revert UseBuyGenesis();
    }

    // ---------------------------------------------------------------------
    // Time-fallback: anyone may finalize Genesis after FORCE_BOOTSTRAP_DELAY,
    // even if the cap never filled. Pool is built proportionally from whatever
    // ETH was actually raised; unsold genesis POSCI is burned to keep the
    // designed price ratio intact for buyers.
    // ---------------------------------------------------------------------
    function forceBootstrap() external nonReentrant {
        if (bootstrapped) revert GenesisClosed();
        if (block.timestamp < deployedAt + FORCE_BOOTSTRAP_DELAY) revert TooEarly();
        _forceBootstrap();
    }

    function _forceBootstrap() internal {
        bootstrapped = true;

        // Use accounting, not balance — guards against ETH injected via
        // SELFDESTRUCT. Any such excess is stranded (no withdraw exists).
        uint256 ethForLp = totalContributed;

        // Below the dust threshold V4 liquidity math rounds to zero and the
        // pool init would revert. Fall back to: burn all genesis POSCI and
        // just open the mining gate. Mining can run without an initial pool;
        // a Uniswap pool can be seeded later by anyone.
        if (ethForLp < MIN_BOOTSTRAP_ETH) {
            uint256 posciDust = token.balanceOf(address(this));
            if (posciDust > 0) {
                token.safeTransfer(DEAD, posciDust);
            }
            mining.openPoolGate();
            emit ForceBootstrapped(0, 0, posciDust);
            return;
        }

        // Proportional LP: same price ratio as designed, shallower pool.
        // posciForLp / ethForLp == POSCI_FOR_LP / GENESIS_HARD_CAP, so
        // sqrtPriceX96 (line below in _bootstrapWithAmounts) is unchanged.
        uint256 posciForLp = (POSCI_FOR_LP * totalContributed) / GENESIS_HARD_CAP;
        uint256 posciInContract = token.balanceOf(address(this));
        if (posciInContract < posciForLp) revert InsufficientPosci();

        uint256 posciToBurn = posciInContract - posciForLp;
        if (posciToBurn > 0) {
            token.safeTransfer(DEAD, posciToBurn);
        }

        _bootstrapWithAmounts(ethForLp, posciForLp);
        emit ForceBootstrapped(ethForLp, posciForLp, posciToBurn);
    }

    // ---------------------------------------------------------------------
    // Atomic bootstrap: init pool, mint full-range LP, burn LP NFT, open gate
    // ---------------------------------------------------------------------
    function _bootstrap() internal {
        bootstrapped = true;
        _bootstrapWithAmounts(GENESIS_HARD_CAP, POSCI_FOR_LP);
    }

    function _bootstrapWithAmounts(uint256 ethForLp, uint256 posciForLp) internal {
        // Grant PositionManager a long-lived Permit2 allowance for POSCI.
        permit2.approve(
            address(token),
            address(positionManager),
            uint160(posciForLp),
            type(uint48).max
        );

        // -----------------------------------------------------------------
        // Pool key. ETH (currency0 = address(0)) is always less than POSCI,
        // so currency0 = ETH, currency1 = POSCI.
        // -----------------------------------------------------------------
        PoolKey memory key = PoolKey({
            currency0:   Currency.wrap(address(0)),
            currency1:   Currency.wrap(address(token)),
            fee:         POOL_FEE,
            tickSpacing: TICK_SPACING,
            hooks:       IHooks.wrap(address(0))
        });

        // -----------------------------------------------------------------
        // sqrtPriceX96 = sqrt(amount1/amount0) * 2^96, computed via two-step
        // shift-then-sqrt to avoid uint256 overflow.
        //
        //   priceX96     = (amount1 << 96) / amount0
        //   sqrtPriceX96 = sqrt(priceX96) << 48
        //
        // For our genesis amounts (250000e18 POSCI, 0.5e18 ETH) the result is
        // sqrtPriceX96 ≈ 5.6022e31, well within uint160.
        // -----------------------------------------------------------------
        uint256 priceX96 = (posciForLp << 96) / ethForLp;
        uint160 sqrtPriceX96 = uint160(Math.sqrt(priceX96) << 48);

        // -----------------------------------------------------------------
        // Full-range ticks aligned to tickSpacing.
        //   MIN_TICK = -887272, MAX_TICK = 887272 (V4 / V3 share constants)
        //   For tickSpacing 60: ±887220
        // -----------------------------------------------------------------
        int24 tickLower = -887220;
        int24 tickUpper =  887220;

        // -----------------------------------------------------------------
        // Liquidity for full-range with both amounts known.
        // For the canonical Uniswap formula at full range with both sides
        // funded, L is bounded by both:
        //   L0 = amount0 * sqrtPriceX96 * sqrtPriceUpperX96 / (sqrtPriceUpperX96 - sqrtPriceX96) / 2^96
        //   L1 = amount1 * 2^96 / (sqrtPriceX96 - sqrtPriceLowerX96)
        // We use min(L0, L1). The on-chain V4 will accept any L ≤ both bounds
        // and consume amounts proportionally; PositionManager's amount0Max /
        // amount1Max slippage params (set to the full balances) guarantee we
        // never spend more than we have.
        // -----------------------------------------------------------------
        uint128 liquidity = _getLiquidityForAmounts(
            sqrtPriceX96,
            _getSqrtPriceAtTick(tickLower),
            _getSqrtPriceAtTick(tickUpper),
            ethForLp,
            posciForLp
        );

        // Snapshot the LP token id we'll receive.
        uint256 lpTokenId = positionManager.nextTokenId();

        // -----------------------------------------------------------------
        // Build the V4 multicall: initializePool + modifyLiquidities(MINT)
        // -----------------------------------------------------------------
        bytes[] memory mc = new bytes[](2);

        mc[0] = abi.encodeCall(
            IPositionManager.initializePool,
            (key, sqrtPriceX96)
        );

        bytes memory actions = abi.encodePacked(
            uint8(V4Actions.MINT_POSITION),
            uint8(V4Actions.SETTLE_PAIR),
            uint8(V4Actions.SWEEP)
        );
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            key,
            tickLower,
            tickUpper,
            liquidity,
            ethForLp,        // amount0Max
            posciForLp,      // amount1Max
            address(this),   // recipient of the LP NFT (we'll burn it next)
            bytes("")        // hookData
        );
        params[1] = abi.encode(key.currency0, key.currency1);
        // Sweep leftover ETH dust to 0xdEaD instead of `address(this)`. The
        // V4 liquidity math leaves a few wei of dust per bootstrap; if we
        // tried to receive it, our `receive()` would revert with UseBuyGenesis
        // and the whole bootstrap would fail. Burning the dust is cheaper
        // than weakening the receive guard.
        params[2] = abi.encode(key.currency0, DEAD);

        bytes memory unlockData = abi.encode(actions, params);

        mc[1] = abi.encodeCall(
            IPositionManager.modifyLiquidities,
            (unlockData, block.timestamp + 60)
        );

        positionManager.multicall{value: ethForLp}(mc);

        // Verify we own the NFT before burning.
        require(positionManager.ownerOf(lpTokenId) == address(this), "lp not received");

        // Permanently lock by sending the LP NFT to 0xdEaD.
        positionManager.transferFrom(address(this), DEAD, lpTokenId);

        // Open the second mining gate.
        mining.openPoolGate();

        emit Bootstrapped(ethForLp, posciForLp, lpTokenId);
        emit LpBurned(lpTokenId);
    }

    // ---------------------------------------------------------------------
    // Math helpers (inlined Uniswap V3/V4 formulas — keeps us off the heavy
    // periphery import surface). These match v4-core/TickMath and
    // v4-periphery/LiquidityAmounts byte-for-byte for our tick range.
    // ---------------------------------------------------------------------

    /// @dev Direct port of TickMath.getSqrtPriceAtTick (V4) / getSqrtRatioAtTick (V3).
    function _getSqrtPriceAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
        require(absTick <= 887272, "T");

        uint256 ratio = absTick & 0x1 != 0
            ? 0xfffcb933bd6fad37aa2d162d1a594001
            : 0x100000000000000000000000000000000;
        if (absTick & 0x2 != 0) ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
        if (absTick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
        if (absTick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
        if (absTick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
        if (absTick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
        if (absTick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
        if (absTick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
        if (absTick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
        if (absTick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
        if (absTick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
        if (absTick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
        if (absTick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
        if (absTick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
        if (absTick & 0x4000 != 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
        if (absTick & 0x8000 != 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
        if (absTick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
        if (absTick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
        if (absTick & 0x40000 != 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
        if (absTick & 0x80000 != 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;

        if (tick > 0) ratio = type(uint256).max / ratio;
        // Round up after downcast to uint160.
        sqrtPriceX96 = uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
    }

    /// @dev Port of v4-periphery LiquidityAmounts.getLiquidityForAmounts.
    function _getLiquidityForAmounts(
        uint160 sqrtPriceX96,
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint256 amount0,
        uint256 amount1
    ) internal pure returns (uint128 liquidity) {
        if (sqrtPriceAX96 > sqrtPriceBX96) (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);

        if (sqrtPriceX96 <= sqrtPriceAX96) {
            liquidity = _getLiquidityForAmount0(sqrtPriceAX96, sqrtPriceBX96, amount0);
        } else if (sqrtPriceX96 < sqrtPriceBX96) {
            uint128 l0 = _getLiquidityForAmount0(sqrtPriceX96, sqrtPriceBX96, amount0);
            uint128 l1 = _getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceX96, amount1);
            liquidity = l0 < l1 ? l0 : l1;
        } else {
            liquidity = _getLiquidityForAmount1(sqrtPriceAX96, sqrtPriceBX96, amount1);
        }
    }

    function _getLiquidityForAmount0(
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint256 amount0
    ) internal pure returns (uint128 liquidity) {
        if (sqrtPriceAX96 > sqrtPriceBX96) (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        uint256 intermediate = Math.mulDiv(uint256(sqrtPriceAX96), uint256(sqrtPriceBX96), 1 << 96);
        liquidity = _toUint128(Math.mulDiv(amount0, intermediate, sqrtPriceBX96 - sqrtPriceAX96));
    }

    function _getLiquidityForAmount1(
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint256 amount1
    ) internal pure returns (uint128 liquidity) {
        if (sqrtPriceAX96 > sqrtPriceBX96) (sqrtPriceAX96, sqrtPriceBX96) = (sqrtPriceBX96, sqrtPriceAX96);
        liquidity = _toUint128(Math.mulDiv(amount1, 1 << 96, sqrtPriceBX96 - sqrtPriceAX96));
    }

    function _toUint128(uint256 x) internal pure returns (uint128) {
        require(x <= type(uint128).max, "overflow");
        return uint128(x);
    }
}
