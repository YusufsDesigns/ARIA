# ARIA — Complete Architecture Explanation

> Every detail in this document is derived from the actual code in this repository. No guesswork.
> Where a file path or function name is cited, it exists and does exactly what is described.

---

## Table of Contents

1. [What ARIA Is — The Big Picture](#1-what-aria-is)
2. [The Smart Contract — AgentRegistry.sol](#2-the-smart-contract)
3. [The Graph — Subgraph Indexing](#3-the-graph)
4. [Venice AI — The Intelligence Layer](#4-venice-ai)
5. [MetaMask Smart Accounts Kit — What It Is and Why](#5-metamask-smart-accounts-kit)
6. [The ERC-7715 Permission Grant — How the User Approves Once](#6-erc-7715-permission-grant)
7. [The Delegation — What It Is Technically](#7-the-delegation)
8. [The Redelegation — The A2A Payment Chain](#8-the-redelegation)
9. [The x402 Protocol — How Agents Get Paid](#9-the-x402-protocol)
10. [1Shot — The Gas Relay](#10-1shot-the-gas-relay)
11. [The Orchestrator — The Brain That Routes Everything](#11-the-orchestrator)
12. [The ReAct Loop — Why the Orchestrator Is Truly Intelligent](#12-the-react-loop)
13. [The Five Demo Agents — What Each One Does](#13-the-five-demo-agents)
14. [Agent Registration — How Developers List on ARIA](#14-agent-registration)
15. [Reading the Registry — How the Orchestrator Finds Agents](#15-reading-the-registry)
16. [Capability Gaps — The On-Chain Gap Signal](#16-capability-gaps)
17. [SSE Streaming — How the Frontend Gets Live Updates](#17-sse-streaming)
18. [The Database — Neon + Prisma](#18-the-database)
19. [The Frontend Pages](#19-the-frontend-pages)
20. [End-to-End Flow — The Full Memecoin Demo Walk-Through](#20-end-to-end-flow)
21. [The Delegation Chain Diagram](#21-the-delegation-chain-diagram)

---

## 1. What ARIA Is

ARIA is a consumer-facing AI platform where a user types a plain-language goal and an autonomous Orchestrator assembles a team of specialist AI agents to accomplish it. The Orchestrator is not a simple router. It uses the ReAct pattern (Reason → Act → Observe → loop) powered by Venice AI to think, discover what it needs, hire agents, pay them with real USDC micropayments, and synthesize the results — all without the user doing anything after the initial wallet connection.

The platform has two audiences:

- **Consumers** — type a goal, set a budget, watch results appear inline (like ChatGPT).
- **Developers** — build an agent server, add five lines of x402 middleware, register it on-chain, and earn USDC passively every time the Orchestrator hires it.

Everything — every AI call, every payment, every agent interaction — goes through Venice AI, which has zero data retention and zero logging. This is a core product promise.

---

## 2. The Smart Contract

**File:** `contract/src/AgentRegistry.sol`  
**Deployed:** Base Sepolia at `0xb025D240e29efE21ba4F973408a82445A9b7f40e`

The contract is the on-chain registry of all agents. It stores:

- **`registerAgent(capabilities[], pricePerTask, ipfsCID)`** — called by developers to list an agent. Emits `AgentRegistered`. Stores the array of capability strings, the USDC price per task (as a uint256 in USDC with 6 decimals), and an IPFS CID pointing to the full agent manifest (see Section 14).

- **`getAgentsByCapability(capability)`** — view function. Returns an array of `bytes32` agent IDs that have a matching capability tag. This is what the Orchestrator calls at runtime to discover which agents can handle a task.

- **`getAgent(agentId)`** — view function. Returns the full struct for one agent: owner address, capabilities, pricePerTask, ipfsCID, isActive bool, tasksCompleted count, rating data, registeredAt timestamp.

- **`getAllActiveAgents()`** — view function. Returns all non-deactivated agent IDs.

- **`requestCapability(capability)`** — write function. Called by the Orchestrator when it searched for a capability and found no agent. Increments a demand counter for that capability string and emits `CapabilityRequested`. This is how the on-chain gap signal is created (see Section 16).

- **`recordTaskCompletion(agentId)`** — write function. Called by the Orchestrator after a successful agent task. Increments the `tasksCompleted` counter on that agent's record.

- **`getCapabilityGaps()`** — view function. Returns two parallel arrays: `capabilities[]` and `demands[]` — all capability strings that were requested but had no registered agent, sorted by demand.

The ABI used in the frontend is the minimal subset in `frontend/lib/registry.ts:8-94`.

---

## 3. The Graph

**Subgraph:** Deployed at `https://api.studio.thegraph.com/query/1747630/aria-registry/v0.0.1`  
**Files:** `subgraph/schema.graphql`, `subgraph/subgraph.yaml`, `subgraph/src/`

The Graph is a decentralized indexing protocol. It listens to events emitted by the AgentRegistry contract and stores them in a queryable GraphQL database. This is faster than calling view functions on the contract for every page load.

**What it indexes:**

- `AgentRegistered` event → creates an `Agent` entity in the subgraph store
- `AgentDeactivated` event → sets `isActive = false` on the entity
- `AgentReactivated` event → sets `isActive = true`
- `TaskCompleted` event → increments `tasksCompleted` on the Agent entity, creates a `PaymentEvent` entity
- `CapabilityRequested` event → upserts a `CapabilityRequest` entity and increments its `demand` counter

**Three entities in `schema.graphql`:**
- `Agent` — mirrors the on-chain struct, indexed for fast filtering by capability
- `CapabilityRequest` — the demand-side gap data
- `PaymentEvent` — each task payment, linked to the agent and orchestrator address

**Dual-mode data access (`frontend/lib/graph.ts`):**

The frontend has a dual-mode pattern. If `NEXT_PUBLIC_GRAPH_URL` is set in the environment, all data queries go to The Graph via Apollo Client. If it is not set (or the query throws), the code silently falls back to reading from the contract directly via viem. This means the `/agents` marketplace page works even without the subgraph deployed, and the switch to The Graph requires only setting one environment variable.

---

## 4. Venice AI

**Used in:** Orchestrator, all 5 demo agents  
**SDK:** OpenAI SDK, pointed at `https://api.venice.ai/api/v1`

Venice AI is a privacy-first AI inference platform. The defining feature: **zero data retention**. When you make an inference call to Venice, the input and output are never stored, never logged, never used for training. This is a protocol-level guarantee, not a policy promise.

ARIA uses all five Venice modalities:

1. **Text reasoning** — `venice.chat.completions.create({ model: 'llama-3.3-70b', ... })` — used by the Orchestrator for its planning and reasoning steps, and by the Positioning Agent for strategy synthesis.

2. **Web search** — same API call, with `venice_parameters: { enable_web_search: 'auto' }` — Venice augments the LLM's response with live web search results. Used by the Market Intelligence Agent to pull real-time market data.

3. **Web scraping** — `venice_parameters: { enable_web_scraping: true }` — Venice fetches and parses a given URL, then the LLM reasons over the content. Used when deeper page analysis is needed.

4. **Image generation** — `venice.images.generate({ model: 'fluently-xl', ... })` — returns a base64-encoded image. Used by the Visual Asset Agent to generate launch banners.

5. **Text-to-speech** — `venice.audio.speech.create({ model: 'tts-kokoro', voice: 'af_sky', ... })` — returns an audio buffer. Used by the Visual Asset Agent to generate launch announcements.

The Venice API key authenticates via Bearer token. Adding `// @ts-expect-error` before the `venice_parameters` field suppresses TypeScript errors because the OpenAI SDK type doesn't know about Venice-specific extensions — they work at runtime.

---

## 5. MetaMask Smart Accounts Kit

**Package:** `@metamask/smart-accounts-kit`  
**Used in:** `frontend/lib/delegation.ts`, `frontend/lib/orchestrator/pay-agent.ts`, `frontend/components/wallet/ConnectButton.tsx`

The MetaMask Smart Accounts Kit is a library that enables **ERC-7710 delegation** — a standard for creating cryptographically-signed permissions that authorize one account to act on behalf of another, with precise scope restrictions.

To use delegations, both the delegator (the one giving permission) and the delegate (the one receiving it) must be MetaMask Smart Accounts, not plain EOAs. A MetaMask Smart Account is a smart contract wallet deployed to the user's address via EIP-7702.

**What the kit provides:**

- `toMetaMaskSmartAccount()` — creates a smart account wrapper around an EOA. The orchestrator server uses this to create the server-side smart account that can sign delegations.
- `getSmartAccountsEnvironment(chainId)` — returns the canonical contract addresses for that chain: the `DelegationManager`, the implementations, etc. On Base Sepolia (84532), this returns the MetaMask-deployed contract addresses.
- `createDelegation()` — creates a delegation from a known delegate (used when delegator and delegate are both known).
- `createOpenDelegation()` — creates a delegation with no specific delegate. Anyone holding it can present it to the `DelegationManager`, but caveats can restrict who is allowed to redeem it.
- `CaveatType.Redeemer` — a caveat that restricts an open delegation to only be redeemable by specific addresses (the MetaMask facilitator addresses).
- `ScopeType.Erc20TransferAmount` — a scope that restricts what the delegation can be used for: a transfer of at most `maxAmount` of a specific ERC-20 token.
- `encodeDelegations([...])` / `decodeDelegations(hex)` — serializes and deserializes delegation chains. A chain is an ordered array from root to leaf; the facilitator verifies each link.
- `Implementation.Hybrid` — the smart account implementation used when creating the orchestrator's account.

**In `frontend/lib/delegation.ts`:**

The module creates:
- A `publicClient` (viem, for reading chain state)
- The `orchestratorEOA` (the one private key on the server)
- A `bundlerClient` pointed at 1Shot's RPC (for submitting UserOperations with gas paid in USDC)
- The `mmEnvironment` (MetaMask's canonical contract addresses for Base Sepolia)
- A lazy-initialized `orchestratorSmartAccount` via `toMetaMaskSmartAccount()`

---

## 6. ERC-7715 Permission Grant — How the User Approves Once

**File:** `frontend/components/wallet/ConnectButton.tsx`

When a user connects their MetaMask wallet on the `/app` page, the connection flow does two things:

**Step 1: Connect and get address**
The standard `eth_requestAccounts` call gets the user's MetaMask address.

**Step 2: Check if account is already a Smart Account**
The code calls `publicClient.getCode({ address: userAddress })`. If the returned bytecode is non-empty and contains the EIP-7702 delegation pattern pointing to MetaMask's `EIP7702StatelessDeleGatorImpl`, the account is already a Smart Account. If it is an EOA (no bytecode), it will be handled by MetaMask Flask internally during the permission grant.

**Step 3: ERC-7715 `requestExecutionPermissions`**
```typescript
const walletClient = createWalletClient({
  transport: custom(window.ethereum),
  chain: baseSepolia,
}).extend(erc7715ProviderActions())

const grantedPermissions = await walletClient.requestExecutionPermissions([{
  chainId: baseSepolia.id,
  expiry: Math.floor(Date.now() / 1000) + 86400,
  to: ORCHESTRATOR_ADDRESS,
  permission: {
    type: 'erc20-token-periodic',
    isAdjustmentAllowed: true,
    data: {
      tokenAddress: USDC_ADDRESS,
      periodAmount: parseUnits(budgetUsdc.toString(), 6),
      periodDuration: 86400,
      startTime: currentTime,
      justification: 'ARIA agent task execution budget',
    },
  },
}])
```

This is the **only MetaMask popup the user ever sees**. MetaMask (Flask) processes this as an ERC-7715 advanced permission request. Under the hood, MetaMask:
1. Upgrades the user's EOA to a Smart Account (via EIP-7702, writing the delegation bytecode to the user's address)
2. Creates a root delegation from the user's smart account to the Orchestrator's address
3. Restricts it to periodic USDC transfers with the set budget
4. Returns the encoded permission context — a hex string representing the signed delegation

**Step 4: Store the permission context**
The `permissionContext` returned by MetaMask is sent to `POST /api/delegate` and stored in the Neon database under the user's address. This means the Orchestrator can look up the user's permission context later, without asking the user again.

**Fallback path:** If the user's MetaMask does not support ERC-7715 (not Flask, not upgraded), the `requestExecutionPermissions` call throws. The `catch` block stores `permissionContext: '0x'` instead. In this case, the Orchestrator detects the `'0x'` context and falls into dev mode — it calls agents directly without payment headers. This keeps the frontend functional for development without breaking the payment flow entirely.

---

## 7. The Delegation — What It Is Technically

A delegation is a cryptographic object. It is not a transaction — it is a **signed message** that says:

> "I (the delegator) authorize the delegate to perform these specific actions on my behalf, within these restrictions."

In ARIA's case, the root delegation says:
- Delegator: user's MetaMask Smart Account
- Delegate: Orchestrator smart account address
- Scope: transfer at most `N USDC` per period from the user's account
- Restriction: only valid for 24 hours (the `expiry`)

This signed object — the `permissionContext` — is stored in the database. It is the Orchestrator's authorization. Without it, the Orchestrator cannot move any of the user's funds.

The `DelegationManager` contract (MetaMask-deployed on Base Sepolia) is the on-chain contract that verifies delegation chains. When a facilitator wants to settle a payment, it submits the chain to the `DelegationManager`, which verifies every signature in the chain and then executes the authorized transfer.

---

## 8. The Redelegation — The A2A Payment Chain

**File:** `frontend/lib/orchestrator/pay-agent.ts`

This is where ARIA's multi-agent coordination becomes real. When the Orchestrator decides to hire an agent, it does not use the user's permission context directly — it **creates a new, scoped sub-delegation** specifically for that one payment. This sub-delegation is the redelegation.

Here is exactly what happens in `callAgentWithX402()`:

**Step 1 — Probe:** The Orchestrator sends the POST request to the agent's `/execute` endpoint without any payment header. The agent's x402 middleware intercepts it and returns HTTP 402 with a `PAYMENT-REQUIRED` header.

**Step 2 — Decode payment requirements:** The `PAYMENT-REQUIRED` header is a base64-encoded JSON object that contains:
- `accepted.asset` — the USDC contract address the agent accepts
- `accepted.amount` — the exact price in USDC (in 6-decimal units)
- `accepted.extra.assetTransferMethod` — must be `'erc7710'` to confirm the agent supports delegation-based payments
- `accepted.extra.facilitatorAddresses` — the MetaMask facilitator contract addresses that are allowed to settle the payment

**Step 3 — Decode the root delegation:** The stored `permissionContext` (the hex string from ERC-7715) is passed to `decodeDelegations(permissionContext)`, which returns the array of delegations representing the User → Orchestrator chain. The first element is the root delegation.

**Step 4 — Create open redelegation:**
```typescript
const openRedelegation = createOpenDelegation({
  from: userAddress,
  environment: mmEnvironment,
  parentDelegation: rootDelegation,   // <-- this links to the user's root grant
  scope: {
    type: ScopeType.Erc20TransferAmount,
    tokenAddress: accepted.asset,
    maxAmount: BigInt(accepted.amount), // exact price — no more
  },
  caveats: [{
    type: CaveatType.Redeemer,
    redeemers: facilitatorAddresses,   // only MetaMask facilitators can redeem this
  }],
})
```

The `parentDelegation` field is what makes this a **redelegation** rather than an independent delegation. It creates a cryptographic link: this new delegation can only be valid if the parent delegation is valid. The chain of authority flows from the user, through the orchestrator, to the facilitator.

The scope is restricted to the exact price of this one agent call. If the agent charges 0.30 USDC, the open redelegation authorizes exactly 0.30 USDC — not 1 cent more. Even if someone tried to replay the delegation, they could only extract 0.30 USDC.

The `CaveatType.Redeemer` caveat restricts redemption to MetaMask's facilitator addresses. This is a critical security measure: without this caveat, the open delegation (which has no specific delegate) could be redeemed by anyone who obtained it.

**Step 5 — Sign the redelegation:**
```typescript
const orchestratorAccount = await getOrchestratorSmartAccount()
const signature = await orchestratorAccount.signDelegation({ delegation: openRedelegation })
```

The Orchestrator's smart account signs the new redelegation. The Orchestrator is authorized to do this because the user granted it the root permission via ERC-7715.

**Step 6 — Encode the full chain:**
```typescript
const fullPermissionContext = encodeDelegations([
  signedRedelegation,     // [0] new open redelegation (Orch → Facilitator, scoped to agent price)
  ...existingDelegations, // [1+] the root chain from ERC-7715 (User → Orch)
])
```

The full chain — in order from leaf to root — is encoded into a single hex blob. The facilitator will walk this chain to verify authority.

**Step 7 — Build and send the x402 payment payload:**
```typescript
const paymentPayload = {
  x402Version: 2,
  payload: {
    delegationManager: mmEnvironment.DelegationManager,
    permissionContext: fullPermissionContext,
    delegator: userAddress,
  },
}
const encodedPayment = Buffer.from(JSON.stringify(paymentPayload)).toString('base64')

const response = await fetch(`${agentEndpointUrl}/execute`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'PAYMENT-SIGNATURE': encodedPayment,   // <-- the full delegation chain, base64-encoded
  },
  body: JSON.stringify({ task, context }),
})
```

This is the second POST request. This time, the `PAYMENT-SIGNATURE` header carries the full delegation chain. The agent's x402 middleware passes this to the MetaMask facilitator for verification and settlement.

---

## 9. The x402 Protocol — How Agents Get Paid

**x402 is an HTTP-native payment protocol** built on the existing 402 Payment Required status code. It replaces subscription fees and API keys with per-request micropayments.

**On the agent server side (`agents/market-intelligence/src/index.ts`):**
```typescript
app.use(paymentMiddleware({
  'POST /execute': {
    accepts: [{
      scheme: 'exact',
      price: '$0.30',
      network: 'eip155:84532',  // Base Sepolia
      payTo: agentOwnerAddress,
      extra: { assetTransferMethod: 'erc7710' },
    }],
  },
}, resourceServer))
```

The `paymentMiddleware` from `@x402/express` wraps every POST to `/execute`. Without the correct `PAYMENT-SIGNATURE` header, the middleware returns 402 with the payment requirements. With a valid header, the middleware calls the MetaMask facilitator to verify and settle the delegation chain, then passes the request through to the actual handler.

**The MetaMask facilitator** (`https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402`) is an off-chain service that:
1. Receives the delegation chain from the x402 middleware
2. Validates every signature in the chain using the `DelegationManager` contract
3. Executes the USDC transfer from the user's smart account to the agent owner's address
4. Returns a confirmation

From the agent developer's perspective, x402 requires zero blockchain knowledge. They add the middleware, set their price and wallet address, and money arrives.

**The `x402ResourceServer`** is initialized with the MetaMask `HTTPFacilitatorClient` and registered for the Base Sepolia chain ID. It handles the back-and-forth with the facilitator service.

---

## 10. 1Shot — The Gas Relay

**File:** `frontend/lib/oneshot.ts`  
**RPC:** `https://relayer.1shotapi.com/relayers`

Every on-chain write requires gas. But ARIA's orchestrator should not need ETH — it should pay gas in USDC. That is what 1Shot does.

1Shot is an EIP-7710 delegation relay. When the Orchestrator needs to write to the chain (record a capability gap, record a task completion, submit a UserOperation), it uses 1Shot instead of a standard RPC. 1Shot accepts gas payment in USDC and submits the transaction on the Orchestrator's behalf.

**The 8-step 1Shot flow (`executeVia1Shot7710`):**

1. `relayer_getCapabilities` — discover the relayer's `targetAddress` (the contract that will execute on behalf of the orchestrator), accepted payment tokens, and fee collector address.

2. `relayer_getFeeData` — get the gas fee expressed in USDC for this chain. This is the floor — the minimum USDC that must be included to cover gas.

3. Build the transaction bundle — the first transaction is always a USDC transfer from the Orchestrator to 1Shot's fee collector. The work transactions (e.g., `requestCapability(...)`) come after.

4. Create a root delegation: `orchestratorSmartAccount → 1Shot's targetAddress`. This is a fresh delegation with the `ROOT_AUTHORITY` constant (`0xffff...ffff` — no parent). The 1Shot target is being authorized to execute the bundle on the Orchestrator's behalf.

5. Sign the delegation with the Orchestrator's smart account.

6. `relayer_estimate7710Transaction` — validates the bundle and returns a price-locked `context` string. This context is valid for approximately 45 seconds; if not submitted in time, the estimate must be refreshed.

7. `relayer_send7710Transaction` — submits the bundle to the chain, returns a `taskId`.

8. `relayer_getStatus` (polled) — confirms when the transaction is `Confirmed`, `Rejected`, or `Reverted`.

**Where 1Shot is used:**
- `requestCapability()` in `registry.ts` — when no agent is found for a capability, the orchestrator calls this contract function via 1Shot.
- `recordTaskCompletion()` in `registry.ts` — after each successful agent call, the orchestrator records it on-chain via 1Shot.
- As the `bundlerClient` — for submitting ERC-4337 UserOperations from the orchestrator's smart account.

The **EIP-7702 path** (`upgradeViaEip7702: true`) is for first-time setup: if the Orchestrator's EOA has not yet been upgraded to a smart account, the 1Shot bundle includes an `authorizationList` that instructs the chain to write the smart account delegation bytecode to the Orchestrator's address in the same transaction.

---

## 11. The Orchestrator — The Brain That Routes Everything

**Files:** `frontend/lib/orchestrator/index.ts`, `frontend/lib/orchestrator/react-loop.ts`, `frontend/lib/orchestrator/budget.ts`

The Orchestrator is a server-side process that runs inside Next.js API routes. It is not a simple message router. It is a Venice AI-powered reasoning agent that:
- Decides what capabilities are needed to answer a task
- Searches the on-chain registry for agents with those capabilities
- Hires and pays them via x402
- Collects their findings
- Decides if more work is needed (non-linear routing)
- Synthesizes everything into a final answer

**Entry point (`orchestrator/index.ts`):**

When `POST /api/task` receives a new task, it creates a Task record in the database, starts the orchestrator as a background async process (so the HTTP response returns immediately with the task ID), and returns. The frontend then opens an SSE connection to `/api/task/[id]/stream` to receive live updates.

The orchestrator entry point:
1. Marks the task as `running` in the database
2. Looks up the stored `permissionContext` for the user's address (the ERC-7715 grant from wallet connection)
3. Checks that it has not expired
4. Creates a `BudgetTracker` instance
5. Calls `runReactLoop()`
6. On completion, persists the synthesis to the database and emits `synthesis_complete`

**BudgetTracker (`orchestrator/budget.ts`):**
- Tracks total USDC spent against the user's set budget
- `canAfford(price)` — returns false if this payment would exceed the remaining budget
- `findAffordableAgent(agents[])` — picks the cheapest agent the budget can cover
- `recordPayment()` — updates the spent counter, saves to the database, emits a `budget_update` SSE event

---

## 12. The ReAct Loop — Why the Orchestrator Is Truly Intelligent

**File:** `frontend/lib/orchestrator/react-loop.ts`

ReAct stands for Reason + Act. It is an AI agent pattern where the model iterates between thinking, doing, and observing results before deciding what to do next. ARIA's Orchestrator implements this with Venice as the reasoning engine.

**Phase 1 — REASON (Initial Plan):**

Venice is called with a system prompt that tells it: "You are ARIA. Analyze this task. Return JSON: `{ capabilities: string[], reasoning: string }`."

The capabilities array contains specific tags like `market-intelligence`, `onchain-analytics`, `strategy`, `image-generation`. Venice decides which specialists are needed based on the natural language task.

This means the Orchestrator does not have hardcoded rules like "if task contains 'token' then hire analytics agent." It genuinely reasons about what is needed.

**Phase 2 — SEARCH (Registry Query):**

For each capability in the initial plan, `getAgentsByCapability(capability)` is called on the smart contract. This returns an array of `bytes32` agent IDs. For each ID, `getAgent(id)` fetches the full struct. The `ipfsCID` field is used to fetch the agent's manifest from IPFS (Pinata), which contains the actual `endpointUrl`.

**Phase 3 — ACT (Hire or Fallback):**

If agents are found and the budget can cover the cheapest one, the Orchestrator hires it via `callAgentWithX402()` (see Section 8). The entire delegation chain is created and the payment is made.

If no agent is found for a capability — or no agent is within budget — the Orchestrator falls back to **Venice handling it directly**: Venice is called as if it were the specialist, using its training knowledge. The `requestCapability(capability)` function is then called to log the gap on-chain (see Section 16).

**Round-based parallelism:**

The loop processes capabilities in rounds. All capabilities in the current queue are processed simultaneously with `Promise.all()`. This means if the initial plan requires `market-intelligence` AND `onchain-analytics`, both are hired at the same time, in parallel. This is efficient and demonstrates true multi-agent coordination.

**Phase 4 — OBSERVE + REASON (What Next?):**

After each round completes, Venice is called again: "Based on these findings, are more capabilities needed? Return JSON: `{ additional: [], complete: true/false }`."

This is where **non-linear routing** happens. If the Market Intelligence Agent comes back and says "this memecoin name is already taken by two rugged tokens — high risk," Venice might reason: "This finding changes the strategy. I now also need `onchain-analytics` to verify the risk, even though it wasn't in the original plan." A new capability is added to the queue, and another round begins.

**Hard limits:**
- 5-minute deadline (`Date.now() + 5 * 60_000`)
- Budget exhaustion check before each round
- Deduplication — `attempted` Set prevents the same capability from being tried twice

**Phase 5 — SYNTHESIS:**

When the queue is empty (or budget is exhausted, or timeout reached), Venice is called one final time: "Synthesize all findings into a comprehensive answer to the original task."

Venice receives all the structured outputs from every agent, the original prompt, and synthesizes them into a single markdown response. A privacy receipt is appended showing the total number of Venice calls and confirming zero bytes were retained.

---

## 13. The Five Demo Agents

Each agent is an independent Express.js server with the x402 payment middleware applied to `POST /execute`. Each uses its own internal ReAct loop with Venice before returning a result.

### Agent 1: Market Intelligence (Port 4001, 0.30 USDC)
**File:** `agents/market-intelligence/src/index.ts`

Capabilities: `market-intelligence`, `web-search`, `competitor-analysis`

ReAct loop:
1. **REASON** — Venice decomposes the task into 3 targeted search queries (different angles: market data, competitor landscape, community sentiment).
2. **ACT** — Venice web search (`enable_web_search: 'auto'`) executes each query against live web results.
3. **OBSERVE + REASON** — Venice synthesizes the search results into structured markdown, determining if findings are sufficient.

Returns: structured markdown analysis with market data, competitor landscape, and sentiment.

### Agent 2: Competitive Technical (Port 4002, 0.50 USDC)
**File:** `agents/competitive-tech/src/index.ts`

Capabilities: `onchain-analytics`, `smart-contract-analysis`, `blockchain-data`

ReAct loop:
1. **REASON** — Venice identifies which tokens/contracts to analyze from the task context.
2. **ACT** — Etherscan API (`api-sepolia.basescan.org`) is queried for on-chain data: holder counts, token transfers, contract verification status.
3. **ACT** — Venice analyzes the raw Etherscan data.
4. **OBSERVE** — Venice synthesizes on-chain findings into structured analysis.

Returns: on-chain analytics including contract patterns, holder distribution, TVL data.

### Agent 3: Positioning & Strategy (Port 4003, 0.20 USDC)
**File:** `agents/positioning/src/index.ts`

Capabilities: `strategy`, `positioning`, `copywriting`, `marketing`

ReAct loop:
1. **REASON** — Venice (`llama-3.3-70b`, the strongest reasoning model) takes the prior agents' findings as context and reasons about differentiated positioning.
2. **ACT** — Venice generates a comprehensive strategy including naming recommendations, key differentiators, and messaging angles.
3. **OBSERVE** — Venice produces final positioning document.

Returns: brand strategy, positioning statement, key messaging angles.

### Agent 4: Visual Asset (Port 4004, 0.40 USDC)
**File:** `agents/visual-asset/src/index.ts`

Capabilities: `image-generation`, `visual-design`, `brand-assets`, `tts`, `audio-production`

ReAct loop:
1. **REASON** — Venice creates a detailed image generation prompt based on the positioning context.
2. **ACT (parallel):**
   - `venice.images.generate({ model: 'fluently-xl' })` — generates a 1024×1024 launch banner
   - `venice.audio.speech.create({ model: 'tts-kokoro', voice: 'af_sky' })` — generates a 30-second TTS announcement
3. **OBSERVE** — both complete and are bundled into a single JSON response.

Returns: JSON containing base64-encoded image AND base64-encoded audio.

### Agent 5: Video Production (Port 4005, 0.60 USDC)
**File:** `agents/video-production/src/index.ts`

Capabilities: `video-generation`, `video-production`, `media-content`

ReAct loop:
1. **REASON** — Venice creates a video concept and script.
2. **ACT** — Venice video API (`POST /api/v1/video/queue`, model: `seedance-2-0-text-to-video`, duration: `"5s"`) submits async video job; polls `POST /api/v1/video/retrieve` until complete.
3. **FALLBACK** — If video times out (Venice video generation is slow), returns `status: "partial"` with TTS audio only. The agent still earns its USDC for the audio work.

Returns: base64 video binary, or audio fallback with partial status.

---

## 14. Agent Registration — How Developers List on ARIA

**Page:** `/register`  
**File:** `frontend/app/register/page.tsx`

Registration is a 3-step wizard:

**Step 1 — Build the ARIA Agent Manifest and upload to IPFS (Pinata)**

The developer fills out a form: name, description, endpoint URL, capabilities (multi-input), price per task, input type, output types, latency estimate, documentation URL.

Clicking "Preview JSON" shows the ARIA Agent Manifest v1 that will be uploaded. The manifest is the full metadata for the agent — it is what the Orchestrator fetches from IPFS to get the actual `endpointUrl`.

Clicking "Upload to IPFS" calls `uploadAgentMetadata()` in `frontend/lib/pinata.ts`, which POSTs the JSON to Pinata's `pinJSONToIPFS` API. Pinata returns an IPFS CID (e.g., `QmXxx...`). Only this CID is stored on-chain — keeping gas costs minimal.

**Step 2 — Register on-chain via MetaMask**

The frontend constructs a call to `AgentRegistry.registerAgent(capabilities[], pricePerTask, ipfsCID)` and submits it via `eth_sendTransaction`. MetaMask pops up for the developer to sign. When the transaction confirms, the agent is live on the registry. The contract emits `AgentRegistered`, which the subgraph indexes.

**Step 3 — Confirmation**

Shows the BaseScan link for the registration transaction and the Pinata gateway link for the IPFS manifest. From this point, any Orchestrator that calls `getAgentsByCapability()` for a matching capability will discover this agent.

**For developers implementing x402:**

The `/register` page includes a collapsible guide showing exactly how to add x402 middleware to their agent server: install `@metamask/x402`, `@x402/express`, configure `paymentMiddleware` with the price and wallet address, and return a standard `AgentResponse` JSON.

---

## 15. Reading the Registry — How the Orchestrator Finds Agents

**File:** `frontend/lib/registry.ts`, `frontend/lib/orchestrator/react-loop.ts:73-103`

When the Orchestrator needs to hire an agent for capability `X`, here is the exact sequence:

1. `getAgentsByCapability(capability)` — calls `publicClient.readContract()` against the deployed `AgentRegistry` at `0xb025D240e29efE21ba4F973408a82445A9b7f40e`. Returns an array of `bytes32` IDs.

2. For each ID, `getAgent(id)` is called. This returns the full struct: `{ owner, capabilities, pricePerTask, ipfsCID, isActive, tasksCompleted, ... }`.

3. `isActive` is checked — deactivated agents are skipped.

4. `resolveAgentEndpoint(agent)` fetches the IPFS manifest using the `ipfsCID`. The manifest contains the `endpointUrl` — the HTTPS address the Orchestrator will POST to.

5. The price is converted: `Number(agent.pricePerTask) / 1e6` (since prices are stored with 6 decimal places, like USDC).

6. `budget.canAfford(priceUSDC)` filters out agents the budget cannot cover.

7. The remaining agents are sorted by price ascending. The cheapest affordable agent is picked.

All of this happens live, at the moment the task runs. There is no caching, no pre-selection. The registry is always the source of truth.

---

## 16. Capability Gaps — The On-Chain Gap Signal

**File:** `frontend/lib/registry.ts:142-165`, `frontend/lib/orchestrator/react-loop.ts:140-144`

When the Orchestrator calls `getAgentsByCapability(capability)` and gets zero results, or when every found agent is out of budget, it:

1. Falls back to Venice handling the capability directly (uses its training knowledge).
2. Calls `requestCapability(capability)` as a **fire-and-forget, non-blocking** operation (`requestCapability(...).catch(() => {})` — the task does not wait for this).

`requestCapability` calls the `AgentRegistry.requestCapability(capability)` contract function via 1Shot's EIP-7710 relay. The contract increments a demand counter for that capability string and emits `CapabilityRequested(capability, totalDemand, requester, timestamp)`.

The subgraph indexes this event and upserts a `CapabilityRequest` entity. The `demand` counter represents how many times the Orchestrator needed this capability but couldn't find an agent.

**On the `/agents` page**, the capability gaps section reads from either The Graph (query for `capabilityRequests` ordered by demand) or from the contract's `getCapabilityGaps()` view function. The result shows developers: "there were 47 requests for `video-generation` this week and no agent exists." This is a direct market signal — build an agent for a gap and earn from day one.

---

## 17. SSE Streaming — How the Frontend Gets Live Updates

**Files:** `frontend/lib/sse.ts`, `frontend/app/api/task/[id]/stream/route.ts`

Server-Sent Events (SSE) is a one-way HTTP streaming protocol where the server pushes text events to the client over a persistent connection. ARIA uses this to stream every Orchestrator event to the frontend in real time.

**The event bus (`frontend/lib/sse.ts`):**

An in-memory `Map<taskId, listener[]>` stores the list of SSE clients connected to each task. `emitTaskEvent(taskId, event)` iterates the listeners and writes `data: <JSON>\n\n` to each client.

**The SSE endpoint (`/api/task/[id]/stream`):**

Returns a `ReadableStream` with `Content-Type: text/event-stream`. When a client connects, it registers a listener in the in-memory map. When the client disconnects (detected via `req.signal.abort`), it is removed from the map.

**Event types emitted by the Orchestrator:**
- `orchestrator_thinking` — Venice reasoning steps ("Analyzing task...", "Found market-intelligence agent")
- `agent_hired` — agent name, capability, price
- `payment_confirmed` — agent name, price, txHash (BaseScan link)
- `finding_received` — capability, output, outputType (text/image/audio/json)
- `privacy_log` — "Venice AI processed: X — 0 bytes retained"
- `budget_update` — spent, remaining
- `synthesis_complete` — final Venice synthesis text
- `task_failed` — error message

**Frontend consumption (`frontend/components/task/InlineExecution.tsx`):**

```typescript
const es = new EventSource(`/api/task/${taskId}/stream`)
es.onmessage = (e) => {
  const event = JSON.parse(e.data)
  switch (event.type) {
    case 'agent_hired': // append to agent plan display
    case 'payment_confirmed': // add BaseScan link to payment ledger
    case 'finding_received': // render agent result (markdown/image/audio player)
    case 'privacy_log': // add Venice privacy badge
    case 'synthesis_complete': // render final answer, close EventSource
  }
}
```

This is what makes the `/app` page feel like ChatGPT — the execution appears live, one event at a time, exactly as the Orchestrator works through the task.

---

## 18. The Database — Neon + Prisma

**Files:** `frontend/lib/prisma.ts`, `frontend/prisma/schema.prisma`

**Why both Neon and Prisma?**

Prisma is the ORM — it gives typed queries, schema migrations, and ergonomic database access. Neon is the PostgreSQL database. The `@prisma/adapter-neon` and `@neondatabase/serverless` packages are needed because Next.js API routes run as serverless functions. Standard PostgreSQL uses long-lived TCP connections that are incompatible with serverless (each invocation is a fresh process). The Neon serverless driver uses HTTP and WebSockets, which work correctly in serverless environments.

**Three tables:**

1. **`Task`** — one record per user task submission. Fields: `id`, `userAddress`, `input` (original prompt), `status` (pending/running/completed/failed/budget-exhausted), `result` (JSON, final synthesis), `totalSpent` (USDC), `agentCalls` (relation), timestamps.

2. **`AgentCall`** — one record per agent hired within a task. Fields: `taskId` (foreign key), `agentName`, `agentAddress`, `capability`, `amountUsdc`, `txHash`, `finding` (the raw agent output), `outputType`, `status` (pending/paid/completed/failed).

3. **`UserPermission`** — one record per connected wallet address. Fields: `userAddress` (primary key), `permissionContext` (the ERC-7715 hex string), `expiresAt`, `periodAmountUsdc`. Looked up by the Orchestrator at the start of every task.

**Prisma v7 specifics:**
- Generator: `provider = "prisma-client-js"` with `previewFeatures = ["driverAdapters"]`
- The database URL is NOT in `schema.prisma` — it lives in `prisma.config.ts` (Prisma v7 change)
- Generated client outputs to `app/generated/prisma/` (configured in the generator block)

---

## 19. The Frontend Pages

**Framework:** Next.js (App Router)  
**Design system:** Chakra Petch (headings, labels, buttons) + Hanken Grotesk (body text), #FF6B35 orange, pure black background

### Landing Page (`/`)
Marketing page. Full-viewport CSS smoke animation (orange on black). Hero with prompt input (non-functional, shows "connect wallet" tooltip on click). Stats bar reading live data from the contract. How-it-works (3-step). Live coordination demo using the `agent-plan` component. Agent economy section with display cards. Privacy comparison (Venice vs standard AI). Developer CTA with x402 code snippet. Capability gaps teaser. Footer.

### App Page (`/app`)
The product. Three states:
1. **Before wallet connected** — centered prompt area, connect button
2. **After connect, before submit** — budget selector, quick prompts, submit button
3. **After submit** — inline execution view via `InlineExecution.tsx`, SSE stream

The inline execution view shows all Orchestrator events live: thinking log, agent plan with live updates, payment ledger with BaseScan links, privacy feed with Venice badges, individual agent findings (markdown/image/audio), final synthesis.

### Agents Marketplace (`/agents`)
Two sections:
1. **Registered Agents** — reads from The Graph (or contract fallback). Agent cards in a 3-column grid with capabilities, price, rating, tasks completed.
2. **Capability Gaps** (anchored at `#gaps`) — reads from The Graph (or contract `getCapabilityGaps()`). Gap cards showing demand count and estimated earning potential.

### Register Page (`/register`)
3-step wizard. Accepts `?capability=` query parameter (pre-fills from capability gap links). Step 1: form + Pinata IPFS upload. Step 2: MetaMask transaction. Step 3: confirmation with links.

---

## 20. End-to-End Flow — The Full Memecoin Demo Walk-Through

Here is exactly what happens when a user types "I want to launch a memecoin called MOONCAT on Base" with a 10 USDC budget:

1. **Wallet connect** — `eth_requestAccounts` gets address. ERC-7715 `requestExecutionPermissions` pops MetaMask once. User approves 10 USDC budget. `permissionContext` hex stored in Neon DB.

2. **Task created** — `POST /api/task` creates a `Task` record in the DB. Returns `taskId`.

3. **SSE connection opened** — frontend connects to `/api/task/[taskId]/stream`.

4. **Orchestrator starts** — retrieves `permissionContext` from DB. Creates `BudgetTracker(10 USDC)`.

5. **REASON** — Venice called with system prompt: "Analyze this task. Return JSON capabilities." Venice returns: `{ capabilities: ["market-intelligence", "onchain-analytics"] }`.

6. **ROUND 1 — parallel agent search and hire:**

   For `market-intelligence`:
   - `getAgentsByCapability("market-intelligence")` returns Agent 1's ID
   - `getAgent(id)` returns struct with `pricePerTask: 300000` (0.30 USDC) and `ipfsCID`
   - IPFS fetch returns manifest with `endpointUrl`
   - `callAgentWithX402()` called:
     - Probe → 402 received
     - `decodeDelegations(permissionContext)` extracts root delegation
     - `createOpenDelegation({ parentDelegation: root, scope: 0.30 USDC, redeemers: facilitators })`
     - Orchestrator signs
     - `encodeDelegations([redelegation, rootDelegation])` → full chain
     - POST with `PAYMENT-SIGNATURE` header → facilitator settles → agent runs
     - Agent internal ReAct: Venice plans 3 search queries → Venice web search × 3 → Venice synthesizes
     - Returns: market analysis markdown
   - `budget.recordPayment(0.30)` — 9.70 USDC remaining
   - `emitTaskEvent(payment_confirmed)` — BaseScan link in frontend payment ledger
   - `recordTaskCompletion(agentId)` via 1Shot (non-blocking)

   For `onchain-analytics` (simultaneously):
   - Same pattern. Agent 2 hired for 0.50 USDC.
   - Agent internal ReAct: Venice plans → Etherscan queries for MOONCAT → Venice analysis
   - Returns: on-chain analytics confirming MOONCAT name risk
   - 9.20 USDC remaining

7. **OBSERVE** — Venice called with both findings: "What else is needed?" Venice reasons: "Market risk confirmed. MOONCAT name has two rugged predecessors. I need `strategy` to handle the rebrand recommendation."

8. **ROUND 2 — strategy:**
   - Agent 3 hired for 0.20 USDC
   - Venice synthesizes findings into strategy: "Rebrand to LUNARCAT. Key differentiator: X."
   - 9.00 USDC remaining

9. **OBSERVE** — Venice: "Strategy complete. Need `image-generation` for launch assets."

10. **ROUND 3 — visual asset:**
    - Agent 4 hired for 0.40 USDC
    - Venice creates image prompt from positioning → `fluently-xl` generates banner → `tts-kokoro` generates announcement audio
    - Returns JSON with base64 image + base64 audio
    - 8.60 USDC remaining

11. **OBSERVE** — Venice: "All findings sufficient. Task complete." Queue empty.

12. **SYNTHESIS** — Venice called with all 4 findings: generates comprehensive markdown synthesis.

13. **Privacy receipt appended**: "Venice AI Calls: 12 | Data Retained: 0 bytes | Training Data Shared: None"

14. **`synthesis_complete` SSE event** — frontend renders final answer. EventSource closed.

15. **Non-linear routing visible**: Agent 2 was not in the original plan — it was added after the Market Intelligence finding showed risk. The non-linearity is the proof of genuine intelligence.

**Total spent: 1.40 USDC of 10.00 USDC budget.**

---

## 21. The Delegation Chain Diagram

```
User's MetaMask Smart Account
│
│  ERC-7715 requestExecutionPermissions()  ← ONE MetaMask popup, done at wallet connect
│  Grant: Orchestrator may spend up to 10 USDC per day for 24 hours
│  Result: permissionContext hex blob (signed root delegation)
│  Stored: Neon DB (UserPermission table)
│
▼
Orchestrator Smart Account (server-side EOA wrapped as MetaMask Smart Account)
│
│  At task runtime, for EACH agent payment:
│
│  1. decodeDelegations(permissionContext) → extract root delegation
│
│  2. createOpenDelegation({
│       from: userAddress,
│       parentDelegation: rootDelegation,   ← CHAIN LINK
│       scope: { maxAmount: agentPrice },   ← SCOPED DOWN to exact price
│       caveats: [{ Redeemer: facilitators }]  ← ONLY MetaMask can redeem
│     })
│
│  3. orchestratorAccount.signDelegation({ delegation: openRedelegation })
│
│  4. encodeDelegations([signedRedelegation, rootDelegation])
│     → fullPermissionContext (the complete chain, root to leaf)
│
│  5. POST /execute with PAYMENT-SIGNATURE: base64(fullPermissionContext)
│
▼
MetaMask x402 Facilitator (https://tx-sentinel-base-sepolia...)
│
│  Verifies chain: root signature valid → redelegation signature valid
│                  scope: User authorized 10 USDC → Orchestrator authorized 0.30 USDC
│                  caveat: Redeemer is the facilitator ✓
│
│  Executes: USDC.transfer(agentOwnerAddress, 0.30 USDC)
│  on behalf of: user's smart account
│
▼
Agent Owner's Wallet ← 0.30 USDC arrives

(Repeated for each of the 4 agent calls in the memecoin demo)
Delegation tree after full demo:
  Root (User → Orch)
    ├── Redelegation 1 (Orch → Facilitator, 0.30 USDC, for Agent 1)
    ├── Redelegation 2 (Orch → Facilitator, 0.50 USDC, for Agent 2)
    ├── Redelegation 3 (Orch → Facilitator, 0.20 USDC, for Agent 3)
    └── Redelegation 4 (Orch → Facilitator, 0.40 USDC, for Agent 4)
Total delegated: 1.40 USDC (of 10.00 USDC budget)
```

**Separate: Orchestrator → 1Shot delegation tree (for on-chain writes)**
```
Orchestrator Smart Account
│
│  For requestCapability() and recordTaskCompletion():
│
│  createOpenDelegation({
│    delegate: 1Shot targetAddress,  ← 1Shot, not MetaMask facilitator
│    authority: ROOT_AUTHORITY,      ← no parent, this is a root delegation
│    caveats: [],                    ← no restrictions (1Shot fee tx is in the bundle)
│  })
│
▼
1Shot EIP-7710 Relay
│
│  Fee: USDC transfer (gas cost) → 1Shot fee collector
│  Work: requestCapability("video-generation") → AgentRegistry contract
│
▼
Base Sepolia chain ← capability gap recorded, no ETH needed
```

These are two completely separate delegation trees:
- The **User → Orchestrator → Facilitator** tree handles agent payments.
- The **Orchestrator → 1Shot** tree handles gas for on-chain writes.

Both use EIP-7710 delegation. Together, they demonstrate that ARIA never needs ETH: user pays USDC for agents, Orchestrator pays USDC for gas via 1Shot.
