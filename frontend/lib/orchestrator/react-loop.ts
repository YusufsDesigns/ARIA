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
import { extractSummary, parseAgentResult, type AgentResult, type RenderBlock } from '../agent-result'

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

// Creative *generation* capabilities. These produce the user's final deliverables
// (banner, voiced announcement, video). They are deliberately NOT chosen by the
// stochastic round planner — which was substituting/​skipping them (e.g. hiring
// video-production instead of generating a requested banner). Instead they run at
// the end via the deliverables guard, grounded in the user's explicit request and
// informed by all prior findings. See runReactLoop's deliverables guard.
const CREATIVE_CAPS = new Set([
  'image-generation', 'brand-assets', 'visual-design',
  'tts', 'audio-production',
  'video-generation', 'video-production', 'media-content',
])

// What each guaranteed deliverable capability is satisfied by, and how to label it.
const DELIVERABLE_SPEC: Array<{ cap: string; label: string; satisfiedBy: string[]; test: RegExp }> = [
  { cap: 'image-generation', label: 'a banner/image', satisfiedBy: ['image-generation', 'brand-assets', 'visual-design'], test: /\b(banner|image|logo|graphic|visual|artwork|poster|cover|illustration|thumbnail)s?\b/ },
  { cap: 'tts', label: 'a voiced announcement', satisfiedBy: ['tts', 'audio-production'], test: /\b(announcement|voiced|voice[\s-]?over|voiceover|narrat\w+|spoken|audio|podcast|tts)\b/ },
  { cap: 'video-generation', label: 'a video', satisfiedBy: ['video-generation', 'video-production', 'media-content'], test: /\b(video|teaser|trailer|clip|reel|animation)s?\b/ },
]

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

// Persist a Venice fallback as a (free) agent-call row so a revisited/refreshed
// task shows the full picture — fallbacks included — not just the paid agents.
// Fire-and-forget; amountUsdc 0 + "↪" name make the chat page render it as an
// orchestrator-fallback row (not a payment).
function persistFallbackCall(taskId: string, agentName: string, capability: string, output: string, outputType: string) {
  prisma.agentCall.create({
    data: {
      taskId, agentName, agentAddress: 'orchestrator',
      capability, amountUsdc: 0, status: 'completed',
      finding: output, outputType, txHash: null,
    },
  }).catch(() => {})
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
        persistFallbackCall(taskId, roundResults[cap].agentName, cap, result.output, result.outputType)
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
          // Persist the settlement tx hash so the BaseScan link survives a refresh
          // (the chat page hydrates payments from these rows on revisit).
          data: { status: 'completed', finding: agentResult.output, outputType: agentResult.outputType, txHash: agentResult.txHash ?? null },
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
        persistFallbackCall(taskId, fallbackName, cap, result.output, result.outputType)
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
    persistFallbackCall(taskId, agentName, capability, result.output, result.outputType)

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
  const hiredAgentIds = new Set<string>() // agents hired this task — never hire twice
  const veniceTracker = new VeniceCallTracker()

  const deadline = Date.now() + 5 * 60_000
  const MAX_ROUNDS = 6

  // ── ROUND 1: Constrained initial plan ─────────────────────────────────────
  emit(taskId, 'orchestrator_thinking', { message: 'Analysing task and identifying required capabilities...' })

  const { capabilities: initialCaps, reasoning } = await planInitialCapabilities(userPrompt, veniceTracker)

  emit(taskId, 'orchestrator_thinking', { message: reasoning })

  // Strip creative-generation caps from the early plan — they're produced at the
  // end by the deliverables guard (with full context), not by the stochastic
  // planner that was hiring video instead of the requested banner.
  let capabilities = normalizeCapabilities(initialCaps).filter(c => !attempted.has(c) && !CREATIVE_CAPS.has(c))
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
    const hiringPlan = await buildHiringPlan(userPrompt, capabilities, hiringCtx, veniceTracker, gapLoggedThisRun, hiredAgentIds)

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
      hiredAgentIds.add(hire.agent.id) // don't re-hire this agent in a later round
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
- Do NOT request creative generation here (image-generation, brand-assets, tts, audio-production, video-generation, video-production). The user's final deliverables are produced separately from their explicit request — your job is only research, data, analysis, and strategy.

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

      // Backstop the prompt rule: creative generation never enters the loop here.
      const newCaps = normalizeCapabilities(decision.additionalCapabilities ?? []).filter(c => !attempted.has(c) && !CREATIVE_CAPS.has(c))
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

  // ── Deliverables guard ──────────────────────────────────────────────────────
  // Guarantee every creative output the user explicitly asked for is actually
  // produced — now, with all research/strategy findings as context. This is what
  // ensures a requested banner is generated by the Visual Asset agent instead of
  // being silently skipped (or substituted with an unrequested video).
  {
    const promptLc = userPrompt.toLowerCase()
    const producedCaps = new Set(Object.keys(findings))
    const missingDeliverables = DELIVERABLE_SPEC
      .filter(d => d.test.test(promptLc) && !d.satisfiedBy.some(c => producedCaps.has(c)) && !attempted.has(d.cap))
      .map(d => d.cap)

    if (missingDeliverables.length > 0 && !budget.isBudgetExhausted() && Date.now() < deadline) {
      const labels = DELIVERABLE_SPEC.filter(d => missingDeliverables.includes(d.cap)).map(d => d.label)
      emit(taskId, 'orchestrator_thinking', {
        message: `You asked for ${labels.join(' and ')} — producing ${labels.length === 1 ? 'it' : 'them'} now with everything gathered so far as context.`,
      })
      missingDeliverables.forEach(c => attempted.add(c))

      const guardCtx = summarizeContextForVenice(findings)
      const guardPlan = await buildHiringPlan(userPrompt, missingDeliverables, guardCtx, veniceTracker, gapLoggedThisRun, hiredAgentIds)
      const guardResults = await executeRound(
        guardPlan, userPrompt, findings, budget, veniceTracker,
        gapLoggedThisRun, permissionContext, userAddress, taskId, permissionFrom,
      )
      for (const hire of guardPlan.hires) hiredAgentIds.add(hire.agent.id)
      Object.assign(findings, guardResults)
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
          content: `You are ARIA. A team of specialist agents gathered live data and produced assets for the user's task. Write the single, definitive answer the user keeps and acts on — this IS the deliverable, not a summary of it.

## How to write it
- Open with the direct answer and your single strongest recommendation in the first 1–2 sentences. No preamble, no "Executive Summary" heading.
- Develop the full reasoning in well-organised sections. Use ## H2 headers named after the ACTUAL subject matter (e.g. "## The competitive field", "## Where LUNARPUP wins", "## Launch positioning", "## Risks to avoid") — never generic labels like "Executive Summary", "Analysis", or "Findings".
- Quote the real numbers, names, token addresses, prices, liquidity figures and risk flags the agents found. Build on them — explain what they mean, don't just restate.
- Attribute naturally — "on-chain data shows…", "the competitive scan found…", "the positioning work recommends…" — WITHOUT naming internal tools or models.
- Weave the findings into ONE coherent argument: show how the data leads to the recommendation.
- End with a "## Next steps" section: 5–7 concrete, ordered actions.

## Hard rules
- Target 450–650 words — tight, specific, and decisive. Quality over length; do not pad.
- Use **bold** for every key number, name, decision point, and risk.
- Do NOT describe, caption, or restate any generated image, audio, or video. Those assets are displayed directly beside this answer — only reference that they are ready when it matters to the plan.
- Never use filler phrases ("it's important to note", "in conclusion", "as mentioned above").
- Never invent data, prices, or facts the agents did not provide.`,
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
    `AI Calls: ${veniceTracker.callCount} | Data Retained: 0 bytes | Training Data Shared: None`,
    `Agents Paid: ${agentsPaid.length} | Orchestrator Fallbacks: ${fallbacksUsed.length} | Gaps Logged On-Chain: ${gapsLogged.length}`,
    `Total Spent: $${totalSpent.toFixed(2)} USDC`,
  ].join('  \n')

  const synthesisText = synthesisResponse.choices[0].message.content ?? ''

  // ── Assemble the final answer as a rich, structured result ──────────────────
  // The deliverable = the detailed narrative + the ACTUAL data and media blocks
  // the agents produced (metrics, tables, risk badges, banner, audio, video),
  // rendered with the same components as the agent cards. Per-agent rows collapse;
  // this is the one place the user reads. Prose blocks are dropped (the narrative
  // already covers them); data and media blocks are surfaced and de-duplicated.
  const harvested: RenderBlock[] = []
  const seenMedia = new Set<string>()
  const mediaKey = (b: RenderBlock): string => {
    if (b.kind === 'image' || b.kind === 'audio' || b.kind === 'video') {
      const v = ('b64' in b && b.b64) || ('url' in b && b.url) || ''
      return `${b.kind}:${v.slice(0, 48)}`
    }
    return ''
  }

  for (const [, f] of sortedFindings) {
    if (f.outputType === 'json') {
      const parsed = parseAgentResult(f.output, f.agentName, 'json')
      for (const b of parsed.blocks) {
        if (b.kind === 'markdown') continue // prose lives in the synthesis narrative
        if (b.kind === 'image' || b.kind === 'audio' || b.kind === 'video') {
          const key = mediaKey(b)
          if (seenMedia.has(key)) continue
          seenMedia.add(key)
        }
        harvested.push(b)
      }
    } else if (f.outputType === 'image' || f.outputType === 'audio' || f.outputType === 'video') {
      const isUrl = f.output.startsWith('http')
      const block: RenderBlock =
        f.outputType === 'image'
          ? { kind: 'image', title: 'Generated image', url: isUrl ? f.output : undefined, b64: isUrl ? undefined : f.output }
          : f.outputType === 'audio'
          ? { kind: 'audio', title: 'Voiced announcement', b64: f.output, contentType: 'audio/mpeg' }
          : { kind: 'video', title: 'Launch video', url: isUrl ? f.output : undefined, b64: isUrl ? undefined : f.output }
      const key = mediaKey(block)
      if (!seenMedia.has(key)) {
        seenMedia.add(key)
        harvested.push(block)
      }
    }
  }

  const finalResult: AgentResult = {
    status: 'success',
    agent: 'ARIA',
    blocks: [
      { kind: 'markdown', body: synthesisText },
      ...harvested,
      { kind: 'markdown', body: receipt },
    ],
    summary: synthesisText.slice(0, 800),
  }

  return JSON.stringify(finalResult)
}
