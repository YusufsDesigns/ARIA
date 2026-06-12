import { getAgentsByCapability, getAgent, requestCapability, type OnChainAgent } from '../registry'
import { fetchAgentMetadata } from '../pinata'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResolvedAgent = {
  id: `0x${string}`
  name: string
  endpointUrl: string
  priceUSDC: number
}

export type ResolutionResult = {
  agentHires: Array<{ agent: ResolvedAgent; matchedCapabilities: string[] }>
  fallbacks: Array<{
    capability: string
    reason: 'no-agent-registered' | 'agent-unavailable'
  }>
}

// ─── Main resolution function ─────────────────────────────────────────────────
// Distinguishes two completely different situations:
//
//   Situation A — No agent has EVER been registered for this capability.
//     → Genuine marketplace gap. Log on-chain. Venice handles it.
//
//   Situation B — An agent IS registered but its server is currently unreachable.
//     → Downtime, not absence. Do NOT log as capability gap.
//       Venice handles it but we don't mislead developers.
//
// Also deduplicates: if the same agent serves multiple requested capabilities,
// it is hired ONCE and passed all matched capabilities together.

export async function resolveAgentsForCapabilities(
  capabilities: string[],
  gapLoggedThisRun: Set<string>,
): Promise<ResolutionResult> {
  const agentMap = new Map<string, { agent: ResolvedAgent; matchedCapabilities: string[] }>()
  const fallbacks: ResolutionResult['fallbacks'] = []

  for (const capability of capabilities) {
    // ── Registry lookup ───────────────────────────────────────────────────────
    let agentIds: `0x${string}`[] = []
    try {
      agentIds = (await getAgentsByCapability(capability)) as `0x${string}`[]
    } catch {
      agentIds = []
    }

    if (agentIds.length === 0) {
      // SITUATION A: genuine marketplace gap
      fallbacks.push({ capability, reason: 'no-agent-registered' })
      if (!gapLoggedThisRun.has(capability)) {
        requestCapability(capability).catch(() => {})
        gapLoggedThisRun.add(capability)
      }
      continue
    }

    // ── Resolve agents to endpoints ───────────────────────────────────────────
    const resolved: ResolvedAgent[] = []
    for (const id of agentIds) {
      try {
        const agent = (await getAgent(id)) as OnChainAgent
        if (!agent.isActive) continue
        const meta = await fetchAgentMetadata(agent.ipfsCID).catch(() => null)
        if (!meta?.endpointUrl) continue
        resolved.push({
          id,
          name: (meta.name as string) ?? 'Unknown Agent',
          endpointUrl: meta.endpointUrl as string,
          priceUSDC: Number(agent.pricePerTask) / 1e6,
        })
      } catch {
        // skip unresolvable agent
      }
    }

    // Sort cheapest first
    resolved.sort((a, b) => a.priceUSDC - b.priceUSDC)

    // ── Health check — find first actually reachable ───────────────────────────
    const reachable = await findFirstReachable(resolved)

    if (!reachable) {
      // SITUATION B: agents exist but none responded — downtime, not a gap
      fallbacks.push({ capability, reason: 'agent-unavailable' })
      // Intentionally NOT calling requestCapability here
      continue
    }

    // ── Deduplicate: merge capabilities served by the same agent ──────────────
    if (agentMap.has(reachable.id)) {
      agentMap.get(reachable.id)!.matchedCapabilities.push(capability)
    } else {
      agentMap.set(reachable.id, { agent: reachable, matchedCapabilities: [capability] })
    }
  }

  return { agentHires: Array.from(agentMap.values()), fallbacks }
}

// ─── Health check ─────────────────────────────────────────────────────────────
// 3-second timeout per agent — tries in cheapest-first order.

async function findFirstReachable(candidates: ResolvedAgent[]): Promise<ResolvedAgent | null> {
  for (const agent of candidates) {
    try {
      const res = await fetch(`${agent.endpointUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) return agent
    } catch {
      continue
    }
  }
  return null
}
