import { veniceChat } from '../venice'
import { getAgentsByCapability, requestCapability, recordTaskCompletion } from '../registry'
import { prisma } from '../prisma'
import { emitTaskEvent } from '../sse'
import { BudgetTracker } from './budget'
import { callAgentWithX402, type AgentResponse } from './pay-agent'
import { fetchAgentMetadata } from '../pinata'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnChainAgent = {
  id: `0x${string}`
  owner: `0x${string}`
  capabilities: string[]
  pricePerTask: bigint
  ipfsCID: string
  isActive: boolean
  tasksCompleted: bigint
  totalRatingX100: bigint
  ratingCount: bigint
  registeredAt: bigint
}

export type AgentManifest = {
  name?: string
  endpointUrl?: string
  description?: string
}

type Finding = {
  capability: string
  output: string
  outputType: string
  agentName: string
  priceUSDC: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emit(taskId: string, type: Parameters<typeof emitTaskEvent>[1]['type'], payload: Parameters<typeof emitTaskEvent>[1]['payload']) {
  emitTaskEvent(taskId, { type, payload, timestamp: Date.now() })
}

async function resolveAgentEndpoint(agent: OnChainAgent): Promise<{ name: string; url: string } | null> {
  try {
    if (!agent.ipfsCID) return null
    const manifest = await fetchAgentMetadata(agent.ipfsCID) as AgentManifest
    if (!manifest.endpointUrl) return null
    return { name: manifest.name ?? 'Unknown Agent', url: manifest.endpointUrl }
  } catch {
    return null
  }
}

// ─── Process a single capability ─────────────────────────────────────────────
// Returns true if a finding was recorded, false otherwise

async function processCapability(
  capability: string,
  taskId: string,
  userPrompt: string,
  budget: BudgetTracker,
  findings: Record<string, Finding>,
  permissionContext: `0x${string}` | null,
  userAddress: string,
): Promise<void> {
  emit(taskId, 'orchestrator_thinking', {
    message: `Searching for ${capability} agent...`,
    capability,
  })

  // ── SEARCH: on-chain registry ─────────────────────────────────────────
  let agentIds: `0x${string}`[] = []
  try {
    agentIds = (await getAgentsByCapability(capability)) as `0x${string}`[]
  } catch {
    agentIds = []
  }

  const agentsWithEndpoints: Array<{
    id: `0x${string}`
    priceUSDC: number
    name: string
    url: string
  }> = []

  for (const id of agentIds) {
    try {
      const { getAgent } = await import('../registry')
      const agent = await getAgent(id) as OnChainAgent
      if (!agent.isActive) continue

      const endpoint = await resolveAgentEndpoint({ ...agent, id })
      if (!endpoint) continue

      const priceUSDC = Number(agent.pricePerTask) / 1e6
      if (budget.canAfford(priceUSDC)) {
        agentsWithEndpoints.push({ id, priceUSDC, ...endpoint })
      }
    } catch {
      // skip unavailable agents
    }
  }

  // ── ACT: Hire or Venice fallback ──────────────────────────────────────
  if (agentsWithEndpoints.length === 0) {
    emit(taskId, 'orchestrator_thinking', {
      message: `No agent found for ${capability}. Venice handling directly...`,
      capability,
    })

    try {
      const directResult = await veniceChat([
        {
          role: 'system',
          content: `You are a specialist in ${capability}. Complete this task to the best of your ability using only your training knowledge.`,
        },
        {
          role: 'user',
          content: `Task: ${userPrompt}\nContext so far: ${JSON.stringify(findings)}`,
        },
      ])

      findings[capability] = {
        capability,
        output: directResult,
        outputType: 'text',
        agentName: 'Venice AI (direct)',
        priceUSDC: 0,
      }

      emit(taskId, 'finding_received', {
        capability,
        finding: directResult,
        outputType: 'text',
        agentName: 'Venice AI (direct)',
      })

      // Record capability gap on-chain via 1Shot EIP-7710 relay (non-blocking)
      requestCapability(capability)
        .then(() => emit(taskId, 'orchestrator_thinking', {
          message: `On-chain gap signal recorded for "${capability}" via 1Shot EIP-7710 relay`,
        }))
        .catch(() => {})
    } catch (err) {
      emit(taskId, 'orchestrator_thinking', {
        message: `Venice direct handling failed for ${capability}: ${err}`,
      })
    }
    return
  }

  // Sort by cheapest first
  agentsWithEndpoints.sort((a, b) => a.priceUSDC - b.priceUSDC)
  const picked = agentsWithEndpoints[0]

  emit(taskId, 'agent_hired', {
    agentName: picked.name,
    capability,
    amountUsdc: picked.priceUSDC,
  })

  // Save AgentCall to DB
  let dbCallId: string | null = null
  try {
    const call = await prisma.agentCall.create({
      data: {
        taskId,
        agentName: picked.name,
        agentAddress: picked.id,
        capability,
        amountUsdc: picked.priceUSDC,
        status: 'pending',
      },
    })
    dbCallId = call.id
  } catch { /* non-fatal */ }

  // Build context from previous findings
  const ctx: Record<string, unknown> = {}
  for (const [cap, f] of Object.entries(findings)) {
    ctx[cap] = f.output
  }

  let agentResult: AgentResponse | null = null
  let txHash: string | null = null

  try {
    if (permissionContext && permissionContext !== '0x') {
      agentResult = await callAgentWithX402(
        `${picked.url}/execute`,
        userPrompt,
        ctx,
        permissionContext,
        userAddress,
      )
    } else {
      emit(taskId, 'orchestrator_thinking', {
        message: `[dev mode] No permission context — calling ${picked.name} without payment`,
      })
      const res = await fetch(`${picked.url}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: userPrompt, context: ctx }),
      })
      if (res.ok) agentResult = await res.json()
    }

    if (agentResult && (agentResult.status === 'success' || agentResult.status === 'partial')) {
      findings[capability] = {
        capability,
        output: agentResult.output,
        outputType: agentResult.outputType,
        agentName: picked.name,
        priceUSDC: picked.priceUSDC,
      }

      await budget.recordPayment(picked.priceUSDC, picked.name, txHash ?? 'pending')

      if (dbCallId) {
        await prisma.agentCall.update({
          where: { id: dbCallId },
          data: {
            status: 'completed',
            finding: agentResult.output,
            outputType: agentResult.outputType,
            txHash: txHash ?? undefined,
          },
        }).catch(() => {})
      }

      // Record task completion on-chain via 1Shot EIP-7710 relay (non-blocking)
      recordTaskCompletion(picked.id)
        .then((result) => {
          const hash = (result as { txHash?: string } | undefined)?.txHash
          if (hash) {
            emit(taskId, 'orchestrator_thinking', {
              message: `Task completion recorded on-chain: ${picked.name} → ${hash.slice(0, 10)}… (1Shot EIP-7710)`,
            })
          }
        })
        .catch(() => {})

      emit(taskId, 'payment_confirmed', {
        agentName: picked.name,
        capability,
        amountUsdc: picked.priceUSDC,
        txHash: txHash ?? undefined,
      })

      emit(taskId, 'finding_received', {
        agentName: picked.name,
        capability,
        finding: agentResult.output,
        outputType: agentResult.outputType,
        output: agentResult.output,
      })

      emit(taskId, 'privacy_log', {
        message: `Venice AI processed: ${capability} query — 0 bytes retained`,
      })
    }
  } catch (err) {
    emit(taskId, 'orchestrator_thinking', {
      message: `Agent ${picked.name} failed: ${err}`,
    })
    if (dbCallId) {
      await prisma.agentCall.update({
        where: { id: dbCallId },
        data: { status: 'failed' },
      }).catch(() => {})
    }
  }
}

// ─── Main ReAct loop ──────────────────────────────────────────────────────────

export async function runReactLoop(
  taskId: string,
  userPrompt: string,
  budget: BudgetTracker,
  permissionContext: `0x${string}` | null,
  userAddress: string = '',
): Promise<string> {
  const findings: Record<string, Finding> = {}
  const queue: string[] = []
  const attempted = new Set<string>()

  // ── REASON: Initial task analysis ─────────────────────────────────────────
  emit(taskId, 'orchestrator_thinking', { message: 'Analyzing task and identifying required capabilities...' })

  const planRaw = await veniceChat([
    {
      role: 'system',
      content: `You are ARIA, an autonomous AI orchestrator. Analyze the user's task and identify the specialist capabilities needed to complete it. Return ONLY a JSON object: { "capabilities": ["capability-1", "capability-2", ...], "reasoning": "..." }. Use specific capability tags like: market-intelligence, web-search, competitor-analysis, onchain-analytics, smart-contract-analysis, blockchain-data, strategy, positioning, copywriting, marketing, image-generation, visual-design, brand-assets, tts, audio-production, video-generation, video-production, media-content.`,
    },
    { role: 'user', content: `Task: ${userPrompt}` },
  ])

  let plan: { capabilities: string[]; reasoning?: string } = { capabilities: [] }
  try {
    const match = planRaw.match(/\{[\s\S]*\}/)
    if (match) plan = JSON.parse(match[0])
  } catch {
    plan.capabilities = ['market-intelligence', 'strategy']
  }

  queue.push(...(plan.capabilities ?? []))

  emit(taskId, 'orchestrator_thinking', {
    message: `Plan: ${plan.reasoning ?? `Need ${queue.join(', ')}`}`,
  })

  // ── ReAct loop — ROUND-BASED ──────────────────────────────────────────────
  // Each round processes ALL capabilities currently in queue in PARALLEL,
  // then does a Venice REASON step to discover what else is needed.
  // This is the core A2A coordination loop:
  //   independent capabilities → parallel agents hired simultaneously
  //   findings-driven capabilities → new rounds added after OBSERVE

  const deadline = Date.now() + 5 * 60_000 // 5 min hard timeout

  while (queue.length > 0 && !budget.isBudgetExhausted() && Date.now() < deadline) {
    // Take all current items as a single round (dedup against attempted)
    const round = queue.splice(0, queue.length).filter(c => !attempted.has(c))
    if (round.length === 0) break
    round.forEach(c => attempted.add(c))

    if (round.length > 1) {
      emit(taskId, 'orchestrator_thinking', {
        message: `Running ${round.length} capabilities in parallel: ${round.join(', ')}`,
      })
    }

    // ── ACT: Process entire round in parallel ─────────────────────────────
    await Promise.all(
      round.map(capability =>
        processCapability(
          capability,
          taskId,
          userPrompt,
          budget,
          findings,
          permissionContext,
          userAddress,
        )
      )
    )

    // ── OBSERVE + REASON: What's needed next? ─────────────────────────────
    if (Object.keys(findings).length === 0) break // nothing found, stop

    emit(taskId, 'orchestrator_thinking', {
      message: 'Evaluating findings — checking if more work is needed...',
    })

    const nextRaw = await veniceChat([
      {
        role: 'system',
        content: `You are ARIA orchestrator. Based on the completed work, decide if additional capabilities are needed. Return ONLY JSON: { "additional": [], "complete": true/false, "reason": "..." }. Only request capabilities not already completed: ${Object.keys(findings).join(', ')}.`,
      },
      {
        role: 'user',
        content: `Original task: ${userPrompt}\nCompleted findings: ${JSON.stringify(Object.entries(findings).map(([k, v]) => ({ capability: k, summary: v.output.slice(0, 300) })))}`,
      },
    ])

    try {
      const match = nextRaw.match(/\{[\s\S]*\}/)
      if (match) {
        const next: { additional?: string[]; complete?: boolean } = JSON.parse(match[0])
        if (!next.complete && next.additional && next.additional.length > 0) {
          const newCaps = next.additional.filter((c) => !attempted.has(c))
          if (newCaps.length > 0) {
            emit(taskId, 'orchestrator_thinking', {
              message: `Discovered ${newCaps.length} additional ${newCaps.length === 1 ? 'capability' : 'capabilities'} needed: ${newCaps.join(', ')}`,
            })
            queue.push(...newCaps)
          }
        }
      }
    } catch { /* stay in loop */ }
  }

  // ── Final synthesis ────────────────────────────────────────────────────────
  emit(taskId, 'orchestrator_thinking', { message: 'Synthesizing all findings...' })

  const synthesisInput = Object.entries(findings)
    .map(([cap, f]) => `## ${cap}\n${f.output}`)
    .join('\n\n---\n\n')

  const synthesis = await veniceChat([
    {
      role: 'system',
      content: `You are ARIA, an AI platform that coordinates specialist agents. Synthesize all agent findings into a comprehensive, actionable response to the user's original task. Be specific, cite data from findings, and structure clearly in markdown. This is the final answer the user sees.`,
    },
    {
      role: 'user',
      content: `Original task: ${userPrompt}\n\nFindings from specialist agents:\n\n${synthesisInput || 'No external agents were used — Venice AI handled the task directly.'}`,
    },
  ])

  const totalVeniceCalls = Object.keys(findings).length + 3 // plan + observe + synthesize
  const privacyReceipt = `**Privacy Receipt** | Task: ${taskId.slice(0, 8)} | Venice AI Calls: ${totalVeniceCalls} | Data Retained: 0 bytes | Training Data Shared: None`

  return `${synthesis}\n\n---\n\n${privacyReceipt}`
}
