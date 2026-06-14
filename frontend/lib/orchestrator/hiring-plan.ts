import venice from '../venice'
import { getAgentsByCapability, getAgent, requestCapability, type OnChainAgent } from '../registry'
import { getManifestCached } from './manifest-cache'
import type { ResolvedAgent } from './resolve-agents'
import { getAllDistinctCapabilities, type VeniceCallTracker } from './plan'
import { safeParseJSON } from './safe-json-parse'

// ─── Registered-tag resolution ────────────────────────────────────────────────
// The planner (Venice) names capabilities in free text; an exact string mismatch
// against the on-chain tag (e.g. "onchain-analysis" vs "onchain-analytics") would
// otherwise silently drop a real agent to Venice fallback. We map a planned tag to
// the closest REGISTERED tag (so we can only ever resolve to capabilities that have
// agents) before the on-chain lookup. Cached per process — tags are immutable.

let _registeredTags: string[] | null = null
async function getRegisteredTags(): Promise<string[]> {
  if (_registeredTags) return _registeredTags
  _registeredTags = await getAllDistinctCapabilities().catch(() => [])
  return _registeredTags
}

const normalizeTag = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '')

function resolveToRegisteredTag(cap: string, registeredTags: string[]): string | null {
  if (registeredTags.includes(cap)) return cap
  const n = normalizeTag(cap)
  let containment: string | null = null
  for (const t of registeredTags) {
    const nt = normalizeTag(t)
    if (nt === n) return t // normalized equality — strongest non-exact match
    if (!containment && (nt.includes(n) || n.includes(nt))) containment = t
  }
  return containment
}

// One retry on throw — distinguishes a transient RPC error from a genuine gap so
// a single blip can't silently degrade the whole run (and log a false on-chain gap).
async function lookupAgentsByCapability(
  tag: string,
): Promise<{ ids: `0x${string}`[]; errored: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return { ids: (await getAgentsByCapability(tag)) as `0x${string}`[], errored: false }
    } catch {
      if (attempt === 0) await new Promise(r => setTimeout(r, 400))
    }
  }
  return { ids: [], errored: true }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type FitLevel = 'good' | 'partial'

export type HiringPlan = {
  hires: Array<{
    agent: ResolvedAgent
    coversCapabilities: string[]   // what Venice assigned to this hire
    allRegistryCapabilities: string[] // full capability set from on-chain registration
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const registeredTags = await getRegisteredTags()

  for (const cap of capabilities) {
    // Map the planned tag to the closest registered one before lookup, so a
    // near-miss ("onchain-analysis" → "onchain-analytics") still finds its agent.
    const lookupTag = resolveToRegisteredTag(cap, registeredTags) ?? cap
    const { ids: agentIds, errored } = await lookupAgentsByCapability(lookupTag)

    if (agentIds.length === 0) {
      noAgentCapabilities.push(cap)
      // Only log an on-chain capability gap for a GENUINE miss — never for a
      // transient RPC error (errored), which would record a false demand signal.
      if (!errored && !gapLoggedThisRun.has(cap)) {
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
              endpointUrl: (() => {
                // IPFS manifests may omit the https:// scheme — fetch() requires absolute URLs
                const raw = (manifest.endpointUrl as string).replace(/\/$/, '')
                return raw.startsWith('http') ? raw : `https://${raw}`
              })(),
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

  // ── STAGE 3: Resolve chosen agents — no pre-flight health check ──────────────
  // Health checks were causing 30–68s delays and false negatives when Railway
  // services were warming up. They are redundant: any real failure during the
  // x402 call is caught by executeRound's try/catch which falls back to Venice.
  // Removing the check means registered agents are always attempted.
  const hires: HiringPlan['hires'] = []
  const fallbacks: HiringPlan['fallbacks'] = [
    ...noAgentCapabilities.map(c => ({ capability: c, reason: 'no-agent-registered' as const })),
    ...poorFitCapabilities.map(c => ({ capability: c, reason: 'poor-fit' as const })),
  ]

  // Case-insensitive lookup — viem returns lowercase bytes32 but Venice (LLM)
  // may return the same ID with different casing in its JSON output.
  const candidateByLowerId = new Map<string, CandidateAgent>()
  for (const [k, v] of candidateMap) candidateByLowerId.set(k.toLowerCase(), v)

  // Name-based lookup — Venice sometimes returns the agent name instead of its ID
  const candidateByName = new Map<string, CandidateAgent>()
  for (const [, v] of candidateMap) {
    const name = (v.manifest?.name as string ?? '').toLowerCase().trim()
    if (name) candidateByName.set(name, v)
  }

  for (const hire of planHires) {
    const candidate = candidateMap.get(hire.agentId)
      ?? candidateByLowerId.get(hire.agentId.toLowerCase())
      ?? candidateByName.get(hire.agentId.toLowerCase().trim())

    if (!candidate) {
      // Last resort: pick cheapest candidate covering ANY of these capabilities
      let bestFallback: CandidateAgent | undefined
      for (const cap of hire.coversCapabilities) {
        const ids = capabilityToCandidateIds.get(cap) ?? []
        for (const id of ids) {
          const c = candidateMap.get(id) ?? candidateByLowerId.get(id.toLowerCase())
          if (c && (!bestFallback || c.agent.priceUSDC < bestFallback.agent.priceUSDC)) {
            bestFallback = c
          }
        }
      }

      if (bestFallback) {
        // Venice returned a bad ID but we found a real candidate — use it
        const candidate = bestFallback
        hires.push({
          agent: candidate.agent,
          coversCapabilities: hire.coversCapabilities,
          allRegistryCapabilities: candidate.taggedCapabilities,
          fitLevel: hire.fitLevel ?? 'good',
          taskInstructions: hire.taskInstructions,
        })
        continue
      }

      console.warn(`[hiring-plan] Venice returned unknown agentId "${hire.agentId}" — known ids: ${[...candidateMap.keys()].join(', ')}`)
      for (const cap of hire.coversCapabilities) {
        fallbacks.push({ capability: cap, reason: 'agent-unavailable' })
      }
      continue
    }

    hires.push({
      agent: candidate.agent,
      coversCapabilities: hire.coversCapabilities,
      allRegistryCapabilities: candidate.taggedCapabilities,
      fitLevel: hire.fitLevel ?? 'good',
      taskInstructions: hire.taskInstructions,
    })
  }

  // ── Coverage guard ──────────────────────────────────────────────────────────
  // The semantic layer (Venice) refines WHICH agent and HOW — it must never cause
  // a capability that HAS a reachable, registered agent to be silently dropped.
  // If Venice returns empty/partial hires (a stochastic failure mode that produced
  // zero-hire runs), any capability with candidates that was neither hired nor
  // explicitly flagged poor-fit gets the cheapest candidate hired with the raw
  // task as instructions. Guarantees: a registered agent always runs.
  const coveredByHire = new Set(hires.flatMap(h => h.coversCapabilities))
  const flaggedPoorFit = new Set(poorFitCapabilities)
  for (const cap of capabilitiesWithCandidates) {
    if (coveredByHire.has(cap) || flaggedPoorFit.has(cap)) continue
    const cheapest = (capabilityToCandidateIds.get(cap) ?? [])
      .map(id => candidateMap.get(id))
      .filter((c): c is CandidateAgent => !!c)
      .sort((a, b) => a.agent.priceUSDC - b.agent.priceUSDC)[0]
    if (!cheapest) continue

    const existing = hires.find(h => h.agent.id === cheapest.agent.id)
    if (existing) {
      existing.coversCapabilities.push(cap)
    } else {
      hires.push({
        agent: cheapest.agent,
        coversCapabilities: [cap],
        allRegistryCapabilities: cheapest.taggedCapabilities,
        fitLevel: 'good',
        taskInstructions: task,
      })
    }
    coveredByHire.add(cap)
  }

  return { hires, fallbacks }
}
