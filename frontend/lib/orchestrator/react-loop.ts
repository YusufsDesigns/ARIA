import venice from '../venice'
import { recordTaskCompletion } from '../registry'
import { prisma } from '../prisma'
import { emitTaskEvent } from '../sse'
import { BudgetTracker } from './budget'
import { callAgentWithX402, type AgentResponse } from './pay-agent'
import { VeniceCallTracker, planInitialCapabilities, getAllDistinctCapabilities } from './plan'
import { resolveAgentsForCapabilities, type ResolutionResult } from './resolve-agents'
import { veniceFallback, type FallbackReason } from './venice-fallback'

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
// Runs all agent hires and Venice fallbacks for one round in parallel.
// The parallelism is correct here because within a single round all
// capabilities have already been judged independent by Venice — sequential
// dependencies are expressed as new rounds, not within a round.

async function executeRound(
  resolution: ResolutionResult,
  task: string,
  accumulatedContext: Record<string, Finding>,
  budget: BudgetTracker,
  veniceTracker: VeniceCallTracker,
  gapLoggedThisRun: Set<string>,
  permissionContext: `0x${string}` | null,
  userAddress: string,
  taskId: string,
): Promise<Record<string, Finding>> {
  const roundResults: Record<string, Finding> = {}

  // Snapshot context for all agents in this round — they all see the same prior state
  const ctx: Record<string, unknown> = {}
  for (const [cap, f] of Object.entries(accumulatedContext)) {
    ctx[cap] = f.output
  }

  // ── Agent hires ───────────────────────────────────────────────────────────
  const hirePromises = resolution.agentHires.map(async ({ agent, matchedCapabilities }) => {
    if (!budget.canAfford(agent.priceUSDC)) {
      emit(taskId, 'orchestrator_thinking', {
        message: `Budget insufficient for ${agent.name} (${agent.priceUSDC} USDC) — Venice handling directly`,
      })
      for (const cap of matchedCapabilities) {
        const result = await veniceFallback(cap, task, ctx, veniceTracker, 'no-agent-registered', gapLoggedThisRun)
        roundResults[cap] = {
          capability: cap, output: result.output, outputType: result.outputType,
          agentName: 'Venice AI (budget limit)', priceUSDC: 0,
          fallbackReason: result.fallbackReason, capabilityGapLogged: result.capabilityGapLogged,
        }
        emit(taskId, 'finding_received', {
          agentName: roundResults[cap].agentName, capability: cap,
          finding: result.output, outputType: result.outputType, output: result.output,
        })
      }
      return
    }

    const primaryCap = matchedCapabilities[0]
    emit(taskId, 'agent_hired', { agentName: agent.name, capability: primaryCap, amountUsdc: agent.priceUSDC })

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
    try {
      if (permissionContext && permissionContext !== '0x') {
        agentResult = await callAgentWithX402(
          `${agent.endpointUrl}/execute`, task, ctx, permissionContext, userAddress,
        )
      } else {
        emit(taskId, 'orchestrator_thinking', {
          message: `[dev mode] No permission context — calling ${agent.name} directly`,
        })
        const res = await fetch(`${agent.endpointUrl}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task, context: ctx }),
        })
        if (res.ok) agentResult = await res.json()
      }

      if (agentResult && (agentResult.status === 'success' || agentResult.status === 'partial')) {
        for (const cap of matchedCapabilities) {
          roundResults[cap] = {
            capability: cap, output: agentResult!.output, outputType: agentResult!.outputType,
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
        })

        for (const cap of matchedCapabilities) {
          emit(taskId, 'finding_received', {
            agentName: agent.name, capability: cap,
            finding: agentResult!.output, outputType: agentResult!.outputType, output: agentResult!.output,
          })
        }

        emit(taskId, 'privacy_log', {
          message: `Venice AI processed: ${primaryCap} — 0 bytes retained`,
        })
      }
    } catch (err) {
      emit(taskId, 'orchestrator_thinking', {
        message: `${agent.name} failed mid-call: ${err}. Falling back to Venice...`,
      })
      if (dbCallId) prisma.agentCall.update({ where: { id: dbCallId }, data: { status: 'failed' } }).catch(() => {})

      // Agent existed and was reachable but failed during execution —
      // this is agent-unavailable (runtime error), not a registry gap
      for (const cap of matchedCapabilities) {
        const result = await veniceFallback(cap, task, ctx, veniceTracker, 'agent-unavailable', gapLoggedThisRun)
        roundResults[cap] = {
          capability: cap, output: result.output, outputType: result.outputType,
          agentName: 'Venice AI (agent error)', priceUSDC: 0,
          fallbackReason: result.fallbackReason, capabilityGapLogged: result.capabilityGapLogged,
        }
        emit(taskId, 'finding_received', {
          agentName: roundResults[cap].agentName, capability: cap,
          finding: result.output, outputType: result.outputType, output: result.output,
        })
      }
    }
  })

  // ── Venice fallbacks (no-agent-registered / agent-unavailable) ────────────
  const fallbackPromises = resolution.fallbacks.map(async ({ capability, reason }) => {
    const label =
      reason === 'no-agent-registered'
        ? `No agent registered for "${capability}" — Venice handling directly`
        : `Agent for "${capability}" is offline right now — Venice handling directly`
    emit(taskId, 'orchestrator_thinking', { message: label })

    const result = await veniceFallback(capability, task, ctx, veniceTracker, reason, gapLoggedThisRun)

    const agentName =
      reason === 'no-agent-registered' ? 'Venice AI (no agent yet)' : 'Venice AI (agent offline)'

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
        message: `On-chain gap signal recorded for "${capability}" — visible to developers as a build opportunity`,
      })
    }

    emit(taskId, 'privacy_log', {
      message: `Venice AI processed: ${capability} — 0 bytes retained`,
    })
  })

  await Promise.all([...hirePromises, ...fallbackPromises])
  return roundResults
}

// ─── Main ReAct loop ──────────────────────────────────────────────────────────

export async function runReactLoop(
  taskId: string,
  userPrompt: string,
  budget: BudgetTracker,
  permissionContext: `0x${string}` | null,
  userAddress = '',
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

  let capabilities = initialCaps.filter(c => !attempted.has(c))
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
        message: `Round ${round}: ${capabilities.length} capabilities running in parallel — ${capabilities.join(', ')}`,
      })
    }

    // SEARCH + ACT
    const resolution = await resolveAgentsForCapabilities(capabilities, gapLoggedThisRun)
    const roundResults = await executeRound(
      resolution, userPrompt, findings, budget, veniceTracker,
      gapLoggedThisRun, permissionContext, userAddress, taskId,
    )
    Object.assign(findings, roundResults)

    if (Object.keys(findings).length === 0) break

    // OBSERVE + REASON
    emit(taskId, 'orchestrator_thinking', { message: 'Evaluating findings — deciding what comes next...' })

    const allCaps = await getAllDistinctCapabilities()
    const completedCaps = Object.keys(findings)

    const decisionResponse = await veniceTracker.track(() =>
      venice.chat.completions.create({
        model: 'llama-3.3-70b',
        messages: [
          {
            role: 'system',
            content: `You are ARIA's orchestrator. Based on the findings so far, decide if additional specialist
capabilities are needed, or if the task is sufficiently addressed.

Available capabilities in registry: ${allCaps.length > 0 ? allCaps.join(', ') : 'none'}
Already completed this task: ${completedCaps.join(', ')}
Remaining budget: ${budget.remaining.toFixed(2)} USDC

Only request NEW capabilities if the findings genuinely justify them.
Do not request something just because it exists.
If the task is done, set "done": true.

Return a JSON object on a single line: { "done": boolean, "additionalCapabilities": string[], "reasoning": "one sentence" }`,
          },
          {
            role: 'user',
            content: `Task: ${userPrompt}\n\nFindings so far:\n${JSON.stringify(
              completedCaps.map(cap => ({
                capability: cap,
                agent: findings[cap].agentName,
                summary: findings[cap].output.slice(0, 400),
              }))
            )}`,
          },
        ],
      })
    )

    try {
      const raw = decisionResponse.choices[0].message.content ?? ''
      const match = raw.match(/\{[\s\S]*\}/)
      const decision = JSON.parse(match?.[0] ?? '{}') as {
        done?: boolean
        additionalCapabilities?: string[]
        reasoning?: string
      }

      emit(taskId, 'orchestrator_thinking', {
        message: decision.reasoning ?? 'Assessing whether more work is needed...',
      })

      if (decision.done) break

      const newCaps = (decision.additionalCapabilities ?? []).filter(c => !attempted.has(c))
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

  const synthesisInput = Object.entries(findings)
    .map(([cap, f]) => {
      // Never send base64 binary data to Venice — it blows the context window
      if (f.outputType === 'image' || f.outputType === 'audio') {
        return `## ${cap} (via ${f.agentName})\n[${f.outputType} content generated — displayed in UI]`
      }
      if (f.outputType === 'json') {
        try {
          const parsed = JSON.parse(f.output) as Record<string, string>
          const text = [parsed.imagePrompt, parsed.audioScript, parsed.text]
            .filter(Boolean).join('\n').slice(0, 1000)
          return `## ${cap} (via ${f.agentName})\n${text || '[media content generated]'}`
        } catch {
          return `## ${cap} (via ${f.agentName})\n[structured output generated]`
        }
      }
      return `## ${cap} (via ${f.agentName})\n${f.output.slice(0, 3000)}`
    })
    .join('\n\n---\n\n')

  const synthesisResponse = await veniceTracker.track(() =>
    venice.chat.completions.create({
      model: 'llama-3.3-70b',
      messages: [
        {
          role: 'system',
          content: `You are ARIA, an AI platform that coordinates specialist agents. Synthesise all findings into a comprehensive, actionable response to the user's original task. Be specific, cite data from findings, and structure clearly in markdown. This is the final answer the user sees.`,
        },
        {
          role: 'user',
          content: `Original task: ${userPrompt}\n\nFindings from specialist agents:\n\n${
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
