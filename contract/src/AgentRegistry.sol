// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AgentRegistry {
    // ─── Errors ───────────────────────────────────────────────────────────────

    error NotContractOwner();
    error NotAgentOwner();
    error NotAuthorizedOrchestrator();
    error AgentDoesNotExist();
    error ZeroAddress();
    error NoCapabilitiesProvided();
    error PriceMustBeNonZero();
    error IpfsCIDRequired();
    error AgentIdCollision();
    error AgentAlreadyInactive();
    error AgentAlreadyActive();
    error InvalidRating();

    // ─── Types ────────────────────────────────────────────────────────────────

    struct Agent {
        address owner;
        string[] capabilities;
        uint256 pricePerTask;
        string ipfsCID;
        bool isActive;
        uint256 tasksCompleted;
        uint256 totalRating;
        uint256 ratingCount;
        uint256 registeredAt;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    mapping(bytes32 => Agent) public agents;
    bytes32[] public agentIds;
    mapping(string => bytes32[]) public capabilityToAgents;
    mapping(address => bytes32[]) public ownerAgents;
    mapping(string => uint256) public capabilityDemand;
    string[] public demandedCapabilities;
    mapping(address => bool) public authorizedOrchestrators;
    address public contractOwner;
    uint256 public totalAgents;
    uint256 public totalTasksCompleted;

    // ─── Events ───────────────────────────────────────────────────────────────

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

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyContractOwner() {
        if (msg.sender != contractOwner) revert NotContractOwner();
        _;
    }

    modifier onlyAgentOwner(bytes32 agentId) {
        if (agents[agentId].owner != msg.sender) revert NotAgentOwner();
        _;
    }

    modifier onlyOrchestrator() {
        if (!authorizedOrchestrators[msg.sender]) revert NotAuthorizedOrchestrator();
        _;
    }

    modifier agentExists(bytes32 agentId) {
        if (agents[agentId].owner == address(0)) revert AgentDoesNotExist();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _owner) {
        if (_owner == address(0)) revert ZeroAddress();
        contractOwner = _owner;
    }

    // ─── Write Functions ──────────────────────────────────────────────────────

    function registerAgent(
        string[] calldata capabilities,
        uint256 pricePerTask,
        string calldata ipfsCID
    ) external returns (bytes32 agentId) {
        if (capabilities.length == 0) revert NoCapabilitiesProvided();
        if (pricePerTask == 0) revert PriceMustBeNonZero();
        if (bytes(ipfsCID).length == 0) revert IpfsCIDRequired();

        agentId = keccak256(abi.encodePacked(msg.sender, ipfsCID, block.timestamp));
        if (agents[agentId].owner != address(0)) revert AgentIdCollision();

        Agent storage agent = agents[agentId];
        agent.owner = msg.sender;
        agent.pricePerTask = pricePerTask;
        agent.ipfsCID = ipfsCID;
        agent.isActive = true;
        agent.registeredAt = block.timestamp;

        for (uint256 i = 0; i < capabilities.length; i++) {
            agent.capabilities.push(capabilities[i]);
            capabilityToAgents[capabilities[i]].push(agentId);
        }

        agentIds.push(agentId);
        ownerAgents[msg.sender].push(agentId);
        totalAgents++;

        emit AgentRegistered(agentId, msg.sender, capabilities, pricePerTask, ipfsCID, block.timestamp);
    }

    function updateAgent(
        bytes32 agentId,
        string calldata newIpfsCID,
        uint256 newPrice
    ) external onlyAgentOwner(agentId) agentExists(agentId) {
        if (bytes(newIpfsCID).length == 0) revert IpfsCIDRequired();
        if (newPrice == 0) revert PriceMustBeNonZero();

        agents[agentId].ipfsCID = newIpfsCID;
        agents[agentId].pricePerTask = newPrice;

        emit AgentUpdated(agentId, msg.sender, newIpfsCID, newPrice, block.timestamp);
    }

    function deactivateAgent(bytes32 agentId)
        external
        onlyAgentOwner(agentId)
        agentExists(agentId)
    {
        if (!agents[agentId].isActive) revert AgentAlreadyInactive();
        agents[agentId].isActive = false;
        emit AgentDeactivated(agentId, msg.sender, block.timestamp);
    }

    function reactivateAgent(bytes32 agentId)
        external
        onlyAgentOwner(agentId)
        agentExists(agentId)
    {
        if (agents[agentId].isActive) revert AgentAlreadyActive();
        agents[agentId].isActive = true;
        emit AgentReactivated(agentId, msg.sender, block.timestamp);
    }

    function recordTaskCompletion(bytes32 agentId)
        external
        onlyOrchestrator
        agentExists(agentId)
    {
        agents[agentId].tasksCompleted++;
        totalTasksCompleted++;

        emit TaskCompleted(
            agentId,
            agents[agentId].owner,
            msg.sender,
            agents[agentId].tasksCompleted,
            block.timestamp
        );
    }

    function submitRating(bytes32 agentId, uint256 rating)
        external
        onlyOrchestrator
        agentExists(agentId)
    {
        if (rating < 1 || rating > 5) revert InvalidRating();

        Agent storage agent = agents[agentId];
        agent.totalRating += rating * 100;
        agent.ratingCount++;

        uint256 newAverageX100 = (agent.totalRating * 100) / agent.ratingCount;

        emit RatingSubmitted(agentId, rating, newAverageX100, block.timestamp);
    }

    function requestCapability(string calldata capability) external {
        if (capabilityDemand[capability] == 0) {
            demandedCapabilities.push(capability);
        }
        capabilityDemand[capability]++;

        emit CapabilityRequested(capability, capabilityDemand[capability], msg.sender, block.timestamp);
    }

    function authorizeOrchestrator(address orchestrator) external onlyContractOwner {
        if (orchestrator == address(0)) revert ZeroAddress();
        authorizedOrchestrators[orchestrator] = true;
        emit OrchestratorAuthorized(orchestrator, block.timestamp);
    }

    function revokeOrchestrator(address orchestrator) external onlyContractOwner {
        authorizedOrchestrators[orchestrator] = false;
        emit OrchestratorRevoked(orchestrator, block.timestamp);
    }

    function transferOwnership(address newOwner) external onlyContractOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previous = contractOwner;
        contractOwner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getAgent(bytes32 agentId) external view returns (Agent memory) {
        return agents[agentId];
    }

    function getAgentsByCapability(string calldata capability)
        external
        view
        returns (bytes32[] memory activeIds)
    {
        bytes32[] storage all = capabilityToAgents[capability];
        uint256 count = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (agents[all[i]].isActive) count++;
        }

        activeIds = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (agents[all[i]].isActive) {
                activeIds[idx++] = all[i];
            }
        }
    }

    function getAgentsByOwner(address owner) external view returns (bytes32[] memory) {
        return ownerAgents[owner];
    }

    function getAllActiveAgents() external view returns (bytes32[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < agentIds.length; i++) {
            if (agents[agentIds[i]].isActive) count++;
        }

        bytes32[] memory activeIds = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < agentIds.length; i++) {
            if (agents[agentIds[i]].isActive) {
                activeIds[idx++] = agentIds[i];
            }
        }
        return activeIds;
    }

    function getAverageRating(bytes32 agentId) external view returns (uint256) {
        Agent storage agent = agents[agentId];
        if (agent.ratingCount == 0) return 0;
        return (agent.totalRating * 100) / agent.ratingCount;
    }

    function getCapabilityGaps()
        external
        view
        returns (string[] memory capabilities, uint256[] memory demands)
    {
        capabilities = demandedCapabilities;
        demands = new uint256[](demandedCapabilities.length);
        for (uint256 i = 0; i < demandedCapabilities.length; i++) {
            demands[i] = capabilityDemand[demandedCapabilities[i]];
        }
    }

    function isOrchestrator(address addr) external view returns (bool) {
        return authorizedOrchestrators[addr];
    }

    function getTotalAgents() external view returns (uint256) {
        return totalAgents;
    }
}
