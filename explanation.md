# ARIA — The Complete Explanation

> One document. Everything. Written as the engineer who built it, for the person
> who owns it. It explains what ARIA is, **why we use a blockchain at all** (and
> whether we truly need to), every technology and exactly how it's wired on
> **both sides** (the developer/agent side and the ARIA/buyer side), every key,
> the full delegation/payment mechanism with code you can open and read, the
> honest constraints, and how this becomes something global and enormously
> valuable. Nothing is summarised away. Read it once top-to-bottom; after that,
> use it as a reference.

---

## Table of contents

**Part I — The product**
1. [What ARIA actually is](#1-what-aria-actually-is)
2. [Why this exists and why now](#2-why-now)
3. [The honest billion-dollar question](#3-billion-dollar)

**Part II — Why blockchain (the real discussion)**
4. [Why a blockchain at all — is it even necessary?](#4-why-blockchain)
5. [Is it just Ethereum/Base? Multi-chain and the future](#5-multichain)
6. [Blockchain + AI — labor vs. economy, and how far this goes](#6-blockchain-ai)

**Part III — The architecture, end to end**
7. [The repository, folder by folder](#7-repo)
8. [The end-to-end flow, narrated](#8-flow)
9. [The four keys — who holds what (and who holds nothing)](#9-keys)
10. [Delegations — the root grant](#10-delegations)
11. [Re-delegations — paying an agent](#11-redelegations)
12. ["OAuth" — what it really means here](#12-oauth)
13. [MetaMask smart wallet — what it actually is](#13-smart-wallet)
14. [x402 on BOTH sides — seller code vs. buyer code](#14-x402)
15. [1Shot — exactly where, and can it be removed](#15-1shot)
16. [Venice — both sides, swap points, the better way](#16-venice)
17. [Every other technology](#17-other-tech)
18. [The Orchestrator in full](#18-orchestrator)
19. [The agents in full](#19-agents)

**Part IV — The future**
20. [Concept vs. implementation — what's load-bearing](#20-concept-vs-impl)
21. [Current constraints — the unflinching list](#21-constraints)
22. [How ARIA goes global (beyond MetaMask)](#22-global)
23. [The roadmap to a real company](#23-roadmap)
24. [Do I believe in it?](#24-belief)

---

# PART I — THE PRODUCT

<a name="1-what-aria-actually-is"></a>
## 1. What ARIA actually is

ARIA — **Autonomous Reasoning and Intelligence Agents** — is a platform where a
single sentence from a person triggers a **team of specialist AI agents** that
research, analyse, create, and deliver a finished result. Each agent is an
independent web service, **discovered on-chain**, **hired and paid per task in
USDC**, and **coordinated automatically** by a central reasoning engine called
the Orchestrator. Every AI call — the Orchestrator's thinking and every agent's
work — runs through **Venice AI**, which retains zero data and trains on nothing.

The one-line version: **ARIA is to AI agents what Uber is to drivers** — a
coordination layer that matches demand (a user's goal) to supply (specialist
agents), settles payment automatically and trustlessly, and takes no custody of
anyone's money or data in the process.

The thing that makes it *not* "an app that calls an LLM five times" is the trust
architecture. The user signs **one** permission. From that point the system can
hire and pay any number of agents, each payment **cryptographically bounded** so
nobody — not ARIA, not the agents — can ever overspend or touch funds outside the
exact amount approved. That property cannot be faked with API keys and a Stripe
subscription. It requires the on-chain registry, the delegation chain, the x402
micropayment rail, gas abstraction, and the privacy guarantee.

Concretely, in this repository ARIA is:

- **One Solidity contract** deployed to Base Sepolia (the registry).
- **One Next.js app** that is simultaneously the marketing site, the product UI,
  the agent marketplace, *and* the server that runs the Orchestrator.
- **Five independent agent microservices** (Express + x402), deployed separately,
  each earning USDC per task.
- **One subgraph** indexing the registry for fast reads.
- **A Postgres database** (Neon) holding task history and the user's permission.

<a name="2-why-now"></a>
## 2. Why this exists and why now

Today if you want to do something ambitious with AI — launch a token, research a
market, audit a contract, produce campaign assets — you have two bad options:

1. **One general chatbot** that's mediocre at all of them and logs everything you
   type, trains on it, and may surface your pre-launch strategy to a competitor.
2. **Five separate tools**, five subscriptions, five privacy policies, and *you*
   become the coordination layer, copy-pasting between them.

There is **no marketplace** where specialist agents can be discovered, hired, and
paid based on what a task actually needs. ARIA is that missing layer.

**Why now** — three things became real in the last ~18 months that make ARIA
buildable for the first time:

- **Account abstraction matured** (ERC-4337 → EIP-7702 → MetaMask Smart Accounts +
  ERC-7710/7715). A user can now grant a *bounded, revocable spending permission*
  without handing over keys or pre-funding an escrow.
- **x402 standardised machine-to-machine payment** over plain HTTP. An agent can
  charge per request with a few lines of middleware — no contracts, no Stripe.
- **Privacy-first inference (Venice)** made "zero data retention" a *verifiable
  architectural property* rather than a marketing line.

The combination is what's new. ARIA is the product that only becomes possible when
all three land together.

<a name="3-billion-dollar"></a>
## 3. The honest billion-dollar question

You asked me directly: can ARIA be a billion-dollar company, and how. Honestly:

**Yes — the *idea* is genuinely billion-dollar shaped.** The reasoning, not the
hype:

- **The market is the right kind.** "Coordination layers for fragmented supply" is
  the most reliable pattern for outsized outcomes — Uber, Airbnb, Stripe, the App
  Store, Shopify, Upwork. Each took a fragmented supply side and made it
  discoverable, payable, and trustable. **AI agents are about to be the most
  fragmented supply side in history.** Whoever becomes the *settlement + discovery*
  layer owns a toll booth on a huge amount of economic activity.
- **The business model is a take-rate, not a wrapper margin.** ARIA doesn't need to
  be smarter than OpenAI. It needs to be the *place where work gets brokered and
  paid for*. A 5–15% take on every agent hire, at scale, is a Stripe-shaped
  business. The contract already has the hooks (`recordTaskCompletion`, payment
  events); today the platform takes 0% (only gas), a deliberate growth choice.
- **The moat compounds.** Registry + ratings + the capability-gap demand signal +
  manifests form a **two-sided network effect**: more agents → better completion →
  more users → more demand signal → more developers. That flywheel is in the code
  (`requestCapability` logs unmet demand on-chain — `contract/src/AgentRegistry.sol:224`).

**But** — being straight with you — **what's in this repo today is an MVP that
proves the mechanism, not a company.** The gap is mostly §21 (constraints) and §22
(going global). The biggest single one you already named: **requiring MetaMask + a
crypto wallet + testnet USDC is a wall most of the planet will never climb.** The
path to a billion runs directly through *removing that wall while keeping the
trust property the wall gives you.* That's solvable (§22).

So: the idea — yes. The current implementation — an excellent proof. Treat it as
the engine, not the car.

---

# PART II — WHY BLOCKCHAIN

<a name="4-why-blockchain"></a>
## 4. Why a blockchain at all — is it even necessary?

This is the most important question in the whole project, so I'll answer it the
way I'd want it answered: argue *against* blockchain first, then show what it
genuinely buys us, then give a verdict per layer.

### 4.1 The skeptic's case (and it's half right)

You could build a version of ARIA with **zero blockchain**:
- The **agent registry** → a Postgres table. Discoverability doesn't need a chain.
- **Reputation** → a reviews table, like Uber or Upwork.
- **Paying agents** → **Stripe Connect**, which *literally* does "a platform hires
  and pays third-party providers on a user's behalf," and handles KYC, fraud,
  chargebacks, and fiat for you.

So for *discovery and reputation*, blockchain is a **nice-to-have** (it adds
neutrality and composability), **not a strict must-have.** I won't pretend
otherwise — anyone who tells you "it must be on-chain" for the registry alone is
selling ideology, not engineering.

### 4.2 What the blockchain genuinely buys us (and one of these is decisive)

Here is what the Stripe+Postgres version *cannot* do, no matter how well built:

**(1) Micropayments — the decisive one.** A Stripe charge costs roughly **$0.30 +
2.9%**. Your agents charge **$0.20–$0.60**. On a card rail, **the fee is bigger
than the payment** — paying an agent $0.20 with a card *loses money on the fee
alone.* Stablecoins on an L2 settle for a fraction of a cent. **An economy of tiny,
per-task payments is only economically viable on crypto rails.** This is not
ideology; it's arithmetic, and it's the single strongest reason the payment layer
is crypto. The agent prices in this repo (`agents/*/src/index.ts`,
`$0.20`–`$0.60`) would be *impossible* on Stripe.

**(2) Machine-native, autonomous payments.** Agents are software. Software can't
open a Stripe account, pass KYC, or hold a billing address. Card rails were built
for humans with identities. x402 + delegations let *a piece of software pay
another piece of software* with no human in the loop. As the agent economy shifts
from "human hires agent" to "**agent hires agent**" — which the redelegation chain
in `frontend/lib/orchestrator/pay-agent.ts` *already supports* — card rails break
down entirely, and crypto becomes the *only* money software can natively hold and
spend.

**(3) Trust-minimized authority without custody.** Stripe is a trusted middleman:
it *holds* funds, *can* be hacked, *can* freeze your account. ARIA's delegation
model means ARIA **mathematically cannot overspend or touch the funds** — the
user's USDC moves directly from their wallet to the agent, bounded by a signed
permission, enforced by a contract. Most casual users won't care about this —
until they get burned. **Businesses and high-value/sensitive users care a lot.**

**(4) A permissionless, neutral marketplace.** Anyone can register an agent
without ARIA's approval, and ARIA **cannot delist or de-rank them off-platform**
because the registry is a neutral contract, not ARIA's private database. Ask any
developer who's been arbitrarily kicked off an app store why that matters. A
neutral rail is one developers will build on more willingly — which directly feeds
the supply-side flywheel.

**(5) Composability and openness.** Other apps can read the *same* registry, hire
the *same* agents, settle on the *same* rail. The agents aren't locked inside ARIA.
That openness is a network-effect property you only get from a public chain.

### 4.3 The verdict, layer by layer

| Layer | Could it be centralized? | Should it be on-chain? | Why |
|---|---|---|---|
| **Agent registry / discovery** | Yes (a database works) | **Optional but strategic** | Neutrality + composability feed the developer flywheel; not strictly required |
| **Reputation / ratings** | Yes (reviews table) | **Optional** | On-chain makes it portable + verifiable; a DB is fine early |
| **Payments (per-task USDC)** | **No** | **Yes** | Micropayments + machine-native money are *impossible* on card rails |
| **Spending authority (delegation)** | Partly (escrow) | **Yes, for the trust tier** | Bounded, custody-free authority is a genuine differentiator for high-value users |

**So: the registry could be a database; the payment + authority layer should be
crypto.** The blockchain earns its place primarily through **micropayments** and
**machine-native autonomous money**, secondarily through **neutrality** and
**custody-free trust**. That's the honest, defensible answer — not "blockchain
because Web3," but "blockchain because $0.20 autonomous payments don't exist any
other way."

<a name="5-multichain"></a>
## 5. Is it just Ethereum/Base? Multi-chain and the future

**No — it is not tied to one chain.** Today it runs on **Base Sepolia** (Coinbase's
Ethereum L2, testnet). But the entire architecture is **EVM-based**, which means:

- It runs **unchanged on any EVM chain** — Base mainnet, Polygon, Arbitrum,
  Optimism, and others. The contract is plain Solidity (`AgentRegistry.sol`); the
  delegation framework, USDC, and x402 all exist across these chains.
- **USDC is multi-chain.** The same stablecoin exists natively on many chains, so
  "pay an agent in USDC" doesn't bind you to one network.
- The chain choice becomes a **cost/speed/routing decision**, abstracted away from
  the user. A user in the global version never picks a chain — ARIA routes to the
  cheapest/fastest one that has the agent and the user's funds.

**Going global, you'd be multi-chain by default**, and the user would never know.
Long term you could even reach beyond EVM (Solana has its own account model), but
EVM + the ERC-7715/7710 delegation standards are where the tooling and the
account-abstraction maturity are today, so that's the right base.

**Will blockchain be *more* or *less* necessary in the future?** My genuine bet:
**more.** As AI agents multiply and begin transacting autonomously, the need for
machine-native identity, reputation, discovery, and payment *grows* — and those are
exactly blockchain's strengths and exactly card-rail weaknesses. The paradox is
that blockchain becomes simultaneously **more relevant to the machine economy** and
**more invisible to humans** (§22 is how you make it invisible).

<a name="6-blockchain-ai"></a>
## 6. Blockchain + AI — labor vs. economy, and how far this goes

### 6.1 The clean framing

The single sentence to build the whole pitch around:

> **AI is the labor. Blockchain is the economy.**

AI does the work — reason, research, generate. Blockchain is the coordination,
settlement, and trust layer that lets that work be **discovered, hired, paid, and
verified without a trusted middleman.** They are complementary, not competing.

Most "AI + crypto" projects are one bolted onto the other for narrative. ARIA is
one of the rare ones where **both are genuinely load-bearing**: remove the AI and
there's no labor; remove the blockchain and there's no viable micropayment economy
or trust-minimized authority. The Orchestrator (AI) and the registry+delegation
rail (blockchain) are two halves of one machine.

### 6.2 Where they physically meet in this codebase

- **AI decides, blockchain enforces.** The Orchestrator uses Venice to *decide*
  which agent to hire (`hiring-plan.ts:232`), then the blockchain *enforces* the
  bounded payment (`pay-agent.ts`). Judgment is AI; settlement is chain.
- **AI creates demand, blockchain records it.** When the AI can't find an agent for
  a capability, it logs that demand **on-chain** (`requestCapability`), turning a
  fleeting AI decision into a permanent, public market signal developers can act
  on. That's AI *feeding* the blockchain's marketplace.
- **Blockchain proves the AI's work happened.** `recordTaskCompletion` writes an
  on-chain, verifiable record that an agent did a task — reputation that no one can
  fake or erase. The chain is the *memory* of the AI economy.

### 6.3 How to carry this way, way further

The vision escalates in stages, and the primitives for each *already exist* in the
code:

1. **Today: human hires agents.** One user, one goal, a team of agents.
2. **Next: agents hire sub-agents (A2A).** The redelegation chain is *recursive* —
   an agent ARIA hires could itself become an orchestrator and hire its own
   sub-agents, each payment a deeper link in the delegation chain
   (`pay-agent.ts` builds exactly these chains). A "video agent" could autonomously
   hire a "music agent" and a "voice agent," paying each from its slice of the
   budget — with the same bounded, trustless guarantee at every level.
3. **Then: autonomous agent businesses.** Agents that *earn* USDC, *hold* a
   balance, *reinvest* it (hiring other agents to improve themselves), and operate
   without a human owner pressing go. The registry is their identity; their on-chain
   task history is their reputation; x402 is their bank.
4. **The endgame: ARIA as the settlement and trust layer for a machine economy.**
   Not "an app that does tasks," but the **neutral rail every autonomous agent uses
   to find, hire, pay, and trust every other agent.** That's the trillion-dollar
   shape, not the billion-dollar one — and it's a straight-line extension of the
   redelegation, registry, and demand-signal primitives already shipped here.

Other concrete extensions on the path: agent **identity + reputation as a portable
asset** (an agent's track record follows it across platforms); the capability-gap
board as a **futures market for AI capabilities** ("video-gen demanded 47×/week,
nothing serves it — build it and earn from day one"); **staking + insurance** so
users trust unknown agents the way they trust a 4.9-star driver; **cross-platform
agents** that serve many front-ends through one registry.

The point: ARIA isn't a clever demo of AI-with-payments. It's an early instance of
*the economic infrastructure for autonomous software.* Build it like that.

---

# PART III — THE ARCHITECTURE, END TO END

<a name="7-repo"></a>
## 7. The repository, folder by folder

Root: `/home/yusuflawal/DApps/ARIA`. Five subsystems plus documentation.

```
ARIA/
├── contract/          # The on-chain registry (Solidity + Foundry)
├── frontend/          # The Next.js app: site + product + Orchestrator (server)
├── agents/            # Five independent x402 agent microservices
├── subgraph/          # The Graph indexer for the registry
├── CLAUDE.md          # Original full project brief (the "what to build")
├── METAMASK.md        # Captured MetaMask/x402/delegation docs (reference)
├── PROGRESS.md        # Build log
├── HANDOFF.md         # Session handoff notes
├── README.md          # Public-facing readme
└── STYLE.md           # The design system
```

### 7.1 `contract/` — the source of truth on-chain

Foundry project. The one file that matters is `contract/src/AgentRegistry.sol`
(322 lines). `contract/script/Deploy.s.sol` is the keystore-based deploy script.
`contract/broadcast/Deploy.s.sol/84532/run-latest.json` records the latest
deployment — live on Base Sepolia (chain `84532`), latest broadcast address
`0x8715ed9a25bf7a681160120a9e1a76615e39b273`.

> ⚠️ **Verify before any serious demo:** `subgraph/subgraph.yaml:11` indexes
> `0xb025D240e29efE21ba4F973408a82445A9b7f40e`, a *different* address from the
> latest broadcast. So the subgraph is indexing an earlier deployment, or the
> frontend's `NEXT_PUBLIC_REGISTRY_ADDRESS` and the subgraph have drifted. The
> frontend reads the contract directly as a fallback so the app still works, but
> **pin the subgraph, the frontend, and the deployed contract to ONE address** or
> the marketplace page shows stale data.

`contract/out/` is the compiled ABI; `contract/lib/` is Foundry deps; `contract/test/`
the Solidity tests.

### 7.2 `frontend/` — the app *and* the server

A Next.js 16 App Router project doing four jobs at once. (Note `frontend/AGENTS.md`:
this is a newer Next.js than training data assumes — check
`node_modules/next/dist/docs/` before editing framework-level code.)

```
frontend/
├── app/
│   ├── page.tsx                  # Landing page (marketing)
│   ├── app/page.tsx              # The product: prompt + inline execution
│   ├── app/chat/[taskId]/page.tsx# A single task's live/replayed run
│   ├── agents/page.tsx           # Agent marketplace + capability gaps
│   ├── register/page.tsx         # Developer agent-registration flow
│   ├── layout.tsx                # Root layout (fonts, theme)
│   ├── generated/prisma/         # Prisma 7 generated client (committed)
│   └── api/                      # The backend (route handlers)
│       ├── task/route.ts             # POST create task, GET task
│       ├── task/[id]/route.ts        # GET one task (hydrate on revisit)
│       ├── task/[id]/stream/route.ts # SSE stream — and where the Orchestrator starts
│       ├── delegate/route.ts         # Store/read the user's ERC-7715 permission
│       ├── agents/route.ts           # Registry search for the marketplace
│       ├── history/route.ts          # A user's past tasks
│       ├── pinata/route.ts           # IPFS upload proxy (manifest upload)
│       └── balance/route.ts          # Read USDC/ETH of the spending account
├── lib/
│   ├── orchestrator/             # THE BRAIN (see §18)
│   │   ├── index.ts                  # runOrchestrator() entry
│   │   ├── react-loop.ts             # the ReAct loop itself
│   │   ├── plan.ts                   # initial capability planner
│   │   ├── hiring-plan.ts            # semantic agent selection (who to hire)
│   │   ├── pay-agent.ts              # x402 payment + async polling
│   │   ├── venice-fallback.ts        # what ARIA does when no agent fits
│   │   ├── budget.ts                 # spend enforcement
│   │   ├── context-summary.ts        # strips binaries before feeding the model
│   │   ├── manifest-cache.ts         # IPFS manifest cache
│   │   ├── resolve-agents.ts         # agent type + resolution helpers
│   │   └── safe-json-parse.ts        # robust JSON extraction from LLM output
│   ├── delegation.ts             # MetaMask Smart Accounts + 1Shot bundler setup
│   ├── registry.ts               # Contract reads/writes (viem)
│   ├── oneshot.ts                # 1Shot EIP-7710 relayer client
│   ├── venice.ts                 # AI client (all 5 modalities) — the swap point
│   ├── graph.ts                  # The Graph client (with contract fallback)
│   ├── pinata.ts                 # IPFS upload/fetch
│   ├── prisma.ts                 # Neon-adapted Prisma client
│   ├── sse.ts                    # In-memory SSE event bus (globalThis)
│   └── agent-result.ts           # The shared "AgentResult" render-block schema
├── components/
│   ├── task/InlineExecution.tsx  # The live run UI
│   ├── task/AgentResultView.tsx  # Renders AgentResult blocks (tables, media…)
│   ├── wallet/ConnectButton.tsx  # MetaMask connect + ERC-7715 grant
│   ├── app/BalanceTracker.tsx    # Live USDC balance
│   └── ui/…                      # Design-system components
├── prisma/schema.prisma          # Task, AgentCall, UserPermission models
└── hooks/useWalletGuard.ts       # Gate UI on wallet connection
```

**The single most important structural fact:** the Orchestrator is **not** a
separate server. It's a function (`runOrchestrator`) that runs *inside the Next.js
process*, kicked off from **inside the SSE stream route handler**
(`frontend/app/api/task/[id]/stream/route.ts:16-28`). Deep consequences in §18/§21.

### 7.3 `agents/` — the supply side

Five independent services, each its own npm package with its own `Dockerfile`,
`.env`, `tsconfig`. They share only the *shape* of responses (`agent-result.ts` is
copied into each).

```
agents/
├── market-intelligence/   # port 4001 · $0.30 · DexScreener + Venice web search
├── competitive-tech/      # port 4002 · $0.50 · on-chain data + Venice analysis
├── positioning/           # port 4003 · $0.20 · Venice reasoning (strategy)
├── visual-asset/          # port 4004 · $0.40 · Venice image + TTS
└── video-production/      # port 4005 · $0.60 · Venice Seedance video (async)
```

Each is an Express server with **x402 payment middleware** in front of
`POST /execute`. They're deployed *separately from ARIA* — that's the point. Anyone
could write one and register it; ARIA hosts these five as the seed catalogue.

### 7.4 `subgraph/` — fast reads

Standard Graph subgraph. `schema.graphql` defines `Agent`, `CapabilityRequest`,
`PaymentEvent`; `src/agent-registry.ts` maps the registry's events into them;
`subgraph.yaml` binds it to the contract. When deployed, the frontend reads
agents/gaps here; when not, it falls back to reading the contract directly
(`frontend/lib/graph.ts:61`).

### 7.5 The `.md` files

`CLAUDE.md` is the original spec. `METAMASK.md` is captured MetaMask/x402 docs.
`STYLE.md` is the design system (Chakra Petch + Hanken Grotesk, orange `#FF6B35` on
black, the smoke background). `PROGRESS.md`/`HANDOFF.md` are build logs.

<a name="8-flow"></a>
## 8. The end-to-end flow, narrated

The **exact path of the memecoin demo** through every component, with file refs.
This is the spine; everything else hangs off it.

**User types:** *"Launch a memecoin called MOONCAT on Base. Check if the name is
taken, analyse the top 3 cat memecoins, find the best positioning, and generate my
launch banner."* Budget: 10 USDC.

### Step 0 — Connect + grant (one signature, ever)

The user clicks Connect. `ConnectButton.tsx` calls `eth_requestAccounts`, checks
whether their account is a deployed smart account (`:135-141`), then calls
`walletClient.requestExecutionPermissions([...])` with an **`erc20-token-periodic`**
permission: *"the Orchestrator EOA may spend up to 10 USDC per 24h"* (`:195-216`).
MetaMask shows **one** popup. The user approves. The wallet returns `grant.context`
(the signed root delegation) and `grant.from` (the user's smart account). ARIA
stores both via `POST /api/delegate` (`:224-236`). **No USDC has moved — this is a
permission, not a transfer.**

> If the wallet can't do ERC-7715, the grant fails and ARIA stores
> `permissionContext = '0x'` — "preview mode." Then the Orchestrator still reasons
> but **cannot pay**, so agents return 402 and everything falls back to Venice
> text. The diagnostics in `ConnectButton.tsx:29-65` tell you *why* a grant failed.

### Step 1 — Create the task

`POST /api/task` (`app/api/task/route.ts:6`) writes a `Task` row (status `pending`)
and returns a `taskId`. **It does not start the Orchestrator** (`:63-67`).

### Step 2 — The browser opens the stream, which *starts the brain*

The client navigates to `/app/chat/[taskId]` and opens an `EventSource` to
`GET /api/task/[id]/stream`. That handler (`stream/route.ts:30`):
1. Registers the browser as a listener and **replays buffered events** so a late
   tab catches up (`lib/sse.ts:74-85`).
2. Calls `maybeStartOrchestrator(taskId)` (`:16`), guarded by a process-wide `Set`
   so it starts **at most once** across reconnects/tabs.

**Why start it here?** On serverless hosts, work not tied to an open request is
killed once the response is sent. Starting the Orchestrator *inside the open SSE
stream* keeps it alive while the browser is connected. Clever — and the system's
biggest constraint (§21).

### Step 3 — The Orchestrator runs (ReAct loop)

`runOrchestrator` (`lib/orchestrator/index.ts:6`) loads the stored permission,
builds `BudgetTracker(10)`, and calls `runReactLoop` (`react-loop.ts:352`):

- **REASON (plan):** `planInitialCapabilities` (`plan.ts:45`) asks Venice, given
  the registry's real capabilities, what 1–2 things can start *now* with no prior
  data → `["market-intelligence"]`. Creative caps are stripped from the early plan
  (`react-loop.ts:379`) — produced at the end by the deliverables guard.
- **SEARCH + ACT:** `buildHiringPlan` (`hiring-plan.ts:130`) maps tags to
  registered ones (`:24-34`), reads **every active agent's IPFS manifest**
  (`:60-90`), and makes **one Venice call** that picks the best fit **by what each
  agent does, not by tag match** (`:232-262`), with safety nets so a capability
  with a real agent is never dropped (`:372-414`). Round 1: hire Market
  Intelligence.
- **ACT (pay + call):** `executeRound` (`react-loop.ts:116`) runs hires in
  parallel; `callAgentWithX402` (`pay-agent.ts:94`) does the x402 payment (§11/§14).
  USDC moves user → agent; ARIA never touches it. The settlement tx becomes the
  BaseScan link.
- **OBSERVE:** the agent returns a structured `AgentResult` (live DexScreener
  tables + Venice brief — `agents/market-intelligence/src/index.ts:181`). The
  Orchestrator records payment, emits events, calls `recordTaskCompletion`
  on-chain (`react-loop.ts:248-262`).
- **REASON again:** Venice reads findings and decides done-or-what's-missing
  (`react-loop.ts:457-497`). MOONCAT being risky pushes it to add
  `onchain-analytics` — *not in the original plan*. **This non-linear behaviour is
  what makes ARIA ARIA.** It loops: Competitive-Tech (0.50) → Positioning (0.20).
- **Deliverables guard:** checks the user's literal words ("banner" → image) and
  hires the right creative agent at the end, with all findings as context
  (`react-loop.ts:529-557`). This is why the requested banner *always* gets made.
- **SYNTHESIS:** Venice compiles one definitive answer in narrative order, the
  media blocks are appended + de-duplicated, plus a **privacy receipt** (AI calls,
  0 bytes retained, agents paid, gaps logged, total spent) — `react-loop.ts:559-694`.

### Step 4 — The user watches it all live

Every `emit(...)` pushes an SSE event (`lib/sse.ts:53`) to the browser, which
renders the agent plan filling in, the payment ledger with BaseScan links, the
privacy feed, and the final rich result. On revisit, `GET /api/task/[id]` rehydrates
from Postgres (including tx hashes).

<a name="9-keys"></a>
## 9. The four keys — who holds what (and who holds nothing)

There are exactly **four cryptographic identities** in ARIA. The whole security
model is *which* can sign *what*, and *who holds no key at all*. This is the single
most important table in the project.

| # | Identity | Who holds the private key | Holds money? | Can sign? | For |
|---|---|---|---|---|---|
| **1** | **User's wallet** (delegator) | The user, inside MetaMask. **ARIA never sees it.** | ✅ Holds the USDC | ✅ Signs the *one* grant | Root of all authority |
| **2** | **Orchestrator session key** (delegate) | ARIA's server: `ORCHESTRATOR_SESSION_PRIVATE_KEY` | ❌ Holds **nothing** | ✅ Signs re-delegations | "Act on behalf," bounded by key #1 |
| **3** | **Agent owner's wallet** (recipient) | The developer. **Only the address is on the server** | ✅ Receives USDC | ❌ **No private key on the server** | Where earnings land |
| **4** | **Contract deployer / owner** | Whoever deployed the registry (Foundry keystore) | — | ✅ Owns the registry | Authorises which orchestrators may record tasks |

### The two counter-intuitive facts

**Key #2 (the Orchestrator) holds no money:**

```ts
// frontend/lib/delegation.ts:17-27
export const orchestratorEOA = privateKeyToAccount(
  process.env.ORCHESTRATOR_SESSION_PRIVATE_KEY as `0x${string}`
)
export const orchestratorWalletClient = createWalletClient({
  account: orchestratorEOA, chain: baseSepolia, transport: http(process.env.ALCHEMY_RPC_URL),
})
```

If this key leaked, an attacker *still* couldn't steal user funds — they could only
create re-delegations *within grants users already signed*, and those can **only be
redeemed by the MetaMask facilitator** (§11). Money moves user → agent, never
through ARIA.

**Key #3 (the agent) has NO private key on the server** — only a payout *address*:

```ts
// agents/market-intelligence/src/config.ts:9-12
export const payToAddress = (
  process.env.AGENT_MARKET_INTELLIGENCE_PAY_TO ??
  process.env.ORCHESTRATOR_SESSION_ADDRESS!
) as `0x${string}`
```

A developer building an agent never puts a private key on their server — just a
wallet *address* to be paid at. No key-custody burden on developers. Confirmed
across all five agents: their `.env` files contain **zero private keys** — only a
Venice key + public addresses.

### The non-blockchain secrets (a separate trust domain)

These are *credentials*, not *spending authority* — losing one is a normal
incident, not a theft of funds:
- **Buyer side (`frontend`):** `VENICE_API_KEY`, `DATABASE_URL` (Neon, has a
  password), `PINATA_JWT`, `ALCHEMY_RPC_URL` (has a key), `ONE_SHOT_RPC` (public),
  `NEXT_PUBLIC_*` (public config — registry address, USDC address, orchestrator
  *address*).
- **Agent side:** `VENICE_API_KEY`, `ETHERSCAN_API_KEY` (competitive-tech only),
  `METAMASK_FACILITATOR_URL` (public), `ORCHESTRATOR_SESSION_ADDRESS` (public),
  `AGENT_*_PAY_TO` (public).

<a name="10-delegations"></a>
## 10. Delegations — the root grant

### What it *is*

A **delegation** is a signed message: *"I (delegator) authorise you (delegate) to
do a bounded thing on my behalf."* ARIA's root delegation: *"I, the user, authorise
the Orchestrator to spend up to N USDC of mine."* The only thing the user ever
signs. **Not a transfer** — no USDC moves; it's a permission enforced later by the
on-chain `DelegationManager`.

### The code (buyer/frontend, in the user's browser) — ERC-7715

```ts
// frontend/components/wallet/ConnectButton.tsx:170-216 (condensed)
const walletClient = createWalletClient({
  transport: custom(window.ethereum), chain: baseSepolia,
}).extend(erc7715ProviderActions())          // ← adds requestExecutionPermissions

const permissionRequest = {
  chainId: baseSepolia.id,
  expiry,                                     // now + 24h → auto-expires
  to: ORCHESTRATOR_ADDRESS,                   // ← the DELEGATE (key #2's address)
  permission: {
    type: 'erc20-token-periodic',             // ← "spend a token, up to X per period"
    isAdjustmentAllowed: true,
    data: {
      tokenAddress: USDC_ADDRESS,             // ← ONLY USDC
      periodAmount: parseUnits(budgetUsdc.toString(), 6),  // ← the cap, e.g. 10 USDC
      periodDuration: 86400,                  // ← per day
      startTime: currentTime,
      justification: 'ARIA agent task execution budget',
    },
  },
}
const grantedPermissions = await walletClient.requestExecutionPermissions([permissionRequest])
const grant = grantedPermissions[0]
// grant.context = the signed root delegation (hex);  grant.from = user's smart account
```

`grant.context` **is** the signed delegation: delegator, delegate, the USDC cap,
the period, the expiry, the signature. ARIA stores it (`:224-236`) in the
`UserPermission` table (`prisma/schema.prisma:44`) and reads it at the start of
every run (`orchestrator/index.ts:25-33`).

### Where to read to understand it deeply

`ConnectButton.tsx` (the grant + the failure diagnostics, lines 29-65),
`delegation.ts` (accounts + `DelegationManager` address), `prisma/schema.prisma:44`
(storage). The 1Shot path creates a *different* delegation (Orchestrator → relayer)
— §15.

<a name="11-redelegations"></a>
## 11. Re-delegations — paying an agent

### What it *is*

A **re-delegation** is *a delegation created from a delegation you already
received.* You can only pass on authority you hold, and only a subset. To pay an
agent 0.30 USDC, ARIA does **not** spend its own funds (it has none) — it mints a
fresh, smaller, single-use delegation: *"spend exactly 0.30 USDC, and only the
MetaMask facilitator may redeem this,"* referencing the user's root grant as parent.

```
User's smart account ──[root grant: ≤10 USDC/day]──▶ Orchestrator EOA
                                                          │
                       per agent: OPEN RE-DELEGATION  ────┤
                       • exactly 0.30 USDC                │
                       • caveat: only facilitator redeems │
                       • parent = the root grant          ▼
                                                   MetaMask Facilitator → Agent wallet
```

### The code (buyer/ARIA side) — the hardest function in the repo

```ts
// frontend/lib/orchestrator/pay-agent.ts:122-139 (condensed)
const erc7710Client = new x402Erc7710Client({
  delegationProvider: createx402DelegationProvider({
    account: orchestratorEOA,                  // ← SIGNS the re-delegation (= key #2)
    environment: mmEnvironment,
    parentPermissionContext: permissionContext, // ← the user's root grant (§10)
  }),
})
const coreClient = new x402Client().register('eip155:*', erc7710Client)
const fetchWithPayment = wrapFetchWithPayment(fetch, new x402HTTPClient(coreClient))

// ONE call does the whole dance: POST → 402 → mint re-delegation → sign → encode → retry
const response = await fetchWithPayment(endpointUrl, {
  method: 'POST', body: JSON.stringify({ task, context }),
})
```

`createx402DelegationProvider` mints the re-delegation; `wrapFetchWithPayment`
drives the 402 → pay → retry loop. You never hand-build the chain.

### The rule that took a full day to debug

The re-delegation **must** be signed by the **same account named as the root
grant's delegate** — the Orchestrator **EOA**. Get it wrong and the
DelegationManager rejects the chain, the facilitator's `verify()` fails, and the
agent returns an empty `402 {}`:

```ts
// frontend/lib/orchestrator/pay-agent.ts:103-120 (the comment, paraphrased)
// A re-delegation is valid only if:
//   its delegator == the parent delegation's delegate (you can only pass on
//   authority you hold) AND it is signed by that same delegator.
// Both must be the Orchestrator EOA. The old bug passed the USER's address as
// `from` → delegator != signer != parent.delegate → rejected → seller 402 {}.
```

Recorded in memory as `x402-buyer-flow.md`. **If x402 ever returns empty 402s
again, look here first.**

<a name="12-oauth"></a>
## 12. "OAuth" — what it really means here

**There is no literal OAuth in the codebase** — no "Sign in with Google," no OAuth
tokens. But your instinct is correct and it's the bridge to going global.

### ERC-7715 *is* "OAuth for money"

| OAuth (the web you know) | ERC-7715 (what ARIA uses) |
|---|---|
| "Let this app access your Google Drive" | "Let this app spend up to 10 USDC of mine" |
| You approve **once** on a consent screen | You approve **once** in a MetaMask popup |
| App gets a **scoped access token** | App gets a **scoped delegation** (`grant.context`) |
| Token is **bounded** (read-only, this scope) | Delegation is **bounded** (USDC only, ≤10, 24h) |
| You can **revoke** it | You can **revoke / let it expire** |
| App **can't exceed the scope** | App **can't exceed the cap** (enforced on-chain) |

So `requestExecutionPermissions` (`ConnectButton.tsx:216`) is *literally ARIA's
OAuth consent step* — except the resource being granted is *spending authority over
money*, enforced by a smart contract instead of Google's servers.

### Where *real* OAuth comes in for going global

To remove the MetaMask wall (§22), add an **embedded wallet** (Privy, Dynamic,
Coinbase Smart Wallet, Web3Auth). Those let a user sign up with **Google / email /
passkey — actual OAuth** — and silently create a smart account behind it. Then:
- **Front door:** real OAuth (Google login). The user never sees a wallet.
- **Under the hood:** the *same* ERC-7715 grant + ERC-7710 re-delegations you
  already built.

Real OAuth becomes the *human* login; ERC-7715 stays the *money* authorization. You
keep all the §10/§11 code — you just change what triggers it. A connector swap in
`ConnectButton.tsx`, not a rewrite.

<a name="13-smart-wallet"></a>
## 13. MetaMask smart wallet — what it actually is

### EOA vs. smart account

- An **EOA** (externally owned account) is a plain keypair. It can only sign a
  transaction it pays for and submits itself. It *cannot* delegate, batch, or be
  governed by rules.
- A **smart account** is a contract wallet. It *can* sign delegations, enforce
  caveats (caps, allowed targets, expiry), batch calls, and let someone else pay
  its gas. ARIA's trust model **requires** smart accounts — only a smart account
  can issue the bounded grant in §10.

`@metamask/smart-accounts-kit` creates and uses these.

### Both sides use it, differently

**User side** — the wallet *is* the user's MetaMask smart account; ARIA checks it's
deployed before relying on it (`ConnectButton.tsx:135-141`).

**ARIA/server side** — the Orchestrator exists in **two forms**, and this trips
everyone up:

```ts
// frontend/lib/delegation.ts
// FORM A — the EOA. Signs re-delegations for x402 (it's the grant's delegate).
export const orchestratorEOA = privateKeyToAccount(process.env.ORCHESTRATOR_SESSION_PRIVATE_KEY)

// FORM B — the SMART ACCOUNT. Signs ROOT delegations to 1Shot for gasless writes.
export async function getOrchestratorSmartAccount() {        // :46
  _smartAccount = await toMetaMaskSmartAccount({
    client: publicClient, implementation: Implementation.Hybrid,
    deployParams: [orchestratorEOA.address, [], [], []], deploySalt: '0x',
    signer: { account: orchestratorEOA },
  })
  return _smartAccount
}
```

**Remember one thing: EOA pays agents; smart account talks to 1Shot.** Mixing them
up is the source of most delegation bugs here.

### Is MetaMask load-bearing?

**The *smart account* is load-bearing. *MetaMask specifically* is not.** The
delegation framework (ERC-7715/7710) is becoming a cross-wallet standard. Swap
MetaMask for an embedded smart-wallet provider and keep the exact same grant +
re-delegation code. What you can't remove is "the user has a *smart* account
capable of bounded delegation."

<a name="14-x402"></a>
## 14. x402 on BOTH sides — seller code vs. buyer code

x402 is the HTTP payment protocol: a server answers `402 Payment Required` with its
terms; the client attaches a payment proof and retries; a **facilitator** verifies
and settles. Here are both halves, real code.

### 14a. SELLER side — what a developer writes to get paid

**Piece 1 — point at the facilitator, register the scheme:**

```ts
// agents/market-intelligence/src/config.ts:14-23
const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.METAMASK_FACILITATOR_URL ??
       'https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402',
})
export const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK_ID,                                  // 'eip155:84532' (Base Sepolia)
  new x402ExactEvmErc7710ServerScheme()        // ← accept ERC-7710 delegation payments
)
```

**Piece 2 — gate the route with a price (the entire "charge money" part):**

```ts
// agents/market-intelligence/src/index.ts:13-32
app.use(paymentMiddleware({
  'POST /execute': {
    accepts: [{
      scheme: 'exact',
      price: '$0.30',                           // ← what this agent charges
      network: NETWORK_ID,
      payTo: payToAddress,                      // ← key #3: payout ADDRESS (no key)
      extra: { assetTransferMethod: 'erc7710' },// ← "I accept delegation chains"
    }],
    description: 'Market intelligence: live DEX data + competitive landscape',
    mimeType: 'application/json',
  },
}, resourceServer))
```

**Piece 3 — expose the headers** so the buyer reads the challenge + receipt:

```ts
app.use(cors({ exposedHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE'] }))
```

**That's it — ~15 lines and a service earns USDC per call.** No Stripe, no platform
onboarding, no key custody (just a payout address). This is ARIA's supply-side
magic.

> Three of the five agents (visual-asset, video-production, competitive-tech) add a
> **two-phase async** wrinkle: the paid POST *starts* a slow job and returns a
> `jobId`; a free `GET /result/:jobId` is polled — so a long render never holds the
> paid request open long enough to 502. See `agents/video-production/src/index.ts:213-244`
> (poll) and `:272-344` (paid start). The buyer side that drives the poll is
> `frontend/lib/orchestrator/pay-agent.ts:25-61`.

### 14b. BUYER side — what ARIA does to pay

```ts
// frontend/lib/orchestrator/pay-agent.ts:122-163 (the shape)
const fetchWithPayment = wrapFetchWithPayment(fetch,
  new x402HTTPClient(new x402Client().register('eip155:*',
    new x402Erc7710Client({
      delegationProvider: createx402DelegationProvider({
        account: orchestratorEOA,                 // signs the payment authority
        parentPermissionContext: permissionContext, // the user's grant
      }),
    })
  ))
)
const response = await fetchWithPayment(endpointUrl, { method: 'POST', body: JSON.stringify({ task, context }) })

// On success, the settlement tx hash is in the header → BaseScan link:
const settlement = decodePaymentResponseHeader(response.headers.get('X-PAYMENT-RESPONSE'))
const txHash = settlement?.transaction
```

### 14c. The two sides meeting (the full handshake)

```
ARIA (buyer)                         Agent (seller)                    MetaMask Facilitator
─────────────                        ──────────────                    ────────────────────
POST /execute (no payment) ───────▶
                              ◀───── 402 + PAYMENT-REQUIRED
                                     (price, network, payTo, erc7710)
mint re-delegation (§11)
sign with Orchestrator EOA
POST /execute + PAYMENT-SIGNATURE ─▶
                                     middleware hands chain to ───────▶ verify chain
                                                                        settle USDC: user → agent
                              ◀───── 200 + result + PAYMENT-RESPONSE ◀─ tx hash
read txHash → BaseScan link
```

**ARIA never touches the USDC.** It flows user → agent, bounded by the
re-delegation. That's the un-fakeable property.

### Is x402 load-bearing?

The **concept** "per-task machine payment over HTTP" is load-bearing. **x402
specifically** is young but emerging as *the* standard, backed by Coinbase and now
MetaMask — a good bet. The alternative (direct delegation redemption via
`DelegationManager` + a credits ledger) loses the clean HTTP-native developer
experience that is most of x402's value. **Keep x402.**

<a name="15-1shot"></a>
## 15. 1Shot — exactly where, and can it be removed

### What it's for

1Shot is a **gas relayer**. Normally every on-chain write needs ETH for gas. 1Shot
lets ARIA submit an **EIP-7710 delegated transaction**, pays the ETH gas itself,
and charges a small **USDC** fee. Goal: **nobody in ARIA needs ETH.**

### Exactly where it's used (only two places)

1Shot is **not** in the agent payment path (that's x402/facilitator). It's only on
the two **registry writes** during a run:

```ts
// frontend/lib/registry.ts:177-198 — recordTaskCompletion (after each paid agent)
export const recordTaskCompletion = async (agentId) => {
  const data = encodeFunctionData({ abi: REGISTRY_ABI, functionName: 'recordTaskCompletion', args: [agentId] })
  try {
    const { executeVia1Shot7710 } = await import('./oneshot')
    return await executeVia1Shot7710([{ to: REGISTRY_ADDRESS, data, value: '0' }])  // ← gasless path
  } catch {
    return serializeWrite(() => orchestratorWalletClient.writeContract({ ... }))     // ← fallback: pay ETH
  }
}
```

Same pattern wraps `requestCapability` (logging an unmet-demand gap on-chain,
`registry.ts:151-172`).

### How the gasless path works

```ts
// frontend/lib/oneshot.ts:115-216 (the documented 8-step flow)
// 1. relayer_getCapabilities  → relayer target, fee collector, tokens
// 2. relayer_getFeeData       → USDC fee floor
// 3. build bundle: [USDC fee transfer, ...the real registry write]
// 4. create EIP-7710 ROOT delegation: Orchestrator SMART ACCOUNT → 1Shot target  (Form B, §13)
// 5. sign it with the smart account
// 6. relayer_estimate7710Transaction → price-locked context
// 7. relayer_send7710Transaction     → taskId
// 8. relayer_getStatus polled to terminal state
```

### The honest truth (in the code)

On Base Sepolia, `relayer_getCapabilities` returns `{}`, so the gasless bundle
can't be built — and **both writes fall back to the Orchestrator EOA paying ETH
directly** (`registry.ts:159-171, 187-197`). So today: "ARIA uses 1Shot" is **true**
(attempted first), but "nobody needs ETH" is **aspirational** (the reliable path
still spends ETH on these two writes).

### Can it be removed? Yes — it's the least load-bearing piece.

The *concept* "make gas invisible" matters; the *vendor* doesn't. Going global:
a **paymaster** (Pimlico/Biconomy/Coinbase) sponsoring gas inside the task price,
your **own relayer**, or simply absorbing the trivial gas of these two tiny writes.
The agent *payments* don't depend on 1Shot at all — only these two bookkeeping
writes do. **Remove 1Shot tomorrow and the core product is unaffected.**

<a name="16-venice"></a>
## 16. Venice — both sides, swap points, the better way

### Venice does two jobs — separate them

1. **The intelligence** — reasoning, planning, hiring, synthesis, every agent's
   generation. **Fully swappable.**
2. **The privacy guarantee** — zero retention, zero training. **The only
   irreplaceable part, and only because it's the product's promise.**

### Buyer side — how the Orchestrator calls it (the single choke point)

```ts
// frontend/lib/venice.ts:10-24 — the one function everything routes through
async function venicePost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY()}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Venice ${res.status} on ${path}`)
  return res.json()
}
```

All five modalities are thin wrappers: `veniceChat` (:28), `veniceSearch` (:40),
`venciceScrape` (:51), `veniceImage` (:63), `venciceTTS` (:76). The Orchestrator
uses `venice.chat.completions.create` (:94) for planning, hiring, the "what's next"
decision, and synthesis.

### Agent side — OpenAI SDK pointed at Venice

```ts
// agents/market-intelligence/src/index.ts:34-53
const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',     // ← the ONLY Venice-specific line
})
```

### The swap points (your question: "can't I switch to something better?")

**Yes, and the surface area is tiny:**
1. **Buyer side:** `frontend/lib/venice.ts` is *already* the single choke point.
   Rename it `lib/ai.ts`, add a provider switch, and *nothing else in the
   orchestrator changes* — `react-loop.ts`, `plan.ts`, `hiring-plan.ts` all call
   through that one module.
2. **Agent side:** each agent's only Venice-specific line is the `baseURL`. Change
   the base URL + key and an agent runs on any OpenAI-compatible provider.

A clean target — route by *need*, not by vendor:

```ts
// lib/ai.ts (proposed) — provider-agnostic, privacy-aware routing
type Sensitivity = 'private' | 'standard'
async function reason(messages, { sensitivity }: { sensitivity: Sensitivity }) {
  if (sensitivity === 'private') return callVenice(messages)   // zero-retention provider
  return callFrontier(messages)                                // best frontier model (quality)
}
```

### Must it be Venice? Honest verdict

- **Intelligence:** no. For raw planning/synthesis quality, a **frontier model
  (e.g. Claude Opus)** would likely *improve* the orchestrator. The whole stack is
  OpenAI-compatible, so it's a base-URL swap.
- **Privacy:** you need *a* zero-retention provider for sensitive calls. Venice is
  the easiest. The requirement is the *property* ("sensitive work is never
  retained"), not the brand.

**The right design is not "Venice everywhere" — it's a routing layer** that sends
privacy-sensitive calls to a zero-retention provider and quality-sensitive calls to
the best model. Venice was the fast hackathon choice that *also* told a great
privacy story. Keep it for the private path; add a frontier model for quality; hide
both behind `lib/ai.ts`.

### How to use it better even today

1. **Stream synthesis tokens over SSE** so the user watches the answer write itself.
2. **Tier the models** — fast/cheap for routing, strongest for synthesis — instead
   of `llama-3.3-70b` for everything.
3. **Add a fallback provider** so a Venice outage doesn't kill every task.

<a name="17-other-tech"></a>
## 17. Every other technology

### Next.js 16
The framework hosting both the UI and the server route handlers. Doing two
unrelated jobs: serving the site/product, and **hosting the Orchestrator** inside
the SSE route (`stream/route.ts:5-6`, `maxDuration = 300`). Right tool for the MVP;
the Orchestrator must move out for scale (§21).

### The contract — `AgentRegistry.sol`
The on-chain source of truth for *who the agents are*. Stores `Agent` structs
(owner, capabilities[], price, ipfsCID, isActive, tasksCompleted, ratings),
capability→agents indexes, and the **capability demand signal** (`:40-41`). Key
functions: `registerAgent` (`:126`, anyone can list), `getAgentsByCapability`
(`:257`, discovery), `recordTaskCompletion` (`:191`, on-chain proof of work),
`requestCapability` (`:224`, **the demand flywheel** — logs unmet demand),
`getCapabilityGaps` (`:303`). On-chain because discoverability + reputation must be
*permissionless and verifiable* — that's what makes it a marketplace, not ARIA's
private DB. Missing for production: no fee module, no staking/slashing, ratings are
orchestrator-submitted, testnet only — all deliberate MVP scoping.

### The Graph subgraph
Indexes registry events into a fast GraphQL API for the marketplace. Dual-mode: if
`NEXT_PUBLIC_GRAPH_URL` is set, query The Graph; else read the contract directly +
fetch manifests from IPFS (`frontend/lib/graph.ts:61`). Smart resilience. (Pin the
subgraph to the same contract the frontend uses — §7.1.)

### Prisma + Neon
**Neon** = serverless Postgres; **Prisma** = typed ORM. Both because plain Prisma's
long-lived TCP connections die in serverless; the Neon adapter makes it talk over
HTTP/WebSockets (`frontend/lib/prisma.ts`). This is **Prisma 7**; the generated
client lives at `app/generated/prisma/` (committed). Models: `Task` (with
`runInput` for continuation context + `parentTaskId`), `AgentCall` (one row per
hire/fallback — rebuilds the ledger on refresh), `UserPermission` (the stored
ERC-7715 grant). Note: the *AI* retains nothing, but ARIA's own DB holds the
prompt — a separate trust domain you control; be precise about that publicly.

### Pinata / IPFS
Agent **manifests** (rich description, schema, examples, endpoint, pricing) are too
big/rich for on-chain, so they live on IPFS and only the **CID** is stored on-chain.
The hiring planner fetches + caches these because **semantic selection reads the
manifest description** (`hiring-plan.ts` via `manifest-cache.ts`) — IPFS isn't
decoration, it's the data the "intelligent hiring" decision runs on.

### viem
The EVM SDK under `registry.ts`, `delegation.ts`, `oneshot.ts`, `balance/route.ts`:
`readContract` for registry reads, `encodeFunctionData` for calldata, `parseUnits`/
`formatUnits` for USDC's 6 decimals, `getCode` to check smart-account deployment.
The right, current choice.

### SSE (the live nervous system)
One-way server→browser stream. The bus lives on `globalThis` so the Orchestrator
(emitting) and the stream route (listening) share **one** instance
(`lib/sse.ts:48-49`); events are **buffered + replayed** to late clients (`:74-85`)
because the Orchestrator starts the instant the stream opens. **The constraint:
it's in-memory, single-process** — multi-instance scaling needs Redis pub/sub
(§21).

<a name="18-orchestrator"></a>
## 18. The Orchestrator in full

**What it runs on (today):** server-side TypeScript inside the Next.js process,
started from the SSE route (`stream/route.ts:16`). **No separate Orchestrator
server, queue, or worker.** It's a function call living for the duration of one
browser's SSE connection. Its identity is the `ORCHESTRATOR_SESSION_PRIVATE_KEY` EOA.

**The ReAct loop** (`react-loop.ts:352`) — Reason, Act, Observe, repeat — with hard
stops: **6 rounds max**, **5-minute deadline**, **budget exhaustion** (`:366-390`).

1. **Reason (plan):** `planInitialCapabilities` → 1–2 startable capabilities,
   creative ones stripped (`:372-380`).
2. **Per round — Search + Act:** `buildHiringPlan` selects agents semantically;
   `executeRound` runs hires in parallel, then fallbacks (which receive the paid
   agents' findings as context). Coordination is *narrated* via
   `orchestrator_thinking` events so a viewer sees the reasoning (`:404-428`).
3. **Observe + Reason:** Venice decides done-or-what's-missing, conservatively
   (`:447-527`).
4. **Deliverables guard:** guarantees requested creative outputs are produced at
   the end, with full context (`:529-557`).
5. **Synthesis + privacy receipt + media harvest:** one rich `AgentResult` returned
   (`:559-694`).

**How it chooses agents** (your earlier question): **by meaning, not keyword.** It
reads *every active agent's IPFS manifest* and makes one Venice call matching each
need to the agent whose *described behaviour* fits best — even when no tag matches
(`hiring-plan.ts:232-262`). Safety nets ensure a capability with a real agent is
never dropped; a capability with no agent gets a Venice fallback **plus an on-chain
`requestCapability` gap log.**

**How it pays:** `callAgentWithX402` (§11/§14). Parallel within a round, sequential
across rounds. Budget checked before every hire (`:137`).

**How it handles failure:** if an agent errors/times out/offline, `executeRound`
catches it, marks the row failed, and runs a Venice fallback so the user still gets
*something* (`:263-293`). Two-phase async agents (video, visual, competitive-tech)
are polled via a free `/result/:jobId` endpoint so no single request hangs long
enough to 502 (`pay-agent.ts:25-61`).

**The crucial weakness:** because it runs *inside the SSE request*, closing the tab
can **kill the Orchestrator mid-task** — money already spent, no synthesis
delivered. The process-wide `started` Set prevents double-starts but can't
resurrect a killed run. **This is the #1 thing to fix for production (§21/§22).**

<a name="19-agents"></a>
## 19. The agents in full

Each agent is an independent Express service with x402 middleware, returning the
shared **`AgentResult`** shape (`agent-result.ts`): `status`, `agent`, `headline`,
an array of **render blocks** (`markdown`, `table`, `metrics`, `badges`, `links`,
`image`, `audio`, `video`), `summary`, `provenance`. This typed schema is why agent
output renders as rich tables/metrics/media in the same components as the final
answer (`AgentResultView.tsx`), and why synthesis extracts clean prose without ever
feeding base64 to the model (`context-summary.ts`).

- **Market Intelligence** ($0.30) — REASON (which competitors?) → ACT (live
  **DexScreener** data per token + Venice web-search sentiment, in parallel) →
  SYNTHESIZE (a brief grounded in the real numbers). Returns a live competitive
  table + momentum metrics + brief + source links (`src/index.ts:92-207`). Real
  data, not hallucination.
- **Competitive-Tech** ($0.50) — on-chain token data (Base RPC) + Venice analysis:
  holders, concentration, contract checks. Two-phase async.
- **Positioning & Strategy** ($0.20) — pure Venice reasoning over prior findings →
  differentiated positioning + messaging. Cheapest because reasoning-only.
- **Visual Asset** ($0.40) — Venice image (`fluently-xl`) + Venice TTS
  (`tts-kokoro`) → banner + voiced announcement. Two-phase async.
- **Video Production** ($0.60) — the most sophisticated: **two-phase async.** The
  paid `POST /execute` does the fast work (prompt + narration + TTS) and *queues*
  the minutes-long Venice Seedance render, returning a `jobId` immediately
  (`src/index.ts:272-344`). The Orchestrator polls the free `GET /result/:jobId`
  (`:213-244`). The finished video is served by URL with HTTP range support
  (`:178-209`) — never base64, which would corrupt over SSE/DB.

---

# PART IV — THE FUTURE

<a name="20-concept-vs-impl"></a>
## 20. Concept vs. implementation — what's load-bearing

The thing to internalise: **ARIA's value is a set of properties. The vendors are
interchangeable.** Today's stack was the fastest way to prove the mechanism for a
hackathon. The full verdict:

| Property (the real ARIA — keep forever) | Today's tech | Load-bearing? | Swap for going global |
|---|---|---|---|
| Discoverable, verifiable **agent registry** | Solidity on Base Sepolia | **Concept: yes. Base/testnet: no** | Base **mainnet** + multi-chain; optional DB mirror |
| **Grant-once, bounded spending authority** | MetaMask SAK + ERC-7715/7710 | **Delegation framework: YES. MetaMask brand: no** | Embedded smart wallets — *same* delegation code |
| **Per-task machine payment** | x402 + MetaMask facilitator | **Concept: yes. x402: good bet, keep** | Keep x402 (becoming the standard) |
| **Gas/crypto invisible** | 1Shot (falls back to ETH) | **Concept: yes. 1Shot: weakest link** | Paymaster (Pimlico/Biconomy/Coinbase) or own relayer |
| **Privacy / brain** | Venice (everything) | **Privacy property: yes. Venice-everywhere: no** | `lib/ai.ts` router: zero-retention for private, frontier for quality |
| Fast reads | The Graph (+ contract fallback) | No | Keep; or own indexer |
| Agent manifests | IPFS/Pinata | **Decentralization: nice. Pinata: no** | Any storage; IPFS keeps it neutral |
| State | Neon + Prisma | No | Any Postgres |
| Live updates | In-memory SSE bus | **SSE: yes. In-memory: no** | Redis pub/sub for multi-instance |

**Read it as: the left two rows are ARIA. The rest is replaceable plumbing.**
Nothing about the *concept* forces a single vendor — which is exactly why the global
version is achievable without throwing this away. You swap plumbing under a stable
concept; you don't rebuild.

<a name="21-constraints"></a>
## 21. Current constraints — the unflinching list

Ranked by how much they'd hurt at scale:

1. **The Orchestrator is coupled to a browser connection** (`stream/route.ts:16`).
   Close the tab → risk of a killed run with money already spent. **Fix this
   first.** It must become a durable background job the browser merely *observes*.
2. **MetaMask + crypto wallet + testnet USDC is a hard wall.** Caps the market to
   crypto-natives. (Fixable — §22.)
3. **In-memory SSE bus = single process only** (`sse.ts:48`). Horizontal scaling
   breaks event delivery. Needs Redis pub/sub.
4. **Base Sepolia testnet.** No real money/trust/irreversibility. Needs mainnet.
5. **1Shot gasless path doesn't fire on Base Sepolia** — falls back to ETH
   (`registry.ts:159`). "No ETH anywhere" is aspirational right now.
6. **Ratings are orchestrator-submitted** (`AgentRegistry.sol:208`) — a centralised
   trust point. Needs stake-backed / outcome-verified reputation + slashing.
7. **No platform revenue in the contract.** Payment is agent-direct via x402; ARIA
   takes 0%. The take-rate must exist before this is a business.
8. **Single Orchestrator key.** Fine for one process; scale needs key management.
9. **Address drift** between subgraph and deployed contract (§7.1) — operational
   footgun that will bite a demo.
10. **Task content is in Postgres.** The *AI* retains nothing, but ARIA's DB holds
    the prompt — be precise in privacy claims; consider encryption-at-rest.
11. **No payment idempotency/reconciliation.** At money-scale you need exactly-once
    accounting.
12. **Everything is one model (`llama-3.3-70b`).** No cost/latency tiering, no
    fallback if Venice is down.

None are fatal. All are the normal distance between "impressive MVP" and
"production." Naming them is how you close them.

<a name="22-global"></a>
## 22. How ARIA goes global (beyond MetaMask)

The principle: **the valuable thing isn't MetaMask — it's the bounded, trustless,
per-task spending guarantee. Deliver that guarantee through interfaces ordinary
people already use. Keep the cryptographic guarantee; hide every piece of crypto.**

1. **Embedded wallets + social login.** Use Privy/Dynamic/Coinbase Smart Wallet/
   Web3Auth so a user signs up with **email, Google, or a passkey** and a smart
   account is created *invisibly*. No seed phrase, no extension. The same
   ERC-7715/7710 machinery runs underneath — `ConnectButton.tsx` becomes one
   connector among several. **This single change moves the market from
   "crypto-natives" to "anyone with an email."**
2. **Fiat on-ramp + auto-funded USDC.** Card→USDC (Coinbase/Stripe crypto/Transak)
   so a user tops up "$15 of agent credit" with Apple Pay. They think in dollars;
   USDC is plumbing they never see. Add a free first-task budget.
3. **Two tiers sharing one backend:** *Credits (mainstream)* — ARIA custodies a
   USDC float, users buy credits with a card, agents still get paid via x402;
   *Self-custody (pro/crypto)* — the current trustless flow. Identical product,
   different funding source — exactly how Stripe serves "just charge my card" and
   "give me the raw API."
4. **Make gas truly invisible** — finish the relayer or use a paymaster so ARIA
   sponsors gas inside the task price. Users never hear "gas."
5. **Move the Orchestrator to a durable backend** — a queue + worker (+ Redis for
   SSE) so tasks survive tab-closes, scale horizontally, and can run *scheduled* and
   *background* jobs (recurring autonomous tasks are a huge feature).
6. **Multi-chain + multi-token** — don't be Base-only; widen supply and demand.
7. **A mobile app + an ARIA API** — most of the world is mobile-first, and an API
   ("give my app a team of agents") turns ARIA into infrastructure others build on.

The summary: a user should experience *"type a goal, approve a budget with Face ID,
watch a team work, pay with a card."* Underneath, it's still delegations and x402.
*That* is the global product.

<a name="23-roadmap"></a>
## 23. The roadmap to a real company

**Stage 0 — Harden the MVP (weeks).** Fix address drift; move the Orchestrator off
the SSE request into a durable worker; add payment reconciliation; pin the
subgraph; ship streaming synthesis. → A demo that never dies mid-task.

**Stage 1 — Mainstream onboarding (1–2 months).** Embedded wallets + social login +
fiat on-ramp + sponsored gas. → A non-crypto person can complete a task. *Highest
ROI in the whole roadmap.*

**Stage 2 — Real money + take-rate (1–2 months).** Base mainnet, a platform fee in
the payment flow, agent payout dashboards. → ARIA earns per task. Now it's a
business.

**Stage 3 — Supply-side flywheel (ongoing).** One-command agent scaffolding, hosted
agent runtime, the capability-gap board as a "build this, earn $X/week" market (data
already accrues on-chain via `requestCapability`). → Agents grow faster than ARIA
could build them.

**Stage 4 — Reputation + trust (ongoing).** Stake-backed agents, slashing, outcome
ratings, agent insurance. → Users trust unknown agents like a 4.9-star driver.

**Stage 5 — Platform + API + scheduled/recursive agents (ongoing).** Expose ARIA as
infrastructure; add recurring/background autonomous tasks and **agents hiring
sub-agents** (the redelegation chain already supports it — §6.3). → ARIA becomes the
settlement and trust layer other products and *other agents* depend on.

**What makes it worth a billion** is Stage 2 × Stage 3 compounding: a take-rate on a
flywheel-grown supply of agents serving mainstream-onboarded demand. The contract,
registry, demand signal, and payment rail for it **already exist in this repo.**
What's missing is onboarding, durability, and monetisation — all buildable.

<a name="24-belief"></a>
## 24. Do I believe in it?

Yes — as an engineering judgment, not encouragement.

ARIA is built on a real, durable thesis: the number of specialised AI agents is
about to explode, they have no way to find or pay each other, and whoever builds the
*neutral coordination + settlement layer* for them captures a slice of an enormous
and growing flow. That thesis doesn't depend on ARIA being the smartest model in the
room — it depends on ARIA being the *place where agent work gets brokered, trusted,
and paid.* That's a better business than being a model.

And the implementation proves the hard part. The thing most people would call
impossible — "let a server hire and pay arbitrary third-party services on a user's
behalf without ever being able to overspend or touch the funds" — **you actually
built, debugged down to the delegation-signer level, and shipped.** The ReAct loop
genuinely reasons and re-plans non-linearly. The agents return real on-chain data,
not theatre. The privacy story is architecturally true. That is a real engine.

What it is *not yet* is a company. The distance is the wall you named — crypto
onboarding — plus durability and monetisation. None of those require a new idea.
They require the work in §22 and §23. The four keys (§9), the delegation/
re-delegation flow (§10–11), the seller-side x402 (§14a) — the genuinely hard parts
you already got working — **carry over unchanged.** That's the proof the hard part
is done.

And on the blockchain question specifically (§4–6): you're not using a chain for
fashion. You're using it because **$0.20 autonomous machine payments don't exist any
other way**, because a neutral registry can't be deplatformed, and because the
future is agents transacting with agents — for which crypto is the *only* native
money. AI is the labor; blockchain is the economy. ARIA is one of the first products
where both are genuinely load-bearing.

So: build it like you believe it. Move the Orchestrator off the request. Hide the
crypto without removing it. Turn on the take-rate. Feed the developer flywheel
that's already wired into the contract. Let agents start hiring agents. Do those,
and ARIA is not a wrapper and not a demo — it's the coordination layer for the agent
economy, and that is genuinely a billion-dollar thing to be, on the way to something
larger.

I'm in. Let's build the global version.

---

*Single source of truth. For the original spec see `CLAUDE.md`; for the design
system see `STYLE.md`; for delegation/x402 reference see `METAMASK.md`. Every code
reference above points to a real file and line you can open and read.*
