import venice from '../venice'
import { getAgentsByCapability, getAgent, requestCapability, type OnChainAgent } from '../registry'
import { getManifestCached } from './manifest-cache'
import type { ResolvedAgent } from './resolve-agents'
import type { VeniceCallTracker } from './plan'
import { safeParseJSON } from './safe-json-parse'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FitLevel = 'good' | 'partial'

export type HiringPlan = {
  hires: Array<{
    agent: ResolvedAgent
    coversCapabilities: string[]
    fitLevel: FitLevel
    taskInstructions: string
  }>
  fallbacks: Array<{
    capability: string
    reason: 'no-agent-registered' | 'agent-unavailable' | 'poor-fit'
  }>
}

type CandidateAgent = {
  id: string
  agent: ResolvedAgent
  taggedCapabilities: string[]
  manifest: any
}

// ─── Main function ────────────────────────────────────────────────────────────
// Supersedes the coarse resolveAgentsForCapabilities → adds a semantic Venice
// step that reads each candidate's IPFS manifest (description + examples) and
// writes custom task instructions per hire.
//
// Flow for the whole round in one call:
//   1. On-chain lookup per capability (gap logging for zero-result caps)
//   2. Manifest fetch for all unique candidates (cached after first fetch)
//   3. ONE Venice call: select best agent per cap, write task instructions,
//      flag poor-fit caps where a candidate exists but doesn't actually fit
//   4. Health-check the chosen agents (3-second timeout)

export async function buildHiringPlan(
  task: string,
  capabilities: string[],
  accumulatedContext: object,
  veniceTracker: VeniceCallTracker,
  gapLoggedThisRun: Set<string>,
): Promise<HiringPlan> {
  const candidateMap = new Map<string, CandidateAgent>()
  const noAgentCapabilities: string[] = []
  const capabilityToCandidateIds = new Map<string, string[]>()

  // ── STAGE 1: Coarse filter — on-chain lookup + manifest fetch ─────────────
  for (const cap of capabilities) {
    let agentIds: `0x${string}`[] = []
    try {
      agentIds = (await getAgentsByCapability(cap)) as `0x${string}`[]
    } catch {
      agentIds = []
    }

    if (agentIds.length === 0) {
      // Genuine marketplace gap — agent has never been registered for this tag
      noAgentCapabilities.push(cap)
      if (!gapLoggedThisRun.has(cap)) {
        requestCapability(cap).catch(() => {})
        gapLoggedThisRun.add(cap)
      }
      continue
    }

    const resolvedIds: string[] = []
    for (const id of agentIds) {
      try {
        const onChain = (await getAgent(id)) as OnChainAgent
        if (!onChain.isActive) continue
        const manifest = await getManifestCached(onChain.ipfsCID).catch(() => null)
        if (!manifest?.endpointUrl) continue

        resolvedIds.push(id)
        if (!candidateMap.has(id)) {
          candidateMap.set(id, {
            id,
            agent: {
              id: id as `0x${string}`,
              name: (manifest.name as string) ?? 'Unknown Agent',
              endpointUrl: manifest.endpointUrl as string,
              priceUSDC: Number(onChain.pricePerTask) / 1e6,
            },
            taggedCapabilities: onChain.capabilities,
            manifest,
          })
        }
      } catch {
        // skip unresolvable
      }
    }

    if (resolvedIds.length > 0) {
      capabilityToCandidateIds.set(cap, resolvedIds)
    } else {
      // Agents exist in registry but none are active/resolvable — downtime, not a gap
      noAgentCapabilities.push(cap)
    }
  }

  const capabilitiesWithCandidates = capabilities.filter(c => capabilityToCandidateIds.has(c))

  if (capabilitiesWithCandidates.length === 0) {
    return {
      hires: [],
      fallbacks: noAgentCapabilities.map(c => ({ capability: c, reason: 'no-agent-registered' as const })),
    }
  }

  // ── STAGE 2: Semantic selection — ONE Venice call per round ───────────────
  const candidatesForPrompt = Array.from(candidateMap.values()).map(c => ({
    agentId: c.id,
    name: c.manifest.name ?? 'Unknown',
    description: c.manifest.description ?? '',
    taggedCapabilities: c.taggedCapabilities,
    outputs: c.manifest.capabilitySchema?.outputs,
    examples: c.manifest.capabilitySchema?.examples,
    pricePerTask: c.agent.priceUSDC,
  }))

  type VenicePlanHire = {
    agentId: string
    coversCapabilities: string[]
    fitLevel: FitLevel
    taskInstructions: string
  }

  let planHires: VenicePlanHire[] = []
  let poorFitCapabilities: string[] = []

  try {
    const planResponse = await veniceTracker.track(() =>
      venice.chat.completions.create({
        model: 'llama-3.3-70b',
        messages: [
          {
            role: 'system',
            content: `You are ARIA's orchestrator selecting specialist agents for this round.

Needed capabilities: ${capabilitiesWithCandidates.join(', ')}
${noAgentCapabilities.length > 0 ? `No registered agent exists for: ${noAgentCapabilities.join(', ')} — excluded, already handled separately.` : ''}

Candidate agents — read their description carefully, not just their tags:
${JSON.stringify(candidatesForPrompt, null, 2)}

Instructions:
- Judge which candidate BEST FITS each needed capability based on its description and examples, not just the capability tag.
- Prefer hiring ONE agent for MULTIPLE capabilities if its description genuinely covers them.
- Write SPECIFIC task instructions for each hire (reference details from description/examples — not generic instructions).
- If a candidate covers a capability only partially, still hire it (fitLevel: "partial") but focus instructions on what it does well.
- If NO candidate for a capability is a reasonable fit — their tags match but the description shows a clear mismatch — mark it poor-fit. Do NOT mark poor-fit just because it is not perfect.
- poor-fit is NOT a registry gap (an agent with the tag exists). Venice will handle it directly.

Return valid JSON only (no markdown, no explanation):
{ "hires": [{ "agentId": "...", "coversCapabilities": ["..."], "fitLevel": "good" | "partial", "taskInstructions": "..." }], "poorFitCapabilities": ["..."] }`,
          },
          {
            role: 'user',
            content: `Task: ${task}\nPrior findings: ${JSON.stringify(accumulatedContext)}`,
          },
        ],
      })
    )

    const raw = planResponse.choices[0].message.content ?? ''
    const plan = safeParseJSON<{ hires?: VenicePlanHire[]; poorFitCapabilities?: string[] }>(raw)
    planHires = Array.isArray(plan.hires) ? plan.hires : []
    poorFitCapabilities = Array.isArray(plan.poorFitCapabilities) ? plan.poorFitCapabilities : []
  } catch {
    // Venice call failed — fall back to cheapest agent per capability, generic instructions
    const assignedAgents = new Set<string>()
    for (const [cap, ids] of capabilityToCandidateIds) {
      const candidates = ids
        .map(id => candidateMap.get(id)!)
        .filter(Boolean)
        .sort((a, b) => a.agent.priceUSDC - b.agent.priceUSDC)

      const cheapest = candidates.find(c => !assignedAgents.has(c.id)) ?? candidates[0]
      if (!cheapest) continue

      const existing = planHires.find(h => h.agentId === cheapest.id)
      if (existing) {
        existing.coversCapabilities.push(cap)
      } else {
        assignedAgents.add(cheapest.id)
        planHires.push({
          agentId: cheapest.id,
          coversCapabilities: [cap],
          fitLevel: 'good',
          taskInstructions: task,
        })
      }
    }
  }

  // ── STAGE 3: Health-check chosen agents ───────────────────────────────────
  const hires: HiringPlan['hires'] = []
  const fallbacks: HiringPlan['fallbacks'] = [
    ...noAgentCapabilities.map(c => ({ capability: c, reason: 'no-agent-registered' as const })),
    ...poorFitCapabilities.map(c => ({ capability: c, reason: 'poor-fit' as const })),
  ]

  await Promise.all(
    planHires.map(async (hire) => {
      const candidate = candidateMap.get(hire.agentId)
      if (!candidate) {
        for (const cap of hire.coversCapabilities) {
          fallbacks.push({ capability: cap, reason: 'agent-unavailable' })
        }
        return
      }

      let healthy = false
      try {
        const res = await fetch(`${candidate.agent.endpointUrl}/health`, {
          signal: AbortSignal.timeout(3000),
        })
        healthy = res.ok
      } catch {
        healthy = false
      }

      if (!healthy) {
        for (const cap of hire.coversCapabilities) {
          fallbacks.push({ capability: cap, reason: 'agent-unavailable' })
        }
        return
      }

      hires.push({
        agent: candidate.agent,
        coversCapabilities: hire.coversCapabilities,
        fitLevel: hire.fitLevel ?? 'good',
        taskInstructions: hire.taskInstructions,
      })
    })
  )

  return { hires, fallbacks }
}
