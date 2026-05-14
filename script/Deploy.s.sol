// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";

import {POSCIToken}    from "../src/POSCIToken.sol";
import {POSCIMining}   from "../src/POSCIMining.sol";
import {POSCIGenesis, IMiningGate} from "../src/POSCIGenesis.sol";
import {IPositionManager, IAllowanceTransfer} from "../src/interfaces/IUniswapV4.sol";

/// @notice Atomic launch script:
///   1. Deploy POSCIToken (mints 21M to deployer)
///   2. Deploy POSCIMining with timestamp gate
///   3. Deploy POSCIGenesis wired to mining + V4
///   4. Move 500_000 POSCI to genesis (250k sale + 250k LP)
///   5. Move 20_500_000 POSCI to mining — the extra 500K (formerly the
///      deployer reserve) sits past TOTAL_MINING_SUPPLY = 20M and is
///      unreachable, so it is effectively burned. No founder allocation.
///   6. Bind genesis to mining, then renounce binding (one-shot lock)
///   7. Deployer ends with 0 POSCI — no reserve to hold or evacuate.
///
/// Usage:
///   forge script script/Deploy.s.sol:DeployScript \
///       --rpc-url $MAINNET_RPC_URL \
///       --private-key $DEPLOYER_PRIVATE_KEY \
///       --broadcast --verify
contract DeployScript is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        IPositionManager   posMgr  = IPositionManager(vm.envAddress("V4_POSITION_MANAGER"));
        IAllowanceTransfer permit2 = IAllowanceTransfer(vm.envAddress("PERMIT2"));

        uint256 startDelayHours = vm.envOr("MINING_START_DELAY_HOURS", uint256(24));
        uint256 miningStart = block.timestamp + startDelayHours * 1 hours;

        console2.log("Deployer:           ", deployer);
        console2.log("V4 PositionManager: ", address(posMgr));
        console2.log("Permit2:            ", address(permit2));
        console2.log("Mining start (ts):  ", miningStart);

        vm.startBroadcast(pk);

        // 1. Token — mints all 21M to deployer
        POSCIToken token = new POSCIToken(deployer);
        console2.log("POSCIToken:         ", address(token));

        // 2. Mining — gate 1 (time) baked in
        POSCIMining mining = new POSCIMining(token, miningStart);
        console2.log("POSCIMining:        ", address(mining));

        // 3. Genesis — IMiningGate is satisfied by POSCIMining.openPoolGate()
        POSCIGenesis genesis = new POSCIGenesis(
            token,
            IMiningGate(address(mining)),
            posMgr,
            permit2
        );
        console2.log("POSCIGenesis:       ", address(genesis));

        // 4-5. Distribute supply: 500K to genesis (250K sale + 250K LP, same
        //      as v1) and 20.5M to mining. The extra 500K in mining is past
        //      its 20M emission cap and is structurally unreachable — the
        //      former founder reserve is effectively burned. Deployer = 0.
        token.transfer(address(genesis), 500_000    * 1e18);
        token.transfer(address(mining),  20_500_000 * 1e18);

        // 6. Bind genesis to mining (atomically renounces deployer's binding power)
        mining.bindGenesis(address(genesis));

        vm.stopBroadcast();

        // Sanity prints — fail loudly if anything is off.
        console2.log("--- Post-deploy ---");
        console2.log("Deployer POSCI:     ", token.balanceOf(deployer));
        console2.log("Genesis POSCI:      ", token.balanceOf(address(genesis)));
        console2.log("Mining POSCI:       ", token.balanceOf(address(mining)));
        require(token.balanceOf(deployer)         == 0,                 "deployer balance");
        require(token.balanceOf(address(genesis)) == 500_000    * 1e18, "genesis balance");
        require(token.balanceOf(address(mining))  == 20_500_000 * 1e18, "mining balance");
        require(mining.genesis() == address(genesis),                   "binding");
        require(mining.bindingRenounced(),                              "renounced (atomic)");
        require(mining.deployer() == deployer,                          "deployer immutable");
    }
}
