import venice from '../venice'
import { getAgentsByCapability, getAgent, getAllActiveAgents, requestCapability, type OnChainAgent } from '../registry'
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

// ─── Short-TTL read cache ─────────────────────────────────────────────────────
// Agents and their capability tags don't change during a task (and rarely between
// tasks). The hiring search re-reads the same rows every round, so a brief cache
// collapses the repeated on-chain round-trips with no loss of quality — a newly
// registered agent is simply picked up on the next TTL window.
const READ_TTL = 60_000
const capCache = new Map<string, { at: number; ids: `0x${string}`[] }>()
const agentCache = new Map<string, { at: number; agent: OnChainAgent }>()

async function cachedAgentsByCapability(tag: string): Promise<{ ids: `0x${string}`[]; errored: boolean }> {
  const hit = capCache.get(tag)
  if (hit && Date.now() - hit.at < READ_TTL) return { ids: hit.ids, errored: false }
  const r = await lookupAgentsByCapability(tag)
  if (!r.errored) capCache.set(tag, { at: Date.now(), ids: r.ids })
  return r
}

async function cachedGetAgent(id: `0x${string}`): Promise<OnChainAgent | null> {
  const hit = agentCache.get(id)
  if (hit && Date.now() - hit.at < READ_TTL) return hit.agent
  try {
    const agent = (await getAgent(id)) as OnChainAgent
    agentCache.set(id, { at: Date.now(), agent })
    return agent
  } catch {
    return null
  }
}

let allActiveCache: { at: number; ids: `0x${string}`[] } | null = null
async function cachedAllActiveAgents(): Promise<`0x${string}`[]> {
  if (allActiveCache && Date.now() - allActiveCache.at < READ_TTL) return allActiveCache.ids
  try {
    const ids = (await getAllActiveAgents()) as `0x${string}`[]
    allActiveCache = { at: Date.now(), ids }
    return ids
  } catch {
    return allActiveCache?.ids ?? []
  }
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
  // Agents already hired earlier in THIS task — excluded so no agent runs twice
  // (selection is semantic now, so capability-string dedup alone can't prevent it).
  excludeAgentIds: Set<string> = new Set(),
): Promise<HiringPlan> {
  const candidateMap = new Map<string, CandidateAgent>()
  const capabilityToCandidateIds = new Map<string, string[]>()
  const neededSet = new Set(capabilities) // hires this round must stay within these

  // ── STAGE 1: Coarse filter — on-chain lookup + manifest fetch (parallel) ──
  const registeredTags = await getRegisteredTags()

  // 1a. Resolve agent IDs for every capability AT ONCE (cached per process).
  const capLookups = await Promise.all(
    capabilities.map(async (cap) => {
      // Map the planned tag to the closest registered one so a near-miss
      // ("onchain-analysis" → "onchain-analytics") still finds its agent.
      const lookupTag = resolveToRegisteredTag(cap, registeredTags) ?? cap
      const { ids, errored } = await cachedAgentsByCapability(lookupTag)
      return { cap, ids, errored }
    })
  )

  // 1b. Build the candidate POOL = every ACTIVE agent (not just tag matches). The
  //     semantic step matches by DESCRIPTION, so a capability named "creative-
  //     generation" still finds the visual-asset agent, and odd agent tags still
  //     work. Tag matches are kept only as hints for the safety-net/fallback path.
  const allActiveIds = await cachedAllActiveAgents()
  const poolIds = [...new Set<`0x${string}`>([...allActiveIds, ...capLookups.flatMap((l) => l.ids)])]
    .filter((id) => !excludeAgentIds.has(id)) // never re-hire an agent that already ran this task
  const resolvedById = new Map<string, { onChain: OnChainAgent; manifest: NonNullable<unknown> }>()
  await Promise.all(
    poolIds.map(async (id) => {
      const onChain = await cachedGetAgent(id)
      if (!onChain || !onChain.isActive) return
      const manifest = await getManifestCached(onChain.ipfsCID).catch(() => null)
      if (!manifest?.endpointUrl) return
      resolvedById.set(id, { onChain, manifest })
    })
  )

  // 1c. Materialise the candidate map (full pool) + per-capability tag hints.
  for (const [id, data] of resolvedById) {
    if (candidateMap.has(id)) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manifest = data.manifest as any
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
        priceUSDC: Number(data.onChain.pricePerTask) / 1e6,
      },
      taggedCapabilities: data.onChain.capabilities,
      manifest,
    })
  }
  for (const { cap, ids } of capLookups) {
    const hint = ids.filter((id) => resolvedById.has(id))
    if (hint.length > 0) capabilityToCandidateIds.set(cap, hint)
  }

  // No reachable agents at all → everything falls back, and the demand is a real gap.
  if (candidateMap.size === 0) {
    for (const cap of capabilities) {
      if (!gapLoggedThisRun.has(cap)) { requestCapability(cap).catch(() => {}); gapLoggedThisRun.add(cap) }
    }
    return { hires: [], fallbacks: capabilities.map((c) => ({ capability: c, reason: 'no-agent-registered' as const })) }
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
  let unservableCapabilities: string[] = []

  try {
    const planResponse = await veniceTracker.track(() =>
      venice.chat.completions.create({
        model: 'llama-3.3-70b',
        messages: [
          {
            role: 'system',
            content: `You are ARIA's orchestrator. Match each needed capability to the BEST available agent — by what the agent actually DOES (its description / examples / outputs), NOT by whether a tag string matches. Capability names are free-form and may be unconventional (e.g. "creative-generation", "make-a-video", "branding"); judge intent.

Needed capabilities this round: ${capabilities.join(', ')}

Available agents (the full active registry — read each description and outputs):
${JSON.stringify(candidatesForPrompt, null, 2)}

Rules:
- Hire ONLY for the needed capabilities listed above. Do NOT hire an agent for other work just because the broader task could use it later — that work happens in a later round. Every entry in "coversCapabilities" MUST be one of the needed capabilities.
- For EACH needed capability, pick the agent whose description/outputs genuinely fit it best, EVEN IF no tag matches. An agent that produces images is the right pick for "banner"/"visual"/"creative-generation"/"logo"; one that produces video is right for "video"/"teaser"/"promo-clip"/"animation"; one that does market research fits "research"/"competitor-scan"; etc.
- Prefer hiring ONE agent for MULTIPLE capabilities when its description covers them (e.g. an agent that makes a banner AND a voiced announcement).
- Write SPECIFIC task instructions per hire, grounded in the agent's described abilities and the task.
- Use fitLevel "partial" if an agent only partly covers a capability (still hire it).
- ONLY list a capability in "unservableCapabilities" if NO agent in the list can reasonably produce that kind of output AT ALL (a genuine gap). Be strict: never mark something unservable just because the tag differs — match by what the agent does.

Return valid JSON only (no markdown, no prose):
{ "hires": [{ "agentId": "...", "coversCapabilities": ["..."], "fitLevel": "good" | "partial", "taskInstructions": "..." }], "unservableCapabilities": ["..."] }`,
          },
          {
            role: 'user',
            content: `Task: ${task}\nPrior findings: ${JSON.stringify(accumulatedContext)}`,
          },
        ],
      })
    )

    const raw = planResponse.choices[0].message.content ?? ''
    const plan = safeParseJSON<{ hires?: VenicePlanHire[]; unservableCapabilities?: string[] }>(raw)
    planHires = Array.isArray(plan.hires) ? plan.hires : []
    unservableCapabilities = Array.isArray(plan.unservableCapabilities) ? plan.unservableCapabilities : []
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
  // Capabilities Venice judged genuinely unservable by ANY agent → fall back to the
  // orchestrator AND log the on-chain demand gap (the real signal for developers).
  const fallbacks: HiringPlan['fallbacks'] = unservableCapabilities.map((c) => ({ capability: c, reason: 'no-agent-registered' as const }))
  for (const c of unservableCapabilities) {
    if (!gapLoggedThisRun.has(c)) { requestCapability(c).catch(() => {}); gapLoggedThisRun.add(c) }
  }

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
    // Clamp to the round's needed capabilities — drop any over-hire Venice added
    // for work that isn't needed this round.
    const covers = hire.coversCapabilities.filter((c) => neededSet.has(c))
    if (covers.length === 0) continue

    const candidate = candidateMap.get(hire.agentId)
      ?? candidateByLowerId.get(hire.agentId.toLowerCase())
      ?? candidateByName.get(hire.agentId.toLowerCase().trim())

    if (!candidate) {
      // Last resort: pick cheapest candidate covering ANY of these capabilities
      let bestFallback: CandidateAgent | undefined
      for (const cap of covers) {
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
          coversCapabilities: covers,
          allRegistryCapabilities: candidate.taggedCapabilities,
          fitLevel: hire.fitLevel ?? 'good',
          taskInstructions: hire.taskInstructions,
        })
        continue
      }

      console.warn(`[hiring-plan] Venice returned unknown agentId "${hire.agentId}" — known ids: ${[...candidateMap.keys()].join(', ')}`)
      for (const cap of covers) {
        fallbacks.push({ capability: cap, reason: 'agent-unavailable' })
      }
      continue
    }

    hires.push({
      agent: candidate.agent,
      coversCapabilities: covers,
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
  const flaggedUnservable = new Set(unservableCapabilities)
  // Safety net for tag-matched capabilities (we have a concrete cheapest hint).
  for (const cap of capabilityToCandidateIds.keys()) {
    if (coveredByHire.has(cap) || flaggedUnservable.has(cap)) continue
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

  // ── Final guarantee: every needed capability is either hired or has a fallback.
  // Without this, a capability that Venice neither hired nor flagged (and that has
  // no tag hint) would be silently dropped — the round produces nothing and the
  // whole run "gives up". Anything uncovered falls back to the orchestrator.
  const inFallbacks = new Set(fallbacks.map((f) => f.capability))
  for (const cap of capabilities) {
    if (!coveredByHire.has(cap) && !inFallbacks.has(cap)) {
      fallbacks.push({ capability: cap, reason: 'no-agent-registered' })
    }
  }

  return { hires, fallbacks }
}
