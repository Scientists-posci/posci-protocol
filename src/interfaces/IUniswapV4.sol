// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Minimal interfaces for the parts of Uniswap V4 we touch.
///         Full source: https://github.com/Uniswap/v4-core, https://github.com/Uniswap/v4-periphery
///         These are intentionally small — we don't import the full periphery
///         to avoid solc-version churn and to keep the surface area auditable.

type Currency is address;
type IHooks is address;

struct PoolKey {
    Currency currency0;
    Currency currency1;
    uint24  fee;
    int24   tickSpacing;
    IHooks  hooks;
}

/// @notice Uniswap V4 Action selectors (subset).
///         Source: v4-periphery `src/libraries/Actions.sol`.
library V4Actions {
    uint256 internal constant MINT_POSITION = 0x02;
    uint256 internal constant SETTLE_PAIR   = 0x0d;
    uint256 internal constant SWEEP         = 0x14;
}

interface IPositionManager {
    /// @notice Initialize a new pool. Returns the resulting tick.
    /// @dev    `payable` so it composes inside `multicall` delegatecalls that carry msg.value.
    function initializePool(PoolKey memory key, uint160 sqrtPriceX96) external payable returns (int24);

    /// @notice Execute a sequence of actions atomically inside a PoolManager `unlock`.
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;

    /// @notice Bundle multiple calls in one tx. Each `data[i]` must be an encoded
    ///         function call on this contract (delegatecall-style multicall).
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);

    /// @notice Next ERC-721 token id that will be assigned by `MINT_POSITION`.
    function nextTokenId() external view returns (uint256);

    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/// @notice Permit2 AllowanceTransfer interface.
///         Source: https://github.com/Uniswap/permit2
interface IAllowanceTransfer {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}
