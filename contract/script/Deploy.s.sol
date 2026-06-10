// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/AgentRegistry.sol";

contract Deploy is Script {
    function run() external {
        // forge script script/Deploy.s.sol \
        //   --rpc-url $ALCHEMY_RPC_URL \
        //   --broadcast \
        //   --account YOUR_KEYSTORE_NAME \
        //   --sender $DEPLOYER_ADDRESS \
        //   --verify \
        //   --etherscan-api-key $BASESCAN_API_KEY

        address deployer = vm.envAddress("DEPLOYER_ADDRESS");

        vm.startBroadcast();

        AgentRegistry registry = new AgentRegistry(deployer);

        vm.stopBroadcast();

        console.log("=== ARIA AgentRegistry Deployed ===");
        console.log("Address:    ", address(registry));
        console.log("Owner:      ", deployer);
        console.log("Network:    Base Sepolia (84532)");
    }
}
