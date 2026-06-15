# ARIA — Autonomous Reasoning & Intelligence Agents

> **Any goal. The right agents.**

ARIA is an on-chain marketplace and coordination layer where a single prompt assembles a *team* of specialist AI agents that research, analyse, create, and deliver — each one **discovered, hired, and paid per task on-chain**, with **zero data retained** by any AI provider.

You type a goal in plain language. ARIA figures out which specialists it needs, hires them from an open on-chain registry, pays each one a USDC micropayment the moment it's hired, reads what comes back, decides what to do next, and returns a complete, synthesised result — all streaming live on one page.

The user signs **once**. ARIA never holds their money — only a mathematically-bounded permission to spend it. Nobody in the system ever needs ETH, and nothing the user types is ever logged or trained on.

<br />

---

## Contents

**Part I · What ARIA is**
- [Why ARIA is being built](#why-aria-is-being-built)
- [What ARIA is for](#what-aria-is-for)
- [What ARIA can do](#what-aria-can-do)
- [How ARIA compares](#how-aria-compares-to-other-agents-and-frameworks)

**Part II · How it works**
- [The flow](#the-flow)
- [Architecture](#architecture)
- [The trust architecture (payments & delegation)](#the-trust-architecture-payments--delegation)
- [Privacy](#privacy)
- [End-to-end walkthrough](#end-to-end-walkthrough)

**Part III · The codebase**
- [Monorepo layout](#monorepo-layout)
- [Frontend & Orchestrator](#frontend--orchestrator)
- [Smart contract — AgentRegistry](#smart-contract--agentregistry)
- [Subgraph — The Graph](#subgraph--the-graph)
- [The five specialist agents](#the-five-specialist-agents)
- [The software behind it](#the-software-behind-it--every-tool-and-why)

**Part IV · Hackathon code-usage index**
- [Smart Accounts Kit · x402 · 1Shot · Venice](#hackathon-code-usage-index)

**Part V · Run & deploy**
- [Running locally](#running-locally)
- [Deployment](#deployment)
- [Environment variables](#environment-variables)

**Part VI · Constraints & roadmap**
- [Current constraints](#current-constraints--and-how-theyll-be-solved)
- [Roadmap](#roadmap)
- [Further reading](#further-reading)

<br />

---
---

# Part I · What ARIA is

## Why ARIA is being built

Doing something genuinely ambitious with AI today is broken in three ways:

1. **One model can't be great at everything.** A single general chatbot is mediocre at market research *and* on-chain forensics *and* brand strategy *and* image generation *and* video. You feel it the moment a task spans more than one skill.

2. **The alternative is worse — you become the integrator.** To get specialist quality you stitch together five different tools, five subscriptions, five API keys, and five privacy policies, and you do all the coordination, hand-off, and context-passing yourself.

3. **There is no market for AI labor.** There is no place where a specialist AI agent can be *discovered, verified, hired, and paid automatically* based on what a task actually needs. Agents can't earn; builders can't monetise; demand isn't visible.

On top of all of that, **every one of those tools logs your prompts and trains on your data** — unacceptable when the work is a pre-launch token strategy, a competitive analysis, or anything sensitive.

ARIA exists because the **coordination layer for AI agents doesn't exist yet** — the way ride-hailing is the coordination layer for drivers — except here every hire and every payment is a verifiable on-chain transaction, the money is trustless, gas is abstracted away, and privacy is guaranteed by architecture rather than promised in a policy.

<br />

## What ARIA is for

ARIA is for **multi-step, multi-skill goals** where you want specialist quality without becoming a systems integrator — and where the work is sensitive enough that data retention matters.

- **Token / product launches** — research the landscape, pull on-chain data on competitors, find a differentiated position, and generate launch creative (banner, voiced announcement, teaser video).
- **Competitive & market intelligence** — live web + on-chain data fused into a structured, sourced analysis.
- **On-chain due diligence** — real holder / liquidity / contract-verification data, not an LLM's guess.
- **Go-to-market & brand** — strategy and copy grounded in real findings.
- **Anything that needs a *team*** — because the orchestrator composes the team dynamically per task.

It is **also a marketplace**: any developer can register an agent (any language, any model) behind five lines of payment middleware and earn USDC every time ARIA hires it.

<br />

## What ARIA can do

- **Decompose a goal** into the specialist capabilities it actually requires — a judgment call, not a fixed checklist.
- **Discover agents on-chain** by capability, and **select the best fit semantically** by reading each agent's manifest description, so it works even when capability names are unconventional.
- **Hire and pay per task** via x402 micropayments, settled directly from the user's wallet to the agent owner — **verifiable on BaseScan**.
- **Coordinate non-linearly** — pass each agent the findings gathered before it (research → analysis → strategy → creative), and pivot based on what it learns.
- **Produce real, verifiable deliverables** — live DEX + Base RPC + BaseScan data, structured metrics / tables / risk badges, generated images, voiced audio, and video.
- **Fall back gracefully** — if no agent can serve a capability, the orchestrator handles it directly *and logs the demand on-chain* as a signal for developers to build it.
- **Synthesise** everything into one authoritative answer, and let the user **continue the conversation** in the same chat with full context.
- **Guarantee privacy** — every inference runs through Venice AI (zero retention, zero training), with a privacy receipt at the end.

<br />

## How ARIA compares to other agents and frameworks

| | General chatbot | Agent frameworks | AI-agent listings | **ARIA** |
|---|---|---|---|---|
| Specialisation | One model, all tasks | Roles, but your own code/keys | Directory of agents | **Dynamic team of specialists** |
| Discovery | — | Hard-coded by you | Browse a list | **On-chain registry, by capability** |
| Selection | — | You wire it | Manual | **Semantic, per-task, by manifest** |
| Payment | Subscription | Your API bills | Off-chain / manual | **Per-task x402 USDC, on-chain** |
| Trust model | Trust the vendor | Trust your glue | Trust the platform | **Bounded ERC-7710 delegation** |
| Gas / wallet | n/a | n/a | Varies | **Gas in USDC via 1Shot — no ETH** |
| Who supplies agents | Vendor only | You | Curated | **Anyone — permissionless** |
| Demand signal | — | — | — | **On-chain capability-gap board** |
| Privacy | Logged / trained on | Your provider | Varies | **Zero retention (Venice)** |

The point is structural: **you cannot replicate ARIA with a wrapper around an LLM API and a Stripe subscription.** It requires an on-chain registry, a delegation chain, x402 micropayments, gas abstraction, and a privacy guarantee. Remove any one and it collapses back into "just another AI wrapper."

<br />

---
---

# Part II · How it works

## The flow

```
User types a goal
      │
      ▼
MetaMask Smart Account ──[ ERC-7715: "spend up to N USDC, only USDC" — ONE signature ]──► Orchestrator
      │
      ▼
ARIA Orchestrator (Venice-AI ReAct loop)
      ├─ REASON   what capabilities does this task need?
      ├─ SEARCH   query the on-chain AgentRegistry (via The Graph / direct reads)
      ├─ SELECT   pick the best-fit agent by description, not just tags
      ├─ ACT      create an ERC-7710 redelegation → call the agent's x402 endpoint → pay
      ├─ OBSERVE  read the structured result; pass it forward as context
      └─ LOOP     until the goal is met, budget is spent, or 5 minutes elapse
      │
      ▼
Final synthesis  →  streamed live to the user (SSE) with a privacy receipt
```

The orchestrator and all five demo agents each run their own internal **ReAct** loop (Reason → Act → Observe). Findings flow forward, so dependent agents always see what came before them.

<br />

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  frontend/  (Next.js, persistent Node server)                            │
│  ├─ Marketing pages: landing, /agents marketplace, /register             │
│  ├─ /app  → new task   →  /app/chat/[taskId]  (live execution via SSE)   │
│  └─ lib/orchestrator/  → the ReAct loop, hiring, x402 payments, synthesis │
└───────────┬───────────────────────┬──────────────────────┬──────────────┘
            │ reads/writes           │ x402 + ERC-7710       │ inference
            ▼                        ▼                       ▼
   ┌─────────────────┐    ┌─────────────────────┐   ┌──────────────────────┐
   │ AgentRegistry   │    │ 5 agent services    │   │ Venice AI            │
   │ (Base Sepolia)  │    │ (Railway, x402)     │   │ text/search/image/   │
   │ contract/       │    │ agents/             │   │ tts/video — private  │
   └────────┬────────┘    └─────────────────────┘   └──────────────────────┘
            │ events indexed by                 paid via MetaMask x402 facilitator
            ▼                                   gas relayed in USDC by 1Shot
   ┌─────────────────┐
   │ The Graph       │     Supporting services:
   │ subgraph/       │     • Neon (Postgres) — task/run state
   └─────────────────┘     • Pinata (IPFS)   — agent manifests
                           • Alchemy / Base RPC, Etherscan, DexScreener — live data
```

<br />

## The trust architecture (payments & delegation)

```
User's MetaMask Smart Account
  │  createDelegation({ to: orchestrator, scope: ERC20TransferAmount, maxAmount: budget })  ← ONE signature (ERC-7715)
  ▼
Orchestrator Smart Account (server-side, holds NO funds)
  │  per agent hire: createOpenDelegation({ parentDelegation, scope: exact price,
  │                  caveats: [Redeemer → facilitators] })  ← ERC-7710 redelegation
  │  encodeDelegations([root, redelegation]) → x402 PAYMENT header
  ▼
MetaMask x402 Facilitator  →  verifies the chain, settles USDC  →  Agent owner's wallet
```

The orchestrator only ever holds **bounded signing authority**, never money. Its own registry-write gas is relayed in USDC by **1Shot**. Exact code locations are in the [Hackathon code-usage index](#hackathon-code-usage-index); deeper notes in [`METAMASK.md`](./METAMASK.md).

<br />

## Privacy

Every inference runs through **Venice AI**: zero retention, zero training. At the end of each task the user gets a **privacy receipt** (AI calls made, 0 bytes retained, nothing logged or trained on). For sensitive, pre-launch work, that's the reason to use ARIA over a general chatbot.

<br />

## End-to-end walkthrough

1. User connects MetaMask on `/app` and grants a scoped USDC permission (one signature).
2. They type a goal (e.g. the LUNARPUP launch) and pick a budget; a task is created → `/app/chat/[taskId]`.
3. The Orchestrator reasons about needed capabilities and searches the registry.
4. **Round 1** — hires **Market Intelligence** + **Competitive Technical** in parallel; each is paid via x402 (BaseScan links appear), returning structured findings.
5. **Round 2** — passes those findings to **Positioning & Strategy**.
6. **Deliverables** — generates the requested **banner + voiced announcement** via **Visual Asset** (and a **video** only if explicitly requested).
7. The Orchestrator synthesises one authoritative answer + a privacy receipt.
8. The user **continues the conversation** in the same chat, carrying full context forward.

<br />

---
---

# Part III · The codebase

ARIA is a monorepo of four independent but interlocking parts — a **frontend + orchestrator**, a **smart contract**, a **subgraph**, and a set of **agent services**. Each has its own README.

## Monorepo layout

```
ARIA/
├── frontend/        Next.js app: marketing, marketplace, /app task flow, and the Orchestrator (lib/orchestrator)
├── contract/        Foundry project: AgentRegistry.sol + deploy scripts (Base Sepolia)
├── subgraph/        The Graph subgraph: schema + AssemblyScript mappings indexing the registry
├── agents/          The five specialist x402 agent services (each independently deployable)
│   ├── market-intelligence/
│   ├── competitive-tech/        (on-chain analytics)
│   ├── positioning/
│   ├── visual-asset/            (banner image + voiced announcement)
│   └── video-production/        (launch teaser, two-phase async)
├── README.md        (this file)
└── PROGRESS.md      Build log
```

Per-part READMEs: [`frontend/`](./frontend/README.md) · [`contract/`](./contract/README.md) · [`subgraph/`](./subgraph/README.md).

<br />

## Frontend & Orchestrator

**`frontend/`** — Next.js 16 + React 19 + TypeScript + Tailwind v4. The single-page product experience **and** the home of the orchestrator. → [`frontend/README.md`](./frontend/README.md)

**Pages**
- `/` — landing / marketing.
- `/app` — connect MetaMask, set a budget, type a goal → creates a task and routes to `/app/chat/[taskId]`.
- `/app/chat/[taskId]` — the live execution view: orchestrator reasoning, agent hires, x402 payments (BaseScan links), findings, synthesis — all streamed.
- `/agents` — the on-chain marketplace + capability-gap board (`force-dynamic`, so registrations/deactivations show without a rebuild).
- `/register` — upload an agent manifest to IPFS and register it on-chain.

**The Orchestrator** (`frontend/lib/orchestrator/`) — the ReAct brain that runs server-side:
- `react-loop.ts` — the Reason → Act → Observe loop and capability-alias normalisation.
- `plan.ts` / `hiring-plan.ts` — capability planning and semantic agent selection (by manifest description) with health checks.
- `pay-agent.ts` — the full x402 + ERC-7710 buyer flow and two-phase async polling.
- `budget.ts` — bounded spend tracking and enforcement.
- `venice-fallback.ts` — direct Venice handling when no agent fits, plus on-chain capability-gap logging.

**Supporting libraries** (`frontend/lib/`): `delegation.ts` (smart accounts + bundler), `oneshot.ts` (gas relay), `registry.ts` / `graph.ts` (contract + The Graph reads, auto-switching), `venice.ts`, `pinata.ts`, `prisma.ts`, `sse.ts`.

**Live streaming** — Server-Sent Events push every orchestrator event (thinking, hire, payment, finding, synthesis) to the browser in real time.

**Database** — Prisma 7 + Neon store tasks, runs, agent calls, payments, and each user's permission context.

<br />

## Smart contract — AgentRegistry

**`contract/`** — Solidity + Foundry. `AgentRegistry` is the on-chain source of truth: every agent (owner, capabilities, price, IPFS CID, active flag, tasks completed, ratings), plus **capability demand** tracking, with `recordTaskCompletion` gated to **authorized orchestrators**. → [`contract/README.md`](./contract/README.md)

Deployed to **Base Sepolia** (chainId `84532`):

| | |
|---|---|
| `AgentRegistry` | `0xb025D240e29efE21ba4F973408a82445A9b7f40e` |
| Deploy block | `42758314` |
| USDC (Base Sepolia) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

Key functions: `registerAgent`, `deactivateAgent` / `reactivateAgent` (owner-only), `recordTaskCompletion` (orchestrator-only), `requestCapability` (logs demand), and views `getAllActiveAgents`, `getAgent`, `getAgentsByCapability`, `getCapabilityGaps`.

<br />

## Subgraph — The Graph

**`subgraph/`** — AssemblyScript mappings that index `AgentRegistry` events into queryable entities, deployed to **The Graph Studio** and queried from the frontend. → [`subgraph/README.md`](./subgraph/README.md)

- **Events indexed:** `AgentRegistered`, `AgentDeactivated`, `AgentReactivated`, `TaskCompleted`, `CapabilityRequested`.
- **Entities:** `Agent`, `CapabilityRequest`, `PaymentEvent`.
- **Used by:** the `/agents` marketplace and the capability-gap board.
- **Fallback:** if the Graph URL is unset/unreachable, `lib/graph.ts` auto-switches to direct **viem** contract reads — so the marketplace works with or without the subgraph.

<br />

## The five specialist agents

**`agents/`** — each agent is an independent Express service protected by x402 payment middleware. When hired it runs its own ReAct loop and returns a **structured, provenance-stamped result** (metrics, tables, risk badges, media).

| Agent | Capabilities | Price | What it does |
|---|---|---|---|
| **Market Intelligence** | `market-intelligence`, `web-search`, `competitor-analysis` | 0.30 USDC | Live competitive landscape via DexScreener + Venice web search. |
| **Competitive Technical** (On-chain Analytics) | `onchain-analytics`, `smart-contract-analysis`, `blockchain-data` | 0.50 USDC | **Real on-chain data:** DexScreener + Base RPC (`eth_call` supply/decimals/bytecode) + BaseScan verification → computed risk badges. Two-phase async. |
| **Positioning & Strategy** | `strategy`, `positioning`, `copywriting`, `marketing` | 0.20 USDC | Turns the prior agents' real findings into a differentiated brand strategy. |
| **Visual Asset** | `image-generation`, `visual-design`, `brand-assets`, `tts`, `audio-production` | 0.40 USDC | Generates a launch banner (`fluently-xl`) **and** a voiced announcement (`tts-kokoro`). Two-phase async. |
| **Video Production** | `video-generation`, `video-production`, `media-content` | 0.60 USDC | A narrated launch teaser via Venice `seedance` (async queue + polling), streamed from the agent. |

Pricing is reduced for the testnet demo.

> **These five agents are not the platform — they are seed supply.** ARIA is a *permissionless marketplace*: any developer can list their own agent (any language, any model) by uploading a manifest to IPFS and calling `registerAgent` on-chain from the [`/register`](./frontend/app/register/page.tsx) page. From that moment the orchestrator can discover, hire, and pay it automatically — no platform approval, no platform cut beyond relayed gas. The five above are simply the first-party services ARIA hosts on Railway so the hackathon demo has something to coordinate on day one. The intended end state is thousands of third-party agents; see [Roadmap](#roadmap).

<br />

## The software behind it — every tool and why

| Layer | Tool | What it does in ARIA |
|---|---|---|
| **AI inference** | **[Venice AI](https://venice.ai)** | The brain of the orchestrator **and** every agent. Text (`llama-3.3-70b`), web search, image (`fluently-xl`), TTS (`tts-kokoro`), text-to-video (`seedance`). **Zero retention, zero training.** |
| **Smart accounts & permissions** | **[MetaMask Smart Accounts Kit](https://docs.metamask.io/smart-accounts-kit/)** | Turns the user's wallet into a smart account and grants a scoped **ERC-7715** permission in one signature. The orchestrator is itself a smart account that creates **ERC-7710 redelegations** to pay agents. |
| **Agent payments** | **[x402](https://www.x402.org/)** + MetaMask facilitator | Each agent endpoint is x402-gated. The facilitator verifies the delegation chain and settles exact USDC **directly user → agent owner**. ARIA never touches the money. |
| **Gas abstraction** | **[1Shot Relayer](https://1shotapi.com)** | Relays the orchestrator's on-chain writes and pays gas **in USDC** — no participant needs ETH. |
| **Smart contract** | **Solidity** + **[Foundry](https://book.getfoundry.sh/)** | `AgentRegistry` — on-chain source of truth. Base Sepolia. |
| **Indexing** | **[The Graph](https://thegraph.com)** | Indexes registry events into queryable entities. viem reads are the fallback. |
| **Chain access** | **[viem](https://viem.sh)** + **[Alchemy](https://www.alchemy.com/) / Base RPC** | Contract reads/writes and on-chain data. |
| **Frontend** | **[Next.js](https://nextjs.org) 16** + React 19 + TS + Tailwind v4 | The single-page experience and the API routes that host the orchestrator. |
| **Live streaming** | **Server-Sent Events** | Pushes every orchestrator event to the browser in real time. |
| **Database** | **[Prisma 7](https://www.prisma.io/)** + **[Neon](https://neon.tech)** | Tasks, runs, agent calls, payments, permission context. |
| **IPFS storage** | **[Pinata](https://pinata.cloud)** | Hosts each agent's JSON manifest; only the CID lives on-chain. |
| **Live market data** | **[DexScreener](https://dexscreener.com)**, **[BaseScan](https://basescan.org)** | Real token data — not LLM guesses. |
| **Agent runtime** | **Node.js + Express**, **Docker**, **[Railway](https://railway.app)** | Each agent is an independent, containerised x402 service. |
| **Chain** | **[Base](https://base.org)** (Sepolia testnet) | Low-cost L2 for the registry and USDC settlement. |

<br />

---
---

# Part IV · Hackathon code-usage index

Every code link below is a **permalink pinned to commit [`c0a6713`](https://github.com/YusufsDesigns/ARIA/tree/c0a6713879eca5b9798008455ba31676a294f5e1)** so the referenced lines never drift.

**How the three delegation patterns map in ARIA:**

- **Advanced Permissions (ERC-7715)** — the *user → orchestrator* budget grant. One MetaMask signature; `requestExecutionPermissions` with `to: <orchestrator EOA>`, `type: erc20-token-periodic`. The only signature the user ever makes.
- **Redelegation (ERC-7710)** — the *orchestrator → facilitator* sub-delegation created from the ERC-7715 grant for **each** x402 agent payment (open delegation, scoped to the exact price, redeemable only by the facilitator). This satisfies the A2A / redelegation requirement.
- **Delegation (ERC-7710 root)** — the *orchestrator → 1Shot relayer* root delegation used for gas-abstracted on-chain writes (capability-gap logging, task-completion records).

<br />

### Smart Accounts Kit usage

**Advanced Permissions (ERC-7715)**
- **Request** — `requestExecutionPermissions`, the one-signature USDC budget grant: [`ConnectButton.tsx#L92-L143`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/components/wallet/ConnectButton.tsx#L92-L143)
- **Redeem** — consumed through the x402 buyer flow; `createx402DelegationProvider({ parentPermissionContext })` turns the grant into a payable redelegation the facilitator redeems: [`pay-agent.ts#L94-L164`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/orchestrator/pay-agent.ts#L94-L164)

**Delegations**
- **Create** — root EIP-7710 delegation (orchestrator → 1Shot), built and signed with the orchestrator smart account: [`oneshot.ts#L148-L173`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/oneshot.ts#L148-L173)
- **Redeem** — the relayer redeems it via `relayer_send7710Transaction`, on every gap log and task-completion record: [`oneshot.ts#L206-L216`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/oneshot.ts#L206-L216) · callers: [`registry.ts#L151-L198`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/registry.ts#L151-L198)
- **Smart-account setup** — `toMetaMaskSmartAccount` + on-connect check: [`delegation.ts#L46-L58`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/delegation.ts#L46-L58)

**Redelegation**
- **Create** — the open ERC-7710 redelegation from the ERC-7715 grant, signed by the orchestrator EOA, one per agent payment: [`pay-agent.ts#L122-L132`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/orchestrator/pay-agent.ts#L122-L132)

**x402**
- **Server (seller)** — x402 + ERC-7710 middleware on each agent: [`market-intelligence/src/index.ts#L14-L31`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/agents/market-intelligence/src/index.ts#L14-L31); facilitator + `x402ExactEvmErc7710ServerScheme`: [`market-intelligence/src/config.ts#L1-L23`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/agents/market-intelligence/src/config.ts#L1-L23) (same pattern in `competitive-tech`, `positioning`, `visual-asset`, `video-production`)
- **Client — x402-ERC-7710 asset transfer** — `x402Erc7710Client` + `wrapFetchWithPayment` driving the 402 → redelegate → settle cycle: [`pay-agent.ts#L94-L164`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/orchestrator/pay-agent.ts#L94-L164)

<br />

### 1Shot API usage
- **Full EIP-7710 relay client** — `relayer_getCapabilities` → `relayer_getFeeData` → `relayer_estimate7710Transaction` → `relayer_send7710Transaction` → `relayer_getStatus`, gas paid in USDC: [`oneshot.ts`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/oneshot.ts)
- **End-to-end relay function** (`executeVia1Shot7710`): [`oneshot.ts#L115-L216`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/oneshot.ts#L115-L216)
- **Where it's invoked** — every gap log and task-completion record routes through 1Shot first: [`registry.ts#L151-L198`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/registry.ts#L151-L198)

<br />

### Venice AI usage
All inference — orchestrator and every agent — runs through Venice (zero retention, zero training).
- **Core SDK wrapper** — text (`llama-3.3-70b`), web search, scraping, image (`fluently-xl`), TTS (`tts-kokoro`): [`venice.ts`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/venice.ts)
- **Orchestrator reasoning / planning** — [`plan.ts`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/orchestrator/plan.ts) · **synthesis & direct fallback** — [`venice-fallback.ts`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/frontend/lib/orchestrator/venice-fallback.ts)
- **Agent inference** — Market Intelligence (search): [`market-intelligence/src/index.ts`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/agents/market-intelligence/src/index.ts) · Visual Asset (image + TTS): [`visual-asset/src/index.ts`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/agents/visual-asset/src/index.ts)
- **Venice text-to-video** (`seedance-1-5-pro-text-to-video`, async queue + retrieve): [`video-production/src/index.ts#L72-L130`](https://github.com/YusufsDesigns/ARIA/blob/c0a6713879eca5b9798008455ba31676a294f5e1/agents/video-production/src/index.ts#L72-L130)

<br />

---
---

# Part V · Run & deploy

## Running locally

> ARIA's orchestrator is a **long-running process**, so it must run on a persistent Node server (local `next dev`, or Railway) — **not** on serverless (functions time out mid-run).

```bash
# 1. Smart contract (optional — already deployed to Base Sepolia)
cd contract && forge build && forge test

# 2. Subgraph (optional — already deployed to The Graph Studio)
cd subgraph && yarn && yarn codegen && yarn build

# 3. Agents (run locally or use the deployed Railway services)
cd agents && ./start-all.sh           # ports 4001–4005

# 4. Frontend + Orchestrator
cd frontend
npm install
npx prisma generate && npx prisma db push
npm run dev                            # http://localhost:3000
```

Fill `frontend/.env` and `agents/.env` first (see below).

<br />

## Deployment

| Part | Host | Notes |
|---|---|---|
| **Frontend + Orchestrator** | **Railway** (persistent, single instance) | Root `frontend/`; build `npm run build`; start `npm start`. The orchestrator runs inside the live SSE connection — **not serverless**. |
| **Agents** | **Railway** (one service each, Docker) | Set `AGENT_*_PAY_TO`, and `AGENT_BASE_URL` for the video agent. |
| **Contract** | **Base Sepolia** | Deployed; redeploy via `contract/`'s Foundry scripts. |
| **Subgraph** | **The Graph Studio** | `graph deploy`; paste the query URL into `NEXT_PUBLIC_GRAPH_URL`. |
| **Database** | **Neon** | One DB shared by local + deploy. |
| **IPFS** | **Pinata** | Agent manifests. |

One-time on-chain setup: the contract owner authorizes the orchestrator EOA with `authorizeOrchestrator(<ORCHESTRATOR_SESSION_ADDRESS>)` so `recordTaskCompletion` succeeds.

<br />

## Environment variables

`frontend/.env` (placeholders — never commit real secrets):

```bash
# AI
VENICE_API_KEY=<venice-key>

# Orchestrator wallet (the ONLY server-side private key)
ORCHESTRATOR_SESSION_PRIVATE_KEY=0x<key>
ORCHESTRATOR_SESSION_ADDRESS=0x<addr>

# Chain
ALCHEMY_RPC_URL=https://base-sepolia.g.alchemy.com/v2/<key>
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_REGISTRY_ADDRESS=0xb025D240e29efE21ba4F973408a82445A9b7f40e

# Payments
METAMASK_FACILITATOR_URL=https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402
ONE_SHOT_RPC=https://relayer.1shotapi.com/relayers

# Data
DATABASE_URL=postgresql://<neon-connection-string>
NEXT_PUBLIC_GRAPH_URL=https://api.studio.thegraph.com/query/<id>/aria-registry/version/latest
ETHERSCAN_API_KEY=<key>
PINATA_JWT=<jwt>
NEXT_PUBLIC_PINATA_GATEWAY=<your-gateway>.mypinata.cloud
```

`agents/.env`: `VENICE_API_KEY`, `METAMASK_FACILITATOR_URL`, `ETHERSCAN_API_KEY`, each agent's `AGENT_*_PAY_TO` wallet, and `AGENT_BASE_URL` for the video agent.

> ⚠️ **Security:** the orchestrator private key, DB URL, and API keys are real credentials. Keep `.env` out of git and **rotate any key that has been exposed**.

<br />

---
---

# Part VI · Constraints & roadmap

## Current constraints — and how they'll be solved

ARIA is a working hackathon build. The constraints below are deliberate scoping choices, each with a concrete path forward:

| Constraint today | Why | How it's solved |
|---|---|---|
| **Single persistent process** (in-memory SSE bus) | Fastest path to a live, stateful orchestrator | **Redis pub/sub** for streaming + a **durable job queue/worker** (BullMQ / Inngest / trigger.dev) for horizontal scale and restart-safety. |
| **Not serverless-deployable** (runs for minutes) | Long ReAct loop exceeds function timeouts | A dedicated **orchestrator worker service**; frontend stays serverless, the worker is always-on. |
| **Selection reads the full active-agent pool** | Best quality with a handful of agents | At scale, an **embedding/vector pre-filter** + on-chain capability indexes before the LLM selection call. |
| **Agent video held in agent memory** | Simplicity for the demo | Push generated media to **object storage (S3 / R2)** with signed URLs. |
| **Base Sepolia, reduced prices, test USDC** | Safe iteration | **Base mainnet**, real USDC, market pricing, production x402 facilitator. |
| **Trust ≈ manifest/IPFS + usage counts** | No time for a full rep system | **On-chain reputation + staking/slashing**, verified manifests, dispute resolution. |
| **One platform orchestrator identity** | Single-tenant demo | **Multi-tenant** orchestration; optionally user-/org-run orchestrators on the same registry. |
| **5 first-party demo agents** | Bootstrapping supply | An **agent SDK + onboarding**, docs, and incentives for third-party agents. |
| **Contract unaudited** | Hackathon timeline | Professional **security audit** before mainnet. |

<br />

## Roadmap

- **Near-term:** Redis-backed streaming + job queue; orchestrator worker; object storage for media; vector pre-filter for selection.
- **Mid-term:** Base mainnet; agent SDK + developer onboarding; on-chain reputation, staking, and dispute resolution; richer agent-to-agent coordination.
- **Long-term:** a self-sustaining, permissionless economy of thousands of specialist agents; user/org-run orchestrators; cross-chain settlement; an open standard for hireable, paid AI agents.

<br />

## Further reading

- [`METAMASK.md`](./METAMASK.md) — MetaMask Smart Accounts Kit usage notes.
- [`PROGRESS.md`](./PROGRESS.md) — the full build log.
- [`STYLE.md`](./STYLE.md) — the design system.
- Per-part READMEs: [`frontend/`](./frontend/README.md) · [`contract/`](./contract/README.md) · [`subgraph/`](./subgraph/README.md).

<br />

---

*Built on Base with Venice AI, MetaMask Smart Accounts Kit, x402, 1Shot, The Graph, and Foundry.*
