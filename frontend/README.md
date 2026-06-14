# ARIA — Frontend & Orchestrator

The Next.js application that powers ARIA: the marketing pages, the agent marketplace, the registration flow, and — most importantly — **the Orchestrator**, the server-side ReAct brain that hires, pays, and coordinates agents.

> See the [root README](../README.md) for the big picture. This document covers the app itself.

---

## What lives here

This is two things in one Next.js project:

1. **The product UI** — landing page, `/agents` marketplace, `/register`, and the `/app` task flow.
2. **The Orchestrator** — `lib/orchestrator/`, run from inside the API routes. It reasons with Venice AI, searches the on-chain registry, selects and pays agents via x402, and streams everything to the browser over SSE.

## Tech

| Concern | Tool |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| AI | Venice AI via the OpenAI SDK (`lib/venice.ts`) |
| Wallet / permissions | MetaMask Smart Accounts Kit (ERC-7715 / ERC-7710) |
| Payments | `@metamask/x402` + `@x402/*` (buyer flow), MetaMask facilitator |
| Gas relay | 1Shot (EIP-7710), `lib/oneshot.ts` |
| Chain access | viem (`lib/registry.ts`, `lib/delegation.ts`) |
| Indexing | The Graph via Apollo Client, with viem contract-read fallback (`lib/graph.ts`) |
| Database | Prisma 7 + Neon serverless Postgres (`lib/prisma.ts`) |
| IPFS | Pinata (`lib/pinata.ts`) |
| Live updates | Server-Sent Events (`lib/sse.ts`) |

## Page flow

```
/                     Landing (marketing, smoke background)
/agents               Marketplace — registered agents + capability gaps (The Graph / contract)
/register             Register an agent (IPFS manifest → on-chain)
/app                  New task: connect wallet (one ERC-7715 signature), set budget, prompt → redirect
/app/chat/[taskId]    Live execution: orchestrator thinking, agent plan, x402 payments (BaseScan),
                      structured findings, final synthesis, and "continue this task" follow-ups
```

`/app` creates the task and redirects; the **orchestrator is started by the SSE stream** on the chat page (see "Why the orchestrator runs in the stream").

## Directory map

```
app/
  page.tsx                      Landing
  agents/page.tsx               Marketplace + capability gaps
  register/page.tsx             Agent registration wizard
  app/
    layout.tsx                  Sidebar (history) + nav + wallet context
    page.tsx                    New-task screen
    chat/[taskId]/page.tsx      Execution view (live SSE or DB-hydrated on revisit)
  api/
    task/route.ts               POST: create task (stores runInput + budget) · GET: by query
    task/[id]/route.ts          GET: load a task (+ agent calls) for the chat page
    task/[id]/stream/route.ts   GET: SSE — starts & streams the orchestrator
    history/route.ts            GET: wallet-scoped task history
    delegate/route.ts           POST/GET: store & read the user's ERC-7715 permission context
    agents/route.ts             GET: registry search by capability

lib/
  orchestrator/
    index.ts                    Entry point (runOrchestrator)
    react-loop.ts               The ReAct loop: rounds, hiring, execution, deliverables guard, synthesis
    hiring-plan.ts              Semantic agent selection over the full active-agent pool (+ caching)
    plan.ts                     Initial capability planning + Venice call tracker
    pay-agent.ts                x402 + ERC-7710 buyer flow; async-agent polling
    budget.ts                   Per-task budget tracking
    venice-fallback.ts          Modality-aware Venice fallback when no agent fits
    context-summary.ts          Strips binaries / forwards summaries between agents
    safe-json-parse.ts          Tolerant JSON parsing of model output
  agent-result.ts               Structured AgentResult render contract (metrics/table/badges/media)
  venice.ts  registry.ts  delegation.ts  oneshot.ts  graph.ts  pinata.ts  prisma.ts  sse.ts

components/
  task/InlineExecution.tsx      The live/hydrated execution renderer
  task/AgentResultView.tsx      Rich block renderer (metrics, tables, badges, image/audio/video)
  app/*                         Sidebar, history, wallet context, continuation input, wallet wall
  wallet/ConnectButton.tsx      MetaMask connect + ERC-7715 permission request
```

## The ReAct loop (lib/orchestrator/react-loop.ts)

```
plan initial capabilities (Venice, registry-grounded; creative deliverables deferred)
└─ while capabilities remain & budget & time:
   ├─ buildHiringPlan: semantic selection over ALL active agents (by description, not tags);
   │                   excludes agents already hired this task; hires only this round's needs
   ├─ executeRound:    paid hires in parallel (x402) → structured findings;
   │                   any miss/failure falls back to Venice (and is persisted)
   ├─ OBSERVE+REASON:  what's genuinely missing next?
   └─ carry findings forward as shared context
deliverables guard:   guarantee explicitly-requested outputs (banner / announcement / video)
final synthesis:       one authoritative answer (structured) + privacy receipt
```

Key guarantees: **each agent runs at most once per task**, **context flows forward** between agents, and **every needed capability is either hired or falls back** (never silently dropped).

## Why the orchestrator runs in the stream

A task takes minutes (Venice calls, agent work, synthesis). Fire-and-forget background work is killed on hosts that suspend after the HTTP response. So:

- `POST /api/task` only **creates** the task (saving `runInput` + `budgetUsdc`).
- `GET /api/task/[id]/stream` (SSE) **starts** the orchestrator on first connect (guarded against double-starts) and streams its events.

This ties execution to a live connection on a **persistent process**, so it runs to completion. The SSE event bus (`lib/sse.ts`) lives on `globalThis` and **buffers + replays** events, so a late-joining or reconnecting client catches up — which requires a **single instance**.

## Local development

```bash
npm install
npx prisma generate
npx prisma db push          # syncs schema to Neon
npm run dev                 # http://localhost:3000
```

Requires a filled `.env` (see [root README](../README.md#environment-variables)) and the five agents reachable (run `agents/start-all.sh` locally or use the deployed Railway URLs).

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | `prisma generate && next build` |
| `npm start` | `next start` (binds to `$PORT`) |
| `npm run lint` | ESLint |

## Deploying (Railway)

> ⚠️ **Do not deploy on serverless (Vercel).** The orchestrator runs for minutes inside the SSE connection; serverless functions time out and the run freezes mid-task. Use a persistent host.

1. New Railway service in your project, **root directory = `frontend/`**.
2. **Instances = 1** (the SSE bus + start-guard are in-process).
3. Build `npm run build`, start `npm start`.
4. Set all env vars **before the build** (`NEXT_PUBLIC_*` are inlined at build time).
5. Same Neon DB and the Railway agent URLs.

## Notes

- **Identity = wallet address.** No signup. The connected MetaMask address is the user id; switching accounts switches history.
- **One signature.** The only thing the user signs is the ERC-7715 spending permission; agent payments are redelegations the orchestrator signs server-side.
- **Revisiting a task** hydrates the agent plan, payments, and final answer from the DB (fallbacks included); a live task streams via SSE.
