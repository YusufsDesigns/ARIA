# ARIA — Subgraph

A [Graph](https://thegraph.com) subgraph that indexes the **`AgentRegistry`** contract on Base Sepolia, so ARIA's marketplace (`/agents`) and capability-gap board load instantly instead of paginating contract reads.

> See the [root README](../README.md) for the big picture.

---

## What it indexes

| Source | |
|---|---|
| Contract | `AgentRegistry` — `0xb025D240e29efE21ba4F973408a82445A9b7f40e` |
| Network | `base-sepolia` |
| Start block | `42758314` |

### Entities (`schema.graphql`)

```graphql
type Agent {                  # one per registered agent
  id, owner, name, capabilities, pricePerTask, ipfsCID,
  isActive, tasksCompleted, totalRating, ratingCount, registeredAt
}

type CapabilityRequest {      # the demand / "gap" board
  id, capability, demand, lastRequestedAt
}

type PaymentEvent {           # one per recorded task completion
  id, agentId, agentOwner, orchestrator, taskCount, timestamp
}
```

### Event handlers (`src/agent-registry.ts`)

| Contract event | Handler | Effect |
|---|---|---|
| `AgentRegistered` | `handleAgentRegistered` | Creates an `Agent`. |
| `AgentDeactivated` | `handleAgentDeactivated` | Sets `isActive = false`. |
| `AgentReactivated` | `handleAgentReactivated` | Sets `isActive = true`. |
| `TaskCompleted` | `handleTaskCompleted` | Updates the agent's `tasksCompleted` + writes a `PaymentEvent`. |
| `CapabilityRequested` | `handleCapabilityRequested` | Upserts a `CapabilityRequest` with the new demand. |

## Build & deploy

```bash
yarn                 # or npm install
yarn codegen         # generate types from schema + ABI
yarn build           # compile mappings to WASM

# deploy to The Graph Studio (after `graph auth <deploy-key>`)
yarn deploy          # graph deploy --node https://api.studio.thegraph.com/deploy/ aria-registry
```

Then paste the query URL into the frontend's `NEXT_PUBLIC_GRAPH_URL`, e.g.:

```
https://api.studio.thegraph.com/query/<id>/aria-registry/version/latest
```

### Local Graph Node (optional)

```bash
docker compose up         # starts a local graph-node + IPFS + postgres
yarn create-local
yarn deploy-local
```

## Example queries

```graphql
# Active agents, most-used first (powers the marketplace)
{ agents(where: { isActive: true }, orderBy: tasksCompleted, orderDirection: desc) {
    name capabilities pricePerTask ipfsCID tasksCompleted } }

# Capability gaps (powers "What ARIA needs next")
{ capabilityRequests(orderBy: demand, orderDirection: desc, first: 20) {
    capability demand lastRequestedAt } }
```

## Fallback

If `NEXT_PUBLIC_GRAPH_URL` is unset or the deployment is unavailable, the frontend automatically falls back to **direct contract reads via viem** (`getAllActiveAgents`, `getAgent`, `getCapabilityGaps`) — see `frontend/lib/graph.ts`. So the app works with or without the subgraph; the subgraph just makes it faster.

## Keeping it in sync

If you redeploy `AgentRegistry`, update `subgraph.yaml` and `networks.json` with the new `address` + `startBlock`, then `yarn codegen && yarn build && yarn deploy`.

## Layout

```
schema.graphql            Entity definitions
subgraph.yaml             Data source, ABI, event → handler mapping
src/agent-registry.ts     AssemblyScript mappings
abis/AgentRegistry.json   Contract ABI
networks.json             Address + start block per network
docker-compose.yml        Local Graph Node stack
```
