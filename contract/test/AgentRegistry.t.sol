// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    // Mirror events for vm.expectEmit checks
    event AgentRegistered(
        bytes32 indexed agentId,
        address indexed owner,
        string[] capabilities,
        uint256 pricePerTask,
        string ipfsCID,
        uint256 timestamp
    );
    event AgentUpdated(
        bytes32 indexed agentId,
        address indexed owner,
        string newIpfsCID,
        uint256 newPrice,
        uint256 timestamp
    );
    event AgentDeactivated(bytes32 indexed agentId, address indexed owner, uint256 timestamp);
    event AgentReactivated(bytes32 indexed agentId, address indexed owner, uint256 timestamp);
    event TaskCompleted(
        bytes32 indexed agentId,
        address indexed owner,
        address indexed orchestrator,
        uint256 newTaskCount,
        uint256 timestamp
    );
    event RatingSubmitted(
        bytes32 indexed agentId,
        uint256 rating,
        uint256 newAverageX100,
        uint256 timestamp
    );
    event CapabilityRequested(
        string capability,
        uint256 totalDemand,
        address indexed requester,
        uint256 timestamp
    );
    event OrchestratorAuthorized(address indexed orchestrator, uint256 timestamp);
    event OrchestratorRevoked(address indexed orchestrator, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── State ────────────────────────────────────────────────────────────────

    AgentRegistry public registry;

    address public owner = makeAddr("owner");
    address public agentOwner = makeAddr("agentOwner");
    address public agentOwner2 = makeAddr("agentOwner2");
    address public orchestrator = makeAddr("orchestrator");
    address public stranger = makeAddr("stranger");

    string[] internal caps;
    string internal constant CID = "QmTestCID1234567890";
    string internal constant CID2 = "QmTestCID2222222222";
    uint256 internal constant PRICE = 2_000_000; // $2.00 USDC (6 decimals)

    function setUp() public {
        registry = new AgentRegistry(owner);

        vm.prank(owner);
        registry.authorizeOrchestrator(orchestrator);

        caps.push("web-search");
        caps.push("market-intelligence");
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    function _registerAgent(address agent, string[] memory _caps, uint256 price, string memory cid)
        internal
        returns (bytes32)
    {
        vm.prank(agent);
        return registry.registerAgent(_caps, price, cid);
    }

    // ─── 1. Registration ──────────────────────────────────────────────────────

    function test_RegisterAgent_Success() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        assertTrue(id != bytes32(0));

        AgentRegistry.Agent memory a = registry.getAgent(id);
        assertEq(a.owner, agentOwner);
        assertEq(a.pricePerTask, PRICE);
        assertEq(a.ipfsCID, CID);
        assertTrue(a.isActive);
        assertEq(a.capabilities.length, 2);
        assertEq(a.registeredAt, block.timestamp);
        assertEq(registry.totalAgents(), 1);
    }

    function test_RegisterAgent_EmptyCapabilities_Reverts() public {
        string[] memory empty;
        vm.prank(agentOwner);
        vm.expectRevert("No capabilities provided");
        registry.registerAgent(empty, PRICE, CID);
    }

    function test_RegisterAgent_ZeroPrice_Reverts() public {
        vm.prank(agentOwner);
        vm.expectRevert("Price must be non-zero");
        registry.registerAgent(caps, 0, CID);
    }

    function test_RegisterAgent_EmptyCID_Reverts() public {
        vm.prank(agentOwner);
        vm.expectRevert("IPFS CID required");
        registry.registerAgent(caps, PRICE, "");
    }

    function test_RegisterAgent_TwoAgentsSameOwner() public {
        bytes32 id1 = _registerAgent(agentOwner, caps, PRICE, CID);

        vm.warp(block.timestamp + 1);
        bytes32 id2 = _registerAgent(agentOwner, caps, PRICE, CID2);

        assertTrue(id1 != id2);
        assertEq(registry.totalAgents(), 2);

        bytes32[] memory owned = registry.getAgentsByOwner(agentOwner);
        assertEq(owned.length, 2);
    }

    // ─── 2. Update ────────────────────────────────────────────────────────────

    function test_UpdateAgent_OwnerCanUpdate() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);

        vm.expectEmit(true, true, false, true);
        emit AgentUpdated(id, agentOwner, CID2, PRICE * 2, block.timestamp);

        vm.prank(agentOwner);
        registry.updateAgent(id, CID2, PRICE * 2);

        AgentRegistry.Agent memory a = registry.getAgent(id);
        assertEq(a.ipfsCID, CID2);
        assertEq(a.pricePerTask, PRICE * 2);
        assertEq(a.capabilities.length, 2); // unchanged
    }

    function test_UpdateAgent_NonOwner_Reverts() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(stranger);
        vm.expectRevert("Not agent owner");
        registry.updateAgent(id, CID2, PRICE);
    }

    function test_UpdateAgent_NonExistent_Reverts() public {
        vm.prank(agentOwner);
        vm.expectRevert("Not agent owner");
        registry.updateAgent(bytes32(uint256(999)), CID2, PRICE);
    }

    function test_UpdateAgent_EmptyCID_Reverts() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(agentOwner);
        vm.expectRevert("IPFS CID required");
        registry.updateAgent(id, "", PRICE);
    }

    function test_UpdateAgent_ZeroPrice_Reverts() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(agentOwner);
        vm.expectRevert("Price must be non-zero");
        registry.updateAgent(id, CID2, 0);
    }

    // ─── 3. Deactivate / Reactivate ──────────────────────────────────────────

    function test_DeactivateAgent() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);

        vm.expectEmit(true, true, false, true);
        emit AgentDeactivated(id, agentOwner, block.timestamp);

        vm.prank(agentOwner);
        registry.deactivateAgent(id);

        assertFalse(registry.getAgent(id).isActive);
    }

    function test_DeactivateAgent_NonOwner_Reverts() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(stranger);
        vm.expectRevert("Not agent owner");
        registry.deactivateAgent(id);
    }

    function test_DeactivateAgent_AlreadyInactive_Reverts() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(agentOwner);
        registry.deactivateAgent(id);
        vm.prank(agentOwner);
        vm.expectRevert("Agent already inactive");
        registry.deactivateAgent(id);
    }

    function test_ReactivateAgent() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(agentOwner);
        registry.deactivateAgent(id);

        vm.expectEmit(true, true, false, true);
        emit AgentReactivated(id, agentOwner, block.timestamp);

        vm.prank(agentOwner);
        registry.reactivateAgent(id);
        assertTrue(registry.getAgent(id).isActive);
    }

    function test_ReactivateAgent_AlreadyActive_Reverts() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(agentOwner);
        vm.expectRevert("Agent already active");
        registry.reactivateAgent(id);
    }

    function test_DeactivatedAgent_NotReturnedByCapabilityQuery() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(agentOwner);
        registry.deactivateAgent(id);

        bytes32[] memory active = registry.getAgentsByCapability("web-search");
        assertEq(active.length, 0);
    }

    // ─── 4. Task Completion ───────────────────────────────────────────────────

    function test_RecordTaskCompletion_OrchestratorSucceeds() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);

        vm.expectEmit(true, true, true, true);
        emit TaskCompleted(id, agentOwner, orchestrator, 1, block.timestamp);

        vm.prank(orchestrator);
        registry.recordTaskCompletion(id);

        assertEq(registry.getAgent(id).tasksCompleted, 1);
        assertEq(registry.totalTasksCompleted(), 1);
    }

    function test_RecordTaskCompletion_Unauthorized_Reverts() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(stranger);
        vm.expectRevert("Not authorized orchestrator");
        registry.recordTaskCompletion(id);
    }

    function test_RecordTaskCompletion_IncrementsCorrectly() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.startPrank(orchestrator);
        registry.recordTaskCompletion(id);
        registry.recordTaskCompletion(id);
        registry.recordTaskCompletion(id);
        vm.stopPrank();

        assertEq(registry.getAgent(id).tasksCompleted, 3);
        assertEq(registry.totalTasksCompleted(), 3);
    }

    // ─── 5. Rating ────────────────────────────────────────────────────────────

    function test_SubmitRating_Valid() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        // totalRating += 4*100 = 400; newAverageX100 = (400*100)/1 = 40000
        uint256 expectedAvg = (400 * 100) / 1;

        vm.expectEmit(true, false, false, true);
        emit RatingSubmitted(id, 4, expectedAvg, block.timestamp);

        vm.prank(orchestrator);
        registry.submitRating(id, 4);
    }

    function test_SubmitRating_Zero_Reverts() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(orchestrator);
        vm.expectRevert("Rating must be 1-5");
        registry.submitRating(id, 0);
    }

    function test_SubmitRating_Six_Reverts() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(orchestrator);
        vm.expectRevert("Rating must be 1-5");
        registry.submitRating(id, 6);
    }

    function test_SubmitRating_AverageComputedCorrectly() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);

        vm.startPrank(orchestrator);
        registry.submitRating(id, 4); // totalRating=400, ratingCount=1
        registry.submitRating(id, 3); // totalRating=700, ratingCount=2
        registry.submitRating(id, 5); // totalRating=1200, ratingCount=3
        vm.stopPrank();

        // getAverageRating: (totalRating * 100) / ratingCount = (1200*100)/3 = 40000
        assertEq(registry.getAverageRating(id), (1200 * 100) / 3);
    }

    function test_SubmitRating_Unauthorized_Reverts() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(stranger);
        vm.expectRevert("Not authorized orchestrator");
        registry.submitRating(id, 5);
    }

    function test_GetAverageRating_NoRatings_ReturnsZero() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        assertEq(registry.getAverageRating(id), 0);
    }

    // ─── 6. Capability Discovery ──────────────────────────────────────────────

    function test_GetAgentsByCapability_OnlyActive() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.warp(block.timestamp + 1);
        bytes32 id2 = _registerAgent(agentOwner2, caps, PRICE, CID2);

        bytes32[] memory active = registry.getAgentsByCapability("web-search");
        assertEq(active.length, 2);

        vm.prank(agentOwner);
        registry.deactivateAgent(id);

        active = registry.getAgentsByCapability("web-search");
        assertEq(active.length, 1);
        assertEq(active[0], id2);
    }

    function test_GetAgentsByCapability_MultipleCapabilities() public {
        string[] memory singleCap = new string[](1);
        singleCap[0] = "image-generation";
        _registerAgent(agentOwner2, singleCap, PRICE, CID2);

        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);

        bytes32[] memory webSearchAgents = registry.getAgentsByCapability("web-search");
        assertEq(webSearchAgents.length, 1);
        assertEq(webSearchAgents[0], id);

        bytes32[] memory imgAgents = registry.getAgentsByCapability("image-generation");
        assertEq(imgAgents.length, 1);
    }

    function test_GetAgentsByCapability_EmptyCapability() public view {
        bytes32[] memory result = registry.getAgentsByCapability("nonexistent");
        assertEq(result.length, 0);
    }

    // ─── 7. Capability Gaps ───────────────────────────────────────────────────

    function test_RequestCapability_AnyoneCan() public {
        vm.expectEmit(false, false, true, true);
        emit CapabilityRequested("video-generation", 1, stranger, block.timestamp);

        vm.prank(stranger);
        registry.requestCapability("video-generation");

        assertEq(registry.capabilityDemand("video-generation"), 1);
    }

    function test_RequestCapability_IncrementsDemand() public {
        vm.prank(stranger);
        registry.requestCapability("video-generation");
        vm.prank(agentOwner);
        registry.requestCapability("video-generation");
        vm.prank(orchestrator);
        registry.requestCapability("video-generation");

        assertEq(registry.capabilityDemand("video-generation"), 3);
    }

    function test_GetCapabilityGaps_ReturnsAll() public {
        vm.prank(stranger);
        registry.requestCapability("video-generation");
        vm.prank(stranger);
        registry.requestCapability("video-generation");
        vm.prank(agentOwner);
        registry.requestCapability("audio-synthesis");

        (string[] memory capabilities, uint256[] memory demands) = registry.getCapabilityGaps();
        assertEq(capabilities.length, 2);
        assertEq(demands[0], 2); // video-generation
        assertEq(demands[1], 1); // audio-synthesis
    }

    function test_RequestCapability_FirstTimeOnlyAddsToList() public {
        registry.requestCapability("voice-cloning");
        registry.requestCapability("voice-cloning"); // second call should NOT add again

        (string[] memory capabilities,) = registry.getCapabilityGaps();
        assertEq(capabilities.length, 1);
    }

    // ─── 8. Orchestrator Management ───────────────────────────────────────────

    function test_AuthorizeOrchestrator() public {
        address newOrch = makeAddr("newOrch");
        assertFalse(registry.isOrchestrator(newOrch));

        vm.expectEmit(true, false, false, true);
        emit OrchestratorAuthorized(newOrch, block.timestamp);

        vm.prank(owner);
        registry.authorizeOrchestrator(newOrch);

        assertTrue(registry.isOrchestrator(newOrch));
    }

    function test_AuthorizeOrchestrator_NonOwner_Reverts() public {
        vm.prank(stranger);
        vm.expectRevert("Not contract owner");
        registry.authorizeOrchestrator(makeAddr("newOrch"));
    }

    function test_RevokeOrchestrator() public {
        vm.expectEmit(true, false, false, true);
        emit OrchestratorRevoked(orchestrator, block.timestamp);

        vm.prank(owner);
        registry.revokeOrchestrator(orchestrator);

        assertFalse(registry.isOrchestrator(orchestrator));

        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(orchestrator);
        vm.expectRevert("Not authorized orchestrator");
        registry.recordTaskCompletion(id);
    }

    function test_RevokeOrchestrator_NonOwner_Reverts() public {
        vm.prank(stranger);
        vm.expectRevert("Not contract owner");
        registry.revokeOrchestrator(orchestrator);
    }

    // ─── 9. All Events ────────────────────────────────────────────────────────

    function test_Event_AgentRegistered() public {
        vm.recordLogs();
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertGt(logs.length, 0);
        // topic[0]=sig, topic[1]=agentId, topic[2]=owner
        assertEq(logs[0].topics[1], id);
        assertEq(logs[0].topics[2], bytes32(uint256(uint160(agentOwner))));
    }

    function test_Event_AgentUpdated() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);

        vm.expectEmit(true, true, false, true);
        emit AgentUpdated(id, agentOwner, CID2, PRICE * 2, block.timestamp);

        vm.prank(agentOwner);
        registry.updateAgent(id, CID2, PRICE * 2);
    }

    function test_Event_AgentDeactivated() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);

        vm.expectEmit(true, true, false, true);
        emit AgentDeactivated(id, agentOwner, block.timestamp);

        vm.prank(agentOwner);
        registry.deactivateAgent(id);
    }

    function test_Event_AgentReactivated() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(agentOwner);
        registry.deactivateAgent(id);

        vm.expectEmit(true, true, false, true);
        emit AgentReactivated(id, agentOwner, block.timestamp);

        vm.prank(agentOwner);
        registry.reactivateAgent(id);
    }

    function test_Event_TaskCompleted() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);

        vm.expectEmit(true, true, true, true);
        emit TaskCompleted(id, agentOwner, orchestrator, 1, block.timestamp);

        vm.prank(orchestrator);
        registry.recordTaskCompletion(id);
    }

    function test_Event_RatingSubmitted() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        // totalRating += 5*100 = 500; newAverageX100 = (500*100)/1 = 50000
        uint256 expectedAvg = (500 * 100) / 1;

        vm.expectEmit(true, false, false, true);
        emit RatingSubmitted(id, 5, expectedAvg, block.timestamp);

        vm.prank(orchestrator);
        registry.submitRating(id, 5);
    }

    function test_Event_CapabilityRequested() public {
        vm.expectEmit(false, false, true, true);
        emit CapabilityRequested("video-generation", 1, stranger, block.timestamp);

        vm.prank(stranger);
        registry.requestCapability("video-generation");
    }

    function test_Event_OrchestratorAuthorized() public {
        address newOrch = makeAddr("newOrch");

        vm.expectEmit(true, false, false, true);
        emit OrchestratorAuthorized(newOrch, block.timestamp);

        vm.prank(owner);
        registry.authorizeOrchestrator(newOrch);
    }

    function test_Event_OrchestratorRevoked() public {
        vm.expectEmit(true, false, false, true);
        emit OrchestratorRevoked(orchestrator, block.timestamp);

        vm.prank(owner);
        registry.revokeOrchestrator(orchestrator);
    }

    function test_Event_OwnershipTransferred() public {
        address newOwner = makeAddr("newOwner");

        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferred(owner, newOwner);

        vm.prank(owner);
        registry.transferOwnership(newOwner);
    }

    // ─── 10. View Functions ───────────────────────────────────────────────────

    function test_GetAllActiveAgents() public {
        bytes32 id1 = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.warp(block.timestamp + 1);
        bytes32 id2 = _registerAgent(agentOwner2, caps, PRICE, CID2);

        bytes32[] memory active = registry.getAllActiveAgents();
        assertEq(active.length, 2);

        vm.prank(agentOwner);
        registry.deactivateAgent(id1);

        active = registry.getAllActiveAgents();
        assertEq(active.length, 1);
        assertEq(active[0], id2);
    }

    function test_GetAgentsByOwner() public {
        bytes32 id1 = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.warp(block.timestamp + 1);
        bytes32 id2 = _registerAgent(agentOwner, caps, PRICE, CID2);

        bytes32[] memory owned = registry.getAgentsByOwner(agentOwner);
        assertEq(owned.length, 2);
        assertEq(owned[0], id1);
        assertEq(owned[1], id2);
    }

    function test_GetAgentsByOwner_Empty() public view {
        bytes32[] memory owned = registry.getAgentsByOwner(stranger);
        assertEq(owned.length, 0);
    }

    function test_GetAverageRating_SingleRating() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.prank(orchestrator);
        registry.submitRating(id, 4);
        // totalRating=400, ratingCount=1 → (400*100)/1 = 40000
        assertEq(registry.getAverageRating(id), 40000);
    }

    function test_GetAverageRating_MultipleRatings() public {
        bytes32 id = _registerAgent(agentOwner, caps, PRICE, CID);
        vm.startPrank(orchestrator);
        registry.submitRating(id, 4); // totalRating=400
        registry.submitRating(id, 5); // totalRating=900
        vm.stopPrank();
        // (900*100)/2 = 45000
        assertEq(registry.getAverageRating(id), 45000);
    }

    function test_TransferOwnership_WorksCorrectly() public {
        address newOwner = makeAddr("newOwner");
        vm.prank(owner);
        registry.transferOwnership(newOwner);

        assertEq(registry.contractOwner(), newOwner);

        vm.prank(owner);
        vm.expectRevert("Not contract owner");
        registry.authorizeOrchestrator(makeAddr("anyone"));

        vm.prank(newOwner);
        registry.authorizeOrchestrator(makeAddr("anyone"));
    }

    function test_TransferOwnership_ZeroAddress_Reverts() public {
        vm.prank(owner);
        vm.expectRevert("Zero address");
        registry.transferOwnership(address(0));
    }

    function test_GetTotalAgents() public {
        assertEq(registry.getTotalAgents(), 0);
        _registerAgent(agentOwner, caps, PRICE, CID);
        assertEq(registry.getTotalAgents(), 1);
        vm.warp(block.timestamp + 1);
        _registerAgent(agentOwner2, caps, PRICE, CID2);
        assertEq(registry.getTotalAgents(), 2);
    }

    function test_IsOrchestrator() public view {
        assertTrue(registry.isOrchestrator(orchestrator));
        assertFalse(registry.isOrchestrator(stranger));
    }
}
