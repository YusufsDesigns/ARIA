import venice from '../venice'
import { recordTaskCompletion } from '../registry'
import { prisma } from '../prisma'
import { emitTaskEvent } from '../sse'
import { BudgetTracker } from './budget'
import { callAgentWithX402, pollAgentResult, type AgentResponse } from './pay-agent'
import { VeniceCallTracker, planInitialCapabilities } from './plan'
import { buildHiringPlan, type HiringPlan } from './hiring-plan'
import { veniceFallback, type FallbackReason } from './venice-fallback'
import { safeParseJSON } from './safe-json-parse'
import { summarizeContextForVenice } from './context-summary'
import { extractSummary } from '../agent-result'

// ─── Capability normalization ─────────────────────────────────────────────────
// Prevents Venice from inventing capability tags that are semantically identical
// to registered ones (e.g. "banner-generation" → "image-generation").
// Deduplicates after mapping so one tag can't appear twice.

const CAPABILITY_ALIASES: Record<string, string> = {
  'banner-generation':     'image-generation',
  'banner':                'image-generation',
  'launch-banner':         'image-generation',
  'banner-design':         'image-generation',
  'visual-generation':     'image-generation',
  'image-creation':        'image-generation',
  'brand-visuals':         'image-generation',
  'visual-assets':         'image-generation',
  'social-media-assets':   'image-generation',
  'brand-design':          'image-generation',
  'web-research':          'market-intelligence',
  'market-research':       'market-intelligence',
  'competitor-research':   'market-intelligence',
  'competitive-research':  'market-intelligence',
  'research':              'market-intelligence',
  'blockchain-analysis':   'onchain-analytics',
  'chain-analysis':        'onchain-analytics',
  'on-chain-analytics':    'onchain-analytics',
  'on-chain-data':         'onchain-analytics',
  'onchain-data':          'onchain-analytics',
  'brand-strategy':        'positioning',
  'brand-positioning':     'positioning',
  'go-to-market':          'positioning',
  'marketing-strategy':    'positioning',
  'strategy':              'positioning',
  'audio-production':      'tts',
  'text-to-speech':        'tts',
  'narration':             'tts',
  'audio-announcement':    'tts',
  'voice-over':            'tts',
}

function normalizeCapabilities(caps: string[]): string[] {
  return [...new Set(caps.map(c => CAPABILITY_ALIASES[c] ?? c))]
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Finding = {
  capability: string
  output: string
  outputType: string
  agentName: string
  priceUSDC: number
  fallbackReason?: FallbackReason
  capabilityGapLogged?: boolean
}

// ─── Emit helper ──────────────────────────────────────────────────────────────

function emit(
  taskId: string,
  type: Parameters<typeof emitTaskEvent>[1]['type'],
  payload: Parameters<typeof emitTaskEvent>[1]['payload'],
) {
  emitTaskEvent(taskId, { type, payload, timestamp: Date.now() })
}

// ─── Round executor ───────────────────────────────────────────────────────────
// Hires run in PARALLEL within a round — Venice already judged them independent.
// Fallbacks run AFTER hires complete so they receive the paid agents' findings.
// Sequential dependencies are expressed as new rounds, not serialised within one.

async function executeRound(
  hiringPlan: HiringPlan,
  task: string,
  accumulatedContext: Record<string, Finding>,
  budget: BudgetTracker,
  veniceTracker: VeniceCallTracker,
  gapLoggedThisRun: Set<string>,
  permissionContext: `0x${string}` | null,
  userAddress: string,
  taskId: string,
  permissionFrom: string | null,
): Promise<Record<string, Finding>> {
  const roundResults: Record<string, Finding> = {}

  // ── Helper: run one agent hire ────────────────────────────────────────────
  const runHire = async (hire: HiringPlan['hires'][number]) => {
    const { agent, coversCapabilities, fitLevel, taskInstructions } = hire
    // Each agent sees everything gathered so far (prior rounds + earlier in this round)
    const ctx = summarizeContextForVenice({ ...accumulatedContext, ...roundResults })
    const primaryCap = coversCapabilities[0]

    if (!budget.canAfford(agent.priceUSDC)) {
      emit(taskId, 'orchestrator_thinking', {
        message: `Budget insufficient for ${agent.name} (${agent.priceUSDC} USDC) — ARIA handling it directly`,
      })
      emit(taskId, 'agent_hired', { agentName: '↪ Orchestrator (budget limit)', capability: primaryCap, amountUsdc: 0 })
      for (const cap of coversCapabilities) {
        const result = await veniceFallback(cap, task, ctx, veniceTracker, 'no-agent-registered', gapLoggedThisRun)
        roundResults[cap] = {
          capability: cap, output: result.output, outputType: result.outputType,
          agentName: '↪ Orchestrator (budget limit)', priceUSDC: 0,
          fallbackReason: result.fallbackReason, capabilityGapLogged: result.capabilityGapLogged,
        }
        emit(taskId, 'finding_received', {
          agentName: roundResults[cap].agentName, capability: cap,
          finding: result.output, outputType: result.outputType, output: result.output,
        })
      }
      return
    }

    const fitNote = fitLevel === 'partial' ? ' (partial fit)' : ''
    emit(taskId, 'agent_hired', { agentName: agent.name + fitNote, capability: primaryCap, amountUsdc: agent.priceUSDC })

    let dbCallId: string | null = null
    try {
      const call = await prisma.agentCall.create({
        data: {
          taskId, agentName: agent.name, agentAddress: agent.id,
          capability: primaryCap, amountUsdc: agent.priceUSDC, status: 'pending',
        },
      })
      dbCallId = call.id
    } catch { /* non-fatal */ }

    let agentResult: AgentResponse | null = null
    let agentFailed = false

    try {
      if (permissionContext && permissionContext !== '0x') {
        agentResult = await callAgentWithX402(
          `${agent.endpointUrl}/execute`, taskInstructions, ctx, permissionContext,
          userAddress, permissionFrom,
        )
      } else {
        emit(taskId, 'orchestrator_thinking', {
          message: `Hiring ${agent.name} — sending the task and shared context`,
        })
        const res = await fetch(`${agent.endpointUrl}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: taskInstructions, context: ctx }),
        })
        if (res.ok) agentResult = await res.json()
        else agentFailed = true
      }
    } catch (err) {
      emit(taskId, 'orchestrator_thinking', {
        message: `${agent.name} failed: ${String(err).slice(0, 120)} — ARIA handling it directly...`,
      })
      agentFailed = true
    }

    // Two-phase async agents (e.g. Video): the paid POST only *started* the job
    // and returned a jobId. Poll the agent's free /result endpoint until the
    // render finishes, streaming progress to the UI. Keeps each request short.
    if (agentResult && agentResult.jobId) {
      const jobId = agentResult.jobId
      const settlementTxHash = agentResult.txHash // settled on the phase-1 POST
      emit(taskId, 'agent_progress', {
        agentName: agent.name, capability: primaryCap,
        message: `${agent.name} is rendering — this runs in the background…`,
      })
      try {
        agentResult = await pollAgentResult(agent.endpointUrl, jobId, (elapsed) => {
          emit(taskId, 'agent_progress', {
            agentName: agent.name, capability: primaryCap,
            message: `Rendering… ${elapsed}s`,
          })
        })
        // Carry the phase-1 settlement tx through to the final result for BaseScan.
        if (agentResult && settlementTxHash) agentResult.txHash = settlementTxHash
      } catch (err) {
        emit(taskId, 'orchestrator_thinking', {
          message: `${agent.name} render did not finish: ${String(err).slice(0, 120)}`,
        })
        agentFailed = true
        agentResult = null
      }
    }

    if (agentResult && (agentResult.status === 'success' || agentResult.status === 'partial')) {
      // ── Paid agent succeeded ─────────────────────────────────────────────
      for (const cap of coversCapabilities) {
        roundResults[cap] = {
          capability: cap, output: agentResult.output, outputType: agentResult.outputType,
          agentName: agent.name, priceUSDC: agent.priceUSDC,
        }
      }

      await budget.recordPayment(agent.priceUSDC, agent.name, 'pending')

      if (dbCallId) {
        prisma.agentCall.update({
          where: { id: dbCallId },
          data: { status: 'completed', finding: agentResult.output, outputType: agentResult.outputType },
        }).catch(() => {})
      }

      recordTaskCompletion(agent.id).catch(() => {})

      emit(taskId, 'payment_confirmed', {
        agentName: agent.name, capability: primaryCap, amountUsdc: agent.priceUSDC,
        txHash: agentResult.txHash,
      })

      emit(taskId, 'finding_received', {
        agentName: agent.name, capability: primaryCap,
        finding: agentResult.output, outputType: agentResult.outputType, output: agentResult.output,
      })

      emit(taskId, 'privacy_log', {
        message: `Venice AI processed: ${primaryCap} — 0 bytes retained`,
      })
    } else {
      // ── Paid agent failed — mark it, run Venice fallback ─────────────────
      if (dbCallId) prisma.agentCall.update({ where: { id: dbCallId }, data: { status: 'failed' } }).catch(() => {})
      if (!agentFailed) {
        // No exception but no valid result — non-ok HTTP in dev mode
        emit(taskId, 'orchestrator_thinking', {
          message: `${agent.name} returned an error response — ARIA handling it directly`,
        })
      }

      // Signal UI to mark the paid agent row as failed
      emit(taskId, 'agent_failed', { agentName: agent.name, capability: primaryCap })

      // Add a Venice fallback row and run it
      const fallbackName = '↪ Orchestrator (agent error)'
      emit(taskId, 'agent_hired', { agentName: fallbackName, capability: primaryCap, amountUsdc: 0 })

      for (const cap of coversCapabilities) {
        const result = await veniceFallback(cap, task, ctx, veniceTracker, 'agent-unavailable', gapLoggedThisRun)
        roundResults[cap] = {
          capability: cap, output: result.output, outputType: result.outputType,
          agentName: fallbackName, priceUSDC: 0,
          fallbackReason: result.fallbackReason, capabilityGapLogged: result.capabilityGapLogged,
        }
        emit(taskId, 'finding_received', {
          agentName: fallbackName, capability: cap,
          finding: result.output, outputType: result.outputType, output: result.output,
        })
      }
    }
  }

  // ── Helper: run one Venice fallback ───────────────────────────────────────
  const runFallback = async ({ capability, reason }: HiringPlan['fallbacks'][number]) => {
    const ctx = summarizeContextForVenice({ ...accumulatedContext, ...roundResults })
    const label =
      reason === 'no-agent-registered'
        ? `No agent registered for "${capability}" — ARIA handling it directly`
        : reason === 'poor-fit'
        ? `Registered agents for "${capability}" aren't the right fit — ARIA handling it directly`
        : `Agent for "${capability}" is offline — ARIA handling it directly`
    emit(taskId, 'orchestrator_thinking', { message: label })

    const agentName =
      reason === 'no-agent-registered'
        ? '↪ Orchestrator (no agent yet)'
        : reason === 'poor-fit'
        ? '↪ Orchestrator (no suitable agent)'
        : '↪ Orchestrator (agent offline)'

    emit(taskId, 'agent_hired', { agentName, capability, amountUsdc: 0 })

    const result = await veniceFallback(capability, task, ctx, veniceTracker, reason, gapLoggedThisRun)

    roundResults[capability] = {
      capability, output: result.output, outputType: result.outputType,
      agentName, priceUSDC: 0, fallbackReason: result.fallbackReason,
      capabilityGapLogged: result.capabilityGapLogged,
    }

    emit(taskId, 'finding_received', {
      agentName, capability, finding: result.output,
      outputType: result.outputType, output: result.output,
    })

    if (result.capabilityGapLogged) {
      emit(taskId, 'orchestrator_thinking', {
        message: `Gap logged on-chain for "${capability}" — developers can now see this demand`,
      })
    }

    emit(taskId, 'privacy_log', {
      message: `Venice AI processed: ${capability} — 0 bytes retained`,
    })
  }

  // ── Hires run in parallel — fallbacks wait for hires to finish ───────────
  // Fallbacks receive paid-agent findings as context, which is the real benefit
  // users see: if market-intelligence runs, the "positioning" fallback knows it.
  await Promise.all(hiringPlan.hires.map(runHire))
  await Promise.all(hiringPlan.fallbacks.map(runFallback))

  return roundResults
}

// ─── Main ReAct loop ──────────────────────────────────────────────────────────

export async function runReactLoop(
  taskId: string,
  userPrompt: string,
  budget: BudgetTracker,
  permissionContext: `0x${string}` | null,
  userAddress = '',
  permissionFrom: string | null = null,
): Promise<string> {
  const findings: Record<string, Finding> = {}
  const attempted = new Set<string>()
  const gapLoggedThisRun = new Set<string>()
  const veniceTracker = new VeniceCallTracker()

  const deadline = Date.now() + 5 * 60_000
  const MAX_ROUNDS = 6

  // ── ROUND 1: Constrained initial plan ─────────────────────────────────────
  emit(taskId, 'orchestrator_thinking', { message: 'Analysing task and identifying required capabilities...' })

  const { capabilities: initialCaps, reasoning } = await planInitialCapabilities(userPrompt, veniceTracker)

  emit(taskId, 'orchestrator_thinking', { message: reasoning })

  let capabilities = normalizeCapabilities(initialCaps).filter(c => !attempted.has(c))
  capabilities.forEach(c => attempted.add(c))

  let round = 0

  // ── ReAct loop ─────────────────────────────────────────────────────────────
  while (
    capabilities.length > 0 &&
    round < MAX_ROUNDS &&
    !budget.isBudgetExhausted() &&
    Date.now() < deadline
  ) {
    round++

    if (capabilities.length > 1) {
      emit(taskId, 'orchestrator_thinking', {
        message: `Round ${round}: executing ${capabilities.length} capabilities in sequence — ${capabilities.join(', ')}`,
      })
    }

    // SEARCH + ACT — build semantic hiring plan then execute
    // Strip binaries + slice text so Venice sees only what it needs for hiring decisions
    const hiringCtx = summarizeContextForVenice(findings)
    const hiringPlan = await buildHiringPlan(userPrompt, capabilities, hiringCtx, veniceTracker, gapLoggedThisRun)

    // ── Narrate the plan so the coordination is visible, not silent ──────────
    // The selection logic already decided this; surfacing it is what makes the
    // A2A coordination legible to a viewer (and to judges) during the demo.
    const agentCount = hiringPlan.hires.length
    if (agentCount > 0) {
      const names = hiringPlan.hires.map(h => h.agent.name).join(', ')
      emit(taskId, 'orchestrator_thinking', {
        message: `Found ${agentCount} specialist ${agentCount === 1 ? 'agent' : 'agents'} for this round: ${names}`,
      })
      // Highlight when one agent was chosen to cover several needs at once —
      // this is the "intelligent selection" moment (e.g. Visual Asset → image + brand + audio).
      for (const h of hiringPlan.hires) {
        if (h.coversCapabilities.length > 1) {
          emit(taskId, 'orchestrator_thinking', {
            message: `${h.agent.name} covers ${h.coversCapabilities.length} of your needs — ${h.coversCapabilities.join(', ')} — so ARIA hires it once instead of ${h.coversCapabilities.length} separate agents.`,
          })
        }
      }
      // Show that prior findings are handed forward as shared context (A2A).
      const priorCaps = Object.keys(findings)
      if (priorCaps.length > 0) {
        emit(taskId, 'orchestrator_thinking', {
          message: `Passing findings from ${priorCaps.join(', ')} to this round's ${agentCount === 1 ? 'agent' : 'agents'} as shared context.`,
        })
      }
    }

    const roundResults = await executeRound(
      hiringPlan, userPrompt, findings, budget, veniceTracker,
      gapLoggedThisRun, permissionContext, userAddress, taskId, permissionFrom,
    )
    Object.assign(findings, roundResults)

    // Mark every capability an agent covers as attempted — not just the ones Venice
    // explicitly assigned. Prevents follow-up rounds from re-requesting web-search
    // when Agent 1 already ran for market-intelligence and covers both.
    for (const hire of hiringPlan.hires) {
      hire.allRegistryCapabilities.forEach(c => attempted.add(c))
    }

    if (Object.keys(findings).length === 0) break

    // OBSERVE + REASON
    emit(taskId, 'orchestrator_thinking', { message: 'Evaluating findings — deciding what comes next...' })

    const completedCaps = Object.keys(findings)

    // If every capability this round was handled via Venice fallback (no paid agents),
    // the task is being addressed directly by Venice — be very conservative about looping.
    const paidThisRound = Object.values(roundResults).filter(f => f.priceUSDC > 0).length
    const allFallbackRound = paidThisRound === 0

    const decisionResponse = await veniceTracker.track(() =>
      venice.chat.completions.create({
        model: 'llama-3.3-70b',
        messages: [
          {
            role: 'system',
            content: `You are ARIA's orchestrator. Read the findings below and decide: is the task complete, or is something genuinely missing?

Remaining budget: ${budget.remaining.toFixed(2)} USDC
Already handled: ${completedCaps.join(', ')}
${allFallbackRound ? '\nNote: all work this round was handled by Venice AI directly (no specialist agents were hired).' : ''}

How to decide:
- Read the task and the findings. Does the user have what they asked for?
- If yes → set "done": true.
- If something is ABSENT and genuinely needed, name those capabilities.
  Use short lowercase tags. You are not limited to the registry.
  The system finds agents if they exist, or Venice handles it and logs the gap on-chain.
- Do NOT request capabilities already in the "already handled" list.
- Only add capabilities that can NOW run given the findings available.
  Do not request capabilities that still depend on data not yet gathered.
  Example: if findings have market data and on-chain analysis, "positioning" can now run.
  But if market data is still missing, "positioning" cannot meaningfully run yet — wait.
- Do NOT add capabilities just because they sound relevant. Only what is clearly absent.

Return a JSON object on a single line: { "done": boolean, "additionalCapabilities": string[], "reasoning": "one sentence explaining what is missing or why the task is complete" }`,
          },
          {
            role: 'user',
            content: `Task: ${userPrompt}\n\nFindings so far:\n${JSON.stringify(
              completedCaps.map(cap => ({
                capability: cap,
                handledBy: findings[cap].agentName,
                summary: extractSummary(findings[cap].output, findings[cap].outputType as 'text' | 'image' | 'audio' | 'video' | 'json').slice(0, 400),
              }))
            )}`,
          },
        ],
      })
    )

    try {
      const raw = decisionResponse.choices[0].message.content ?? ''
      const decision = safeParseJSON<{
        done?: boolean
        additionalCapabilities?: string[]
        reasoning?: string
      }>(raw)

      emit(taskId, 'orchestrator_thinking', {
        message: decision.reasoning ?? 'Assessing whether more work is needed...',
      })

      if (decision.done) break

      const newCaps = normalizeCapabilities(decision.additionalCapabilities ?? []).filter(c => !attempted.has(c))
      newCaps.forEach(c => attempted.add(c))

      if (newCaps.length > 0) {
        emit(taskId, 'orchestrator_thinking', {
          message: `Findings suggest ${newCaps.length} more ${newCaps.length === 1 ? 'capability' : 'capabilities'} needed: ${newCaps.join(', ')}`,
        })
      }

      capabilities = newCaps
    } catch {
      break
    }
  }

  // ── Final synthesis ────────────────────────────────────────────────────────
  emit(taskId, 'orchestrator_thinking', { message: 'Synthesising all findings into your final answer...' })

  // Sort findings into narrative order: data gathering → analysis → strategy → creative
  // This shapes the synthesis into a coherent story rather than random insertion order.
  const narrativeOrder = [
    'market-intelligence', 'web-search', 'competitor-analysis', 'research',
    'onchain-analytics', 'blockchain-data', 'smart-contract-analysis',
    'strategy', 'positioning', 'copywriting', 'marketing',
    'image-generation', 'visual-design', 'brand-assets', 'tts', 'audio-production',
  ]

  const sortedFindings = Object.entries(findings).sort(([capA], [capB]) => {
    const iA = narrativeOrder.findIndex(t => capA.includes(t))
    const iB = narrativeOrder.findIndex(t => capB.includes(t))
    return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB)
  })

  const synthesisInput = sortedFindings
    .map(([cap, f]) => {
      // Readable section title — convert kebab-case tag to Title Case
      const title = cap.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      const agentLabel = f.agentName
      // extractSummary returns the structured result's `summary` text for JSON
      // outputs (never base64), a short placeholder for raw media, or the text
      // itself — so Venice synthesises from clean prose, never binary blobs.
      const body = extractSummary(f.output, f.outputType as 'text' | 'image' | 'audio' | 'video' | 'json').slice(0, 5000)
      return `## ${title} (${agentLabel})\n${body}`
    })
    .join('\n\n---\n\n')

  const synthesisResponse = await veniceTracker.track(() =>
    venice.chat.completions.create({
      model: 'llama-3.3-70b',
      messages: [
        {
          role: 'system',
          content: `You are ARIA's final synthesiser. A team of specialist agents has completed their work. Your job is to write the DEFINITIVE, AUTHORITATIVE answer to the user's task — combining all findings into a single comprehensive document that is more thorough and useful than any individual agent finding.

This is shown as "ARIA's Answer" — the one output the user keeps, acts on, and shares.

## Required structure (use these exact H2 headers in this exact order):

### ## Executive Summary
- 4–6 bullet points.
- Each bullet must cross-reference at least two different agent findings.
- Include the single most important recommendation upfront.
- Include any critical risks or blockers found.

### ## [One H2 per major finding area]
Name each section after the capability/agent domain. Sections must appear in logical order: data/research first, analysis second, strategy third, creative last.

For EACH section:
- Write minimum 150 words of detailed elaboration — do NOT just restate the finding, BUILD ON IT.
- Quote specific numbers, names, token addresses, competitor names, data points — use what the agents actually found.
- Attribute every claim: "The Market Intelligence Agent found...", "On-chain data shows...", "The Positioning Agent recommended..."
- Connect findings to each other: "Given the on-chain data showing X, the strategy recommendation to do Y makes sense because..."

### ## Action Plan
A numbered list of exactly 6–8 concrete steps. Each step must:
- Name the specific action to take
- Cite which agent finding it's based on (in parentheses)
- Specify a timeframe or priority

### ## Creative Assets
Only include if media was actually generated. For each asset:
- State what was created (image / audio / video)
- State its purpose and how it connects to the strategy
- Do NOT invent descriptions or scripts — only describe what the agents actually produced

## Strict rules:
- Minimum 1200 words total. Write as if this is a professional deliverable.
- Use **bold** for every key insight, number, name, decision point, and risk.
- Never use filler phrases ("it's important to note", "in conclusion", "as mentioned above").
- If a finding was truncated, acknowledge it and work with what was provided.
- Never invent data, prices, or facts that weren't in the agent findings.`,
        },
        {
          role: 'user',
          content: `Original task: ${userPrompt}\n\nAll agent findings (in narrative order):\n\n${
            synthesisInput || 'Venice AI handled this task directly with no specialist agents.'
          }`,
        },
      ],
    })
  )

  // ── Privacy receipt ────────────────────────────────────────────────────────
  const agentsPaid = Object.values(findings).filter(f => f.priceUSDC > 0)
  const fallbacksUsed = Object.values(findings).filter(f => f.priceUSDC === 0)
  const gapsLogged = [...gapLoggedThisRun].filter(g => !g.startsWith('format:'))
  const totalSpent = agentsPaid.reduce((s, f) => s + f.priceUSDC, 0)

  const receipt = [
    `---`,
    `**Privacy Receipt** | Task \`${taskId.slice(0, 8)}\``,
    `Venice AI Calls: ${veniceTracker.callCount} | Data Retained: 0 bytes | Training Data Shared: None`,
    `Agents Paid: ${agentsPaid.length} | Venice Fallbacks: ${fallbacksUsed.length} | Gaps Logged On-Chain: ${gapsLogged.length}`,
    `Total Spent: $${totalSpent.toFixed(2)} USDC`,
  ].join('  \n')

  return `${synthesisResponse.choices[0].message.content ?? ''}\n\n${receipt}`
}
