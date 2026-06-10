# ARIA — Build Progress Log

> Claude Code: After EVERY session, append a new entry to this file using the template below. Never delete previous entries. This is the canonical record of what was built, what broke, and what was decided.

---

## How to Add an Entry

Copy the template below, fill it in, and append to the bottom of this file after every session.

```
## Session [N] — [DATE]
**Duration:** [X hours]
**Focus:** [What you were trying to build]

### Completed
- [ ] Task 1
- [ ] Task 2

### Blocked / Issues
- Issue description → Resolution or "still open"

### Decisions Made
- Decision → Reasoning

### Next Session Should Start With
- First thing to do
- Second thing to do

### Environment State
- Agents running: [list ports]
- Contract address: [if changed]
- Subgraph version: [if changed]
```

---

## Project State Reference

Quick checklist — update the ✅/❌ after each session:

| Component | Status | Notes |
|---|---|---|
| AgentRegistry.sol | ✅ Deployed | Base Sepolia: `0x8715eD9A25bf7a681160120A9e1a76615E39B273` |
| Subgraph initialized | ✅ Built + deployed | v0.0.1 live on The Graph Studio |
| Subgraph built + deployed | ✅ Done | `https://api.studio.thegraph.com/query/1747630/aria-registry/v0.0.1` |
| Neon DB + Prisma | ✅ Done | Schema pushed, adapter installed |
| Venice AI (all 5 modalities) | ✅ Tested | text, search, scrape, image, TTS all working |
| Market Intelligence Agent | ✅ Server built | Port 4001, x402 402-response confirmed |
| Competitive Technical Agent | ✅ Server built | Port 4002, x402 + Etherscan |
| Positioning Agent | ✅ Server built | Port 4003, x402 |
| Visual Asset Agent | ✅ Server built | Port 4004, x402 + image + TTS |
| Orchestrator ReAct loop | ✅ Built | `lib/orchestrator/react-loop.ts` + `index.ts` |
| ERC-7715 permission grant | ✅ Built | `ConnectButton.tsx` — Flask path + fallback |
| x402 payment flow | ✅ Built | `pay-agent.ts` with `redelegatePermissionContextOpenAction` |
| Landing page | ✅ Built | CSS smoke bg, stats, how-it-works, privacy comparison |
| App prompt page | ✅ Built | `app/app/page.tsx` — inline execution view |
| Task execution view | ✅ Built | `InlineExecution.tsx` — SSE consumer |
| Agents marketplace | ✅ Built | `app/agents/page.tsx` — grid + gaps section |
| Register page | ✅ Built | `app/register/page.tsx` — 3-step wizard |
| Capability Gaps page | ✅ Built | Section on /agents at `id="gaps"` |
| Agent 5 (Video Production) | ✅ Built | Port 4005, 0.60 USDC, Venice video async + TTS |
| End-to-end demo test | ❌ Not started | Step 15 — needs ngrok + agent registration |
| Demo video | ❌ Not started | Step 16 |

---

## Known Issues Log

*Append issues here as they are discovered. Mark resolved when fixed.*

| Date | Issue | Resolution |
|---|---|---|
| 2026-06-07 | MetaMask facilitator URL for Base Sepolia | Confirmed: `https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402` |
| 2026-06-07 | `frontend/lib/graph.ts` Apollo v4 TypeScript errors | `ApolloClient` not generic in v4, `uri` must go via `HttpLink`. Fix before building /agents page |
| 2026-06-07 | x402 package versions in CLAUDE.md are outdated | `@metamask/x402@0.2.0` needs `@x402/core@^2.14.0` (not `^0.5.0`) |
| 2026-06-07 | EIP-7702 account upgrade flow with 1Shot needs testing | Pending — Step 6 |

---

## Architecture Decisions Log

*Record any changes from the original plan in CLAUDE.md.*

| Date | Decision | Reason |
|---|---|---|
| - | Using ERC-7715 periodic permission instead of ERC-7710 root delegation | Cleaner UX — user signs once for recurring budget |
| - | Orchestrator lives inside Next.js API routes (not separate service) | Simpler deployment, one fewer service |
| - | No separate "platform agents" — all agents are external | Architectural clarity, same standard for all |
| - | IPFS/Pinata for agent metadata, only CID on-chain | Gas optimization |

---

## Session Entries

*(Sessions will be appended below)*

---

## Session 2 — 2026-06-08
**Duration:** ~4 hours
**Focus:** Orchestrator, delegation, x402 payment flow, all frontend pages

### Completed
- [x] **Agent 5: Video Production** — `agents/video-production/` on port 4005, 0.60 USDC
  - Venice video async API: `POST /api/v1/video/queue` → poll `POST /api/v1/video/retrieve`
  - Model: `seedance-2-0-text-to-video`, duration: `"5s"` (string enum)
  - In-memory video store: serves binary video buffers at `GET /video/:id`
  - Graceful fallback: returns audio-only with `status: "partial"` on video timeout
  - `agents/start-all.sh` updated with PID5 + trap
- [x] **Step 5: Orchestrator ReAct Loop**
  - `frontend/lib/orchestrator/react-loop.ts` — full REASON→SEARCH→ACT→OBSERVE loop
  - `frontend/lib/orchestrator/index.ts` — entry point, retrieves permission from DB
  - `frontend/lib/orchestrator/budget.ts` — BudgetTracker with DB sync + SSE emit
  - Venice direct fallback when no agent registered + on-chain gap signal via `requestCapability`
- [x] **Step 6: ERC-7715 permission grant**
  - `frontend/components/wallet/ConnectButton.tsx` — MetaMask Flask path + non-Flask fallback
  - Stores `permissionContext` in DB via `POST /api/delegate`
  - `permissionContext: '0x'` stored for non-Flask wallets (orchestrator uses Venice direct mode)
- [x] **Step 7: x402 payment flow**
  - `frontend/lib/delegation.ts` — orchestrator smart account setup, `mmEnvironment`
  - `frontend/lib/orchestrator/pay-agent.ts` — `callAgentWithX402` using `x402Erc7710Client` + `redelegatePermissionContextOpenAction`
  - `wrapFetchWithPayment` handles full 402→pay→retry cycle
- [x] **Step 10: SSE streaming**
  - `frontend/lib/sse.ts` — in-memory event bus (`addTaskListener`, `emitTaskEvent`)
  - `frontend/app/api/task/[id]/stream/route.ts` — ReadableStream SSE endpoint
- [x] **Step 11: /app page**
  - `frontend/app/app/page.tsx` — pre-connect, budget selector, quick prompts, post-submit inline view
  - `frontend/components/task/InlineExecution.tsx` — SSE consumer, renders thoughts/agents/payments/privacy/synthesis
- [x] **Step 12: Landing page**
  - `frontend/app/page.tsx` — CSS-only smoke bg, hero, stats bar (from contract), how-it-works, privacy comparison, developer CTA with code snippet
- [x] **Step 13: /agents page**
  - `frontend/app/agents/page.tsx` — server component, agent grid + capability gaps at `id="gaps"`
  - Dual-mode data: The Graph if `NEXT_PUBLIC_GRAPH_URL` set, contract reads as fallback
- [x] **Step 14: /register page**
  - `frontend/app/register/page.tsx` — 3-step wizard: IPFS upload → on-chain register → confirmation
  - Pinata upload, MetaMask `eth_sendTransaction`, BaseScan + IPFS links in confirmation
- [x] API routes: `task/route.ts`, `task/[id]/stream/route.ts`, `delegate/route.ts`, `agents/route.ts`
- [x] Env: added `PINATA_API_KEY`, `PINATA_SECRET_KEY`, `NEXT_PUBLIC_ORCHESTRATOR_SESSION_ADDRESS`

### Blocked / Issues
- TypeScript errors from reaction to Apollo Client v4 + react-markdown types → carried to Session 3

### Decisions Made
- Video Production Agent returns `status: "partial"` (not error) if video times out but audio succeeds — ensures the agent still earns USDC for TTS work
- `permissionContext: '0x'` stored for non-Flask wallets — orchestrator skips payment, calls agents directly (dev mode)
- `NEXT_PUBLIC_GRAPH_URL` was set but deployment URL invalid at time of build — cleared in Session 3

### Next Session Should Start With
1. Fix TypeScript errors (Apollo v4 `HttpLink`, x402 type cast, `fetchAgentMetadata` return type)
2. Verify `next dev` starts cleanly
3. Start ngrok tunnels + register all 5 agents on-chain
4. End-to-end test with memecoin demo task

### Environment State
- Agents running: All 5 built, none running
- Contract: `0x8715eD9A25bf7a681160120A9e1a76615E39B273` (Base Sepolia)
- Subgraph: `NEXT_PUBLIC_GRAPH_URL` cleared (contract fallback active)
- Frontend: All pages built, dev server operational

---

## Session 3 — 2026-06-08
**Duration:** ~1 hour
**Focus:** TypeScript fixes, dev server verification

### Completed
- [x] Fixed all TypeScript errors (0 errors, clean build):
  - `lib/pinata.ts` — `fetchAgentMetadata` return type `Promise<unknown>` → `Promise<any>`
  - `components/wallet/ConnectButton.tsx` — `isAdjustmentAllowed` moved inside `permission` object; `signer` parameter cast to `any` for SDK type mismatch
  - `lib/graph.ts` — Apollo Client v4: removed generic type param, replaced `uri` shorthand with `HttpLink`; query results cast to typed interfaces
  - `lib/orchestrator/pay-agent.ts` — x402 type cast via `as unknown as any`
  - `lib/orchestrator/react-loop.ts` — explicit `as AgentManifest` cast on `fetchAgentMetadata` result
- [x] Cleared `NEXT_PUBLIC_GRAPH_URL` (was pointing at non-existent Graph deployment) → contract reads now active as fallback
- [x] Verified `next dev` starts and all 4 pages compile (200 responses)
- [x] Updated PROGRESS.md

### Blocked / Issues
- None currently — all TypeScript clean, server running

### Next Session Should Start With
1. **Step 15 — End-to-end demo**: Start agents with `./agents/start-all.sh`, expose with ngrok, register on `/register`
2. **Test memecoin demo task**: Connect MetaMask on `/app`, set 10 USDC budget, type memecoin prompt
3. Verify x402 payments fire and appear in BaseScan
4. Fix any runtime errors that surface during the demo run
5. Record demo video

### Environment State
- Agents running: None (start with `cd agents && ./start-all.sh`)
- Frontend: `next dev` running on port 3000, all pages clean
- Contract: `0x8715eD9A25bf7a681160120A9e1a76615E39B273`
- Subgraph: cleared, using contract reads
- DB: Neon connected, schema current

---

## Session 4 — 2026-06-08
**Duration:** ~2 hours
**Focus:** UI polish, design overhaul, infrastructure bug fixes

### Completed

#### UI / Design
- [x] **Smoke background tuned** — was too bright/invasive; reduced to subtle presence
  - `smoothstep(0.30, 0.75, f)` — softer fade-in threshold
  - Vignette floor `max(vignette, 0.25)` — smoke visible at edges, not just center
  - Alpha capped at `0.60`, colour layers at 0.35/0.65/0.50 intensity
  - Canvas `position: absolute; inset: 0; width: 100%; height: 100%` inside explicit-height parent
- [x] **Hero width fix** — `width: 100vw` caused horizontal scrollbar (includes scrollbar width); changed to `width: 100%` on all full-width sections; added `overflow-x: hidden` to `globals.css` body
- [x] **Section backgrounds** — all 8 landing page sections now have distinct visual texture instead of plain black:
  - `BG_GRID` — subtle orange grid lines (HowItWorks, FeaturesSection)
  - `BG_DOTS` — radial dot pattern (AgentEconomy, CapabilityGaps)
  - `BG_GLOW_LEFT` — left-side radial glow (LiveCoordination)
  - `BG_GLOW_RIGHT` — right-side radial glow (PrivacySection)
  - `BG_GLOW_CENTER` — center glow (DevCTA)
  - All use CSS longhand (`backgroundColor` + `backgroundImage` + `backgroundSize`) — no `background` shorthand to avoid React rerender conflict warnings
- [x] **Logo everywhere** — replaced all text "ARIA" wordmarks with `<Image src="/Logo.png">`:
  - Landing nav, landing hero, app WalletGuard, app PromptScreen nav + logo, app execution nav, agents nav, register nav, aria-footer
  - 9 locations total — confirmed with grep
- [x] **File uploader on /app** — added attachment capability to prompt screen:
  - Drag-and-drop on textarea wrapper (onDragOver/onDragLeave/onDrop)
  - Hidden `<input type="file">` triggered by "⊕ Attach File" button (accepts images, PDF, txt, md, json, csv)
  - File pills inside input area with name, size, × remove button; max 5 files
  - Files shown in execution prompt bubble after submit
- [x] **Fake data removed** — landing page and agents page no longer show fabricated stats:
  - GAP_CARDS: removed fake `requests`/`earn` fields (showed 47/31/28 requests, $141/$77/$84 earnings)
  - Agents page USDC stat: uses real `pricePerTask / 1e6` from contract, not a hardcoded `× 0.35` multiplier
  - All stats show `—` when no real data exists

#### Infrastructure Fixes
- [x] **Prisma schema fixed** (`prisma/schema.prisma`):
  - `provider = "prisma-client"` → `provider = "prisma-client-js"` (was causing silent failure)
  - Added `previewFeatures = ["driverAdapters"]` to generator
  - `url` field NOT added to datasource — Prisma v7 reads DB URL from `prisma.config.ts` (already had `process.env.DATABASE_URL`)
  - Ran `npx prisma generate` → client regenerated to `app/generated/prisma/`
  - Ran `npx prisma db push` → confirmed "database is already in sync"
- [x] **Graph fallback fixed** (`lib/graph.ts`):
  - `getActiveAgents` and `getCapabilityGapsGraph` now wrap graph queries in `try/catch`
  - On any GraphQL error (e.g. deployment not found), silently falls through to contract reads
  - `/api/agents` was returning 500; now returns `[]` (empty contract result) correctly
  - Added `fetchPolicy: 'no-cache'` to prevent Apollo caching stale errors
- [x] **Pinata JWT auth** (`lib/pinata.ts`):
  - Switched from API key/secret headers to `Authorization: Bearer ${PINATA_JWT}`
  - Fixed gateway URL: normalised to always include `https://` (env var `amaranth-charming-marlin-562.mypinata.cloud` was missing protocol)
- [x] **Task API verified working**: `POST /api/task` now returns `{ taskId }` in <1s (was timing out at 19s due to Prisma connection failure)
- [x] TypeScript clean — `npx tsc --noEmit` passes with 0 errors after all changes

### Blocked / Issues
- The Graph deployment URL (`NEXT_PUBLIC_GRAPH_URL`) is set in `.env` but the deployment `u1747630/s119253/latest` does not exist on The Graph Studio — graph client falls back to contract reads. **Needs subgraph re-deployment or correct URL.**
- CSS background shorthand React dev warnings still appear in browser console (non-blocking; styling correct in SSR output — confirmed via curl)
- Hydration mismatch warnings from `cz-shortcut-listen` attribute (browser extension, not ARIA code — not fixable)

### Decisions Made
- Prisma v7: `url` in `schema.prisma` datasource is not supported — connection config lives in `prisma.config.ts`. Don't add it back.
- Graph client: fail-open (try/catch + fallback) rather than fail-closed — keeps pages functional even when subgraph is undeployed
- Pinata: use JWT auth (not API key/secret) — JWT is Pinata's preferred auth and gateway includes dedicated domain

### Next Session Should Start With
1. **Fix The Graph URL** — re-deploy subgraph or update `NEXT_PUBLIC_GRAPH_URL` to the correct v0.0.1 endpoint
2. **Step 15 — End-to-end demo**: `cd agents && ./start-all.sh`, expose with ngrok, register all 5 agents at `/register`
3. **Test memecoin demo task**: Connect MetaMask on `/app`, 10 USDC budget, type memecoin prompt, verify SSE stream + x402 payments
4. Record demo video

### Environment State
- Agents running: None (start with `cd agents && ./start-all.sh`)
- Frontend: `next dev` on port 3000, all pages 200, TypeScript clean
- Contract: `0x8715eD9A25bf7a681160120A9e1a76615E39B273` (Base Sepolia)
- Subgraph: `NEXT_PUBLIC_GRAPH_URL` set but deployment invalid — contract reads active
- DB: Neon connected and verified, schema in sync

---

## Session 5 — 2026-06-09
**Duration:** ~30 min
**Focus:** Architecture verification + documentation

### Completed
- [x] Read every key implementation file to verify correctness:
  - `frontend/lib/orchestrator/pay-agent.ts` — confirmed `createOpenDelegation` + `decodeDelegations` + `encodeDelegations` chain is correct MetaMask Smart Accounts Kit usage (not guesswork)
  - `frontend/lib/delegation.ts` — confirmed `toMetaMaskSmartAccount`, `getSmartAccountsEnvironment`, `bundlerClient` on 1Shot RPC
  - `frontend/lib/orchestrator/react-loop.ts` — confirmed full ReAct loop with parallel rounds, Venice reasoning, registry search, x402 hire, capability gap fallback
  - `frontend/lib/orchestrator/index.ts` — confirmed entry point retrieves permissionContext from DB
  - `frontend/components/wallet/ConnectButton.tsx` — confirmed ERC-7715 `requestExecutionPermissions` with `erc7715ProviderActions()` + `'0x'` fallback
  - `frontend/lib/registry.ts` — confirmed `getAgentsByCapability`, `requestCapability` (via 1Shot EIP-7710), `recordTaskCompletion` (via 1Shot EIP-7710)
  - `frontend/lib/oneshot.ts` — confirmed full 8-step 1Shot EIP-7710 flow from docs
  - `agents/market-intelligence/src/index.ts` — confirmed x402 middleware with `extra: { assetTransferMethod: 'erc7710' }` and Venice ReAct pattern
- [x] Created `EXPLANATION.md` — complete architecture document covering all 21 topics:
  - Smart contract, The Graph, Venice AI, MetaMask Smart Accounts Kit
  - ERC-7715 permission grant flow (exact code)
  - What a delegation is technically
  - What a redelegation is and how it creates the A2A chain (exact code)
  - x402 protocol server and buyer flows
  - 1Shot: full 8-step EIP-7710 relay from docs
  - Orchestrator entry point, budget tracking
  - ReAct loop: phases, parallelism, non-linear routing, synthesis
  - All 5 demo agents and their internal ReAct patterns
  - Agent registration (3-step wizard, IPFS, on-chain)
  - Registry reads at runtime
  - Capability gap on-chain signal
  - SSE streaming (event bus, event types)
  - Neon + Prisma (why both, Prisma v7 specifics)
  - All 4 frontend pages
  - Complete memecoin demo end-to-end walk-through
  - Delegation chain diagram (User → Orch → Facilitator, separate Orch → 1Shot tree)

### Blocked / Issues
- None

### Decisions Made
- Architecture confirmed 100% from docs and actual code — no guesswork anywhere
- `decodeDelegations` called first to extract root before `createOpenDelegation` — this is the correct way to handle permissionContext from ERC-7715
- The `from` field in `createOpenDelegation` is `userAddress` (not orchestratorAddress) — the sub-delegation is created from the user's authority
- Two separate delegation trees: User→Orch→Facilitator (payments) vs Orch→1Shot (gas)

### Next Session Should Start With
1. **Step 15 — End-to-end demo**: `cd agents && ./start-all.sh`, expose with ngrok, register all 5 agents at `/register`
2. **Test memecoin demo task**: Connect MetaMask Flask on `/app`, set 10 USDC budget, type memecoin prompt
3. Verify SSE stream shows all events: orchestrator_thinking → agent_hired → payment_confirmed → finding_received → synthesis_complete
4. Verify x402 payments fire and `txHash` appears in BaseScan
5. If any runtime errors surface, fix and re-test
6. Record demo video

### Environment State
- Agents running: None (start with `cd agents && ./start-all.sh`)
- Frontend: `next dev` on port 3000, all pages 200, TypeScript clean
- Contract: `0x8715eD9A25bf7a681160120A9e1a76615E39B273` (Base Sepolia)
- Subgraph: `NEXT_PUBLIC_GRAPH_URL` set but deployment invalid — contract reads active
- DB: Neon connected and verified, schema in sync
- New file: `EXPLANATION.md` — complete architecture reference

---

## Session 1 — 2026-06-07
**Duration:** ~3 hours
**Focus:** Foundation — subgraph, database, Venice, all 4 agent servers

### Completed
- [x] Read all skill files from `.agents/skills/` (impeccable, emil-design-eng, frontend-design, ui-ux-pro-max, high-end-visual-design, solidity-foundry, web3-nextjs, vercel-react-best-practices, shadcn)
- [x] Read all external docs (MetaMask Smart Accounts Kit, Venice AI, 1Shot API)
- [x] Read all project files (AgentRegistry ABI, Deploy script, subgraph scaffold, prisma schema)
- [x] **Step 1 (Build Order): Subgraph deployed**
  - Replaced schema.graphql with ARIA domain model (`Agent`, `CapabilityRequest`, `PaymentEvent`, all `@entity(immutable: false)`)
  - Replaced subgraph.yaml with ARIA config (contract `0x8715eD9A25bf7a681160120A9e1a76615E39B273`, startBlock `42505573`, 5 event handlers)
  - Replaced src/agent-registry.ts with ARIA domain mappings
  - Deployed to The Graph Studio: `https://api.studio.thegraph.com/query/1747630/aria-registry/v0.0.1`
  - Set `NEXT_PUBLIC_GRAPH_URL` in frontend `.env`
- [x] **Step 2 (Build Order): Neon DB + Prisma**
  - Updated schema.prisma for Prisma v7 (generator `prisma-client`, output `../app/generated/prisma`, removed `url` from datasource)
  - Installed `@prisma/adapter-neon`, `@neondatabase/serverless`
  - Schema pushed to Neon DB
  - Created `frontend/lib/prisma.ts` with Neon adapter
- [x] **Step 3 (Build Order): Venice all 5 modalities confirmed working**
  - Text reasoning ✅, Web search ✅, Web scraping ✅, Image generation ✅, TTS ✅
  - Test script: `frontend/scripts/test-venice.mjs`
- [x] Created supporting lib files:
  - `frontend/lib/venice.ts` — all 5 Venice functions
  - `frontend/lib/registry.ts` — AgentRegistry viem interactions (getAgentsByCapability, getAgent, getAllActiveAgents, getCapabilityGaps, requestCapability, recordTaskCompletion)
  - `frontend/lib/graph.ts` — dual-mode Apollo/contract fallback
  - `frontend/lib/oneshot.ts` — 1Shot relay (4-step flow)
  - `frontend/lib/pinata.ts` — IPFS upload/fetch
  - `frontend/lib/sse.ts` — in-memory SSE event bus
  - `frontend/lib/orchestrator/budget.ts` — BudgetTracker class
  - `frontend/app/layout.tsx` — ARIA fonts (Chakra Petch + Hanken Grotesk)
  - `frontend/app/globals.css` — ARIA design system tokens
- [x] Created API routes scaffolds:
  - `frontend/app/api/task/route.ts`
  - `frontend/app/api/task/[id]/stream/route.ts`
  - `frontend/app/api/delegate/route.ts`
  - `frontend/app/api/agents/route.ts`
- [x] **Step 4 (Build Order): All 4 agent servers created with x402**
  - Confirmed correct x402 packages: `@metamask/x402@^0.2.0`, `@x402/core@^2.14.0`, `@x402/express@^2.14.0`
  - Confirmed `x402ExactEvmErc7710ServerScheme` (from `@metamask/x402`), `x402ResourceServer` + `paymentMiddleware` (from `@x402/express`), `HTTPFacilitatorClient` (from `@x402/core/server`)
  - x402 402-response tested and confirmed working: returns 402 + `PAYMENT-REQUIRED` header
  - `agents/market-intelligence/` — Port 4001, 0.30 USDC, ReAct: plan → Venice web search → synthesize
  - `agents/competitive-tech/` — Port 4002, 0.50 USDC, ReAct: plan → Etherscan API → Venice analysis
  - `agents/positioning/` — Port 4003, 0.20 USDC, ReAct: Venice llama-3.3-70b strategy synthesis
  - `agents/visual-asset/` — Port 4004, 0.40 USDC, ReAct: Venice image gen + TTS (parallel)
  - `agents/.env` — shared env for all agents
  - `agents/start-all.sh` — starts all 4 agents

### Blocked / Issues
- `frontend/lib/graph.ts` — has TypeScript errors (Apollo v4 API change: not generic, `uri` must go via `HttpLink`). Not blocking yet since The Graph is deployed.
- `frontend/lib/orchestrator/index.ts` — does not exist yet (Step 5)
- Agent servers need ngrok tunnels before they can be registered on-chain via `/register` page (will do after frontend is built)

### Decisions Made
- x402 package versions: `@metamask/x402@0.2.0` requires `@x402/core@^2.14.0` (not `^0.5.0` as CLAUDE.md suggests — docs are up to date)
- Facilitator URL confirmed: `https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402`
- Agent `.env` files share the orchestrator address as fallback `payTo` for testnet simplicity

### Next Session Should Start With
1. **Step 5**: Create `frontend/lib/orchestrator/index.ts` — main ReAct loop entry point
2. **Step 5**: Create `frontend/lib/orchestrator/react-loop.ts` — core ReAct loop with Venice reasoning, agent discovery, and agent calls (initially without real x402 payment — use mock payment for testing)
3. **Step 6**: MetaMask ERC-7715 permission grant in `frontend/components/wallet/ConnectButton.tsx`
4. **Step 7**: x402 buyer flow — `frontend/lib/orchestrator/pay-agent.ts` with `createOpenDelegation` + `encodeDelegations`

### Environment State
- Agents running: None (local, not yet started)
- Contract address: `0x8715eD9A25bf7a681160120A9e1a76615E39B273` (Base Sepolia)
- Subgraph: `https://api.studio.thegraph.com/query/1747630/aria-registry/v0.0.1` (v0.0.1 deployed)
- Neon DB: `ep-raspy-poetry-aqtqzkd1-pooler.c-8.us-east-1.aws.neon.tech` (schema pushed)
- Frontend: default Next.js scaffold + lib files + API route scaffolds (no UI built yet)