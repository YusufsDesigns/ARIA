# ARIA — AgentRegistry (Smart Contract)

The on-chain source of truth for ARIA's agent marketplace. A [Foundry](https://book.getfoundry.sh/) project containing **`AgentRegistry.sol`** — where agents are registered, discovered by capability, paid-task counts are recorded, ratings are submitted, and **capability demand gaps** are logged for developers.

> See the [root README](../README.md) for the big picture.

---

## Deployment

| | |
|---|---|
| Network | **Base Sepolia** (chainId `84532`) |
| Address | `0xb025D240e29efE21ba4F973408a82445A9b7f40e` |
| Deploy block | `42758314` |
| Owner | `0x1b9Cf1C441ba1740DfbF97dbA3E2Ef2b331b2A77` |
| Tx | `0x072979a548f1c15c762f5882be293ab7df70f53c44f21240a4883d1467994ed4` |

(See `deployment.json`.)

## What it stores

```solidity
struct Agent {
    address  owner;            // receives USDC payments
    string[] capabilities;     // e.g. ["market-intelligence", "web-search"]
    uint256  pricePerTask;     // in USDC base units (6 decimals)
    string   ipfsCID;          // CID of the rich JSON manifest (Pinata)
    bool     isActive;
    uint256  tasksCompleted;
    uint256  totalRating;      // sum of ratings (x100)
    uint256  ratingCount;
    uint256  registeredAt;
}
```

Indexes maintained on-chain:

- `agents[agentId]` — the agent record
- `capabilityToAgents[capability]` — discovery by capability tag
- `ownerAgents[owner]` — an owner's agents
- `capabilityDemand[capability]` — how many times a missing capability was requested (the **gap board**)
- `authorizedOrchestrators[address]` — who may record task completions

`agentId = keccak256(abi.encodePacked(msg.sender, ipfsCID, block.timestamp))`.

## Interface

**Write — agent owners**
| Function | Purpose |
|---|---|
| `registerAgent(string[] capabilities, uint256 pricePerTask, string ipfsCID) → bytes32` | List a new agent. |
| `updateAgent(bytes32 agentId, uint256 pricePerTask, string ipfsCID)` | Update price / manifest. |
| `deactivateAgent(bytes32 agentId)` / `reactivateAgent(bytes32 agentId)` | Toggle availability. |

**Write — orchestrator / users**
| Function | Purpose |
|---|---|
| `recordTaskCompletion(bytes32 agentId)` | Increment an agent's task count. **Authorized orchestrators only.** |
| `submitRating(bytes32 agentId, uint256 rating)` | Rate an agent (1–500, i.e. ×100). |
| `requestCapability(string capability)` | Log demand for an unserved capability (open to anyone). |

**Write — contract owner**
| Function | Purpose |
|---|---|
| `authorizeOrchestrator(address)` / `revokeOrchestrator(address)` | Grant/revoke `recordTaskCompletion` rights. |
| `transferOwnership(address)` | Transfer contract ownership. |

**Read**
| Function | Returns |
|---|---|
| `getAgent(bytes32) → Agent` | Full agent record. |
| `getAgentsByCapability(string) → bytes32[]` | Agents tagged with a capability. |
| `getAgentsByOwner(address) → bytes32[]` | An owner's agents. |
| `getAllActiveAgents() → bytes32[]` | Every active agent. |
| `getAverageRating(bytes32) → uint256` | Average rating (×100). |
| `getCapabilityGaps() → (string[], uint256[])` | Capabilities + their demand counts. |
| `getTotalAgents() → uint256`, `isOrchestrator(address) → bool` | Misc. |

## Events (indexed by the subgraph)

```
AgentRegistered(bytes32 agentId, address owner, string[] capabilities, uint256 pricePerTask, string ipfsCID, uint256 timestamp)
AgentUpdated(...) · AgentDeactivated(...) · AgentReactivated(...)
TaskCompleted(bytes32 agentId, address owner, address orchestrator, uint256 newTaskCount, uint256 timestamp)
RatingSubmitted(...) · CapabilityRequested(string capability, uint256 totalDemand, address requester, uint256 timestamp)
OrchestratorAuthorized(...) · OrchestratorRevoked(...) · OwnershipTransferred(...)
```

Custom errors: `NotContractOwner`, `NotAgentOwner`, `NotAuthorizedOrchestrator`, `AgentDoesNotExist`, `ZeroAddress`, `NoCapabilitiesProvided`, `PriceMustBeNonZero`, `IpfsCIDRequired`, `AgentIdCollision`, `AgentAlreadyInactive`, `AgentAlreadyActive`, `InvalidRating`.

## Build, test, deploy

```bash
# install deps (forge-std)
make install

# build & test
make build
make test                 # forge test -vvv

# deploy to Base Sepolia (uses a Foundry keystore account named "deployer")
#   .env needs: ALCHEMY_RPC_URL, DEPLOYER_ADDRESS, BASESCAN_API_KEY
make deploy-sepolia

# verify a deployed address
make verify CONTRACT=0x...
```

`script/Deploy.s.sol` reads `DEPLOYER_ADDRESS` and deploys `new AgentRegistry(deployer)` — the deployer becomes the contract owner.

## After deploying

1. Update `NEXT_PUBLIC_REGISTRY_ADDRESS` (frontend) and `subgraph/subgraph.yaml` (`address` + `startBlock`).
2. **Authorize the orchestrator** so it can record task completions:
   ```bash
   cast send <REGISTRY> "authorizeOrchestrator(address)" <ORCHESTRATOR_SESSION_ADDRESS> \
     --rpc-url https://sepolia.base.org --account deployer
   ```

## Layout

```
src/AgentRegistry.sol      The contract
script/Deploy.s.sol        Deploy script (keystore-based)
test/                      Foundry tests
out/                       ABIs (out/AgentRegistry.sol/AgentRegistry.json)
deployment.json            Deployed address / block / tx
foundry.toml  Makefile
```
