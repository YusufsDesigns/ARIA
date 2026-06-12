import { getAllActiveAgents, getAgent } from '../registry'
import venice from '../venice'
import { safeParseJSON } from './safe-json-parse'

// ─── Venice call tracker ──────────────────────────────────────────────────────
// Wraps every Venice call so the main loop can report an accurate count
// in the privacy receipt without coupling each helper to a global counter.

export class VeniceCallTracker {
  private count = 0

  async track<T>(fn: () => Promise<T>): Promise<T> {
    this.count++
    return fn()
  }

  get callCount() { return this.count }
}

// ─── Registry capability discovery ───────────────────────────────────────────
// Reads ALL active agents and returns every distinct capability tag.
// Used to ground Venice in what actually exists before it makes a plan.

export async function getAllDistinctCapabilities(): Promise<string[]> {
  try {
    const agentIds = (await getAllActiveAgents()) as `0x${string}`[]
    const capArrays = await Promise.all(
      agentIds.map(id =>
        getAgent(id)
          .then(a => a.capabilities)
          .catch(() => [] as string[])
      )
    )
    return [...new Set(capArrays.flat())]
  } catch {
    return []
  }
}

// ─── Constrained initial planner ──────────────────────────────────────────────
// Returns 1-3 capabilities for Round 1 only.
// Venice sees the real registry so it cannot hallucinate capabilities that
// don't exist, and is explicitly told not to front-load the plan.

export async function planInitialCapabilities(
  task: string,
  veniceTracker: VeniceCallTracker,
): Promise<{ capabilities: string[]; reasoning: string }> {
  const availableCapabilities = await getAllDistinctCapabilities()

  const response = await veniceTracker.track(() =>
    venice.chat.completions.create({
      model: 'llama-3.3-70b',
      messages: [
        {
          role: 'system',
          content: `You are ARIA's orchestrator — an intelligent agent, not a checklist runner.

Capabilities currently available in the agent registry: ${
  availableCapabilities.length > 0
    ? availableCapabilities.join(', ')
    : 'none registered yet'
}.

Your job: judge what THIS SPECIFIC TASK needs for its FIRST step only. Not everything that
could ever be relevant — only what is needed to make meaningful progress right now.

Rules:
- Select 1-3 capabilities maximum for this first round.
- Only select capabilities that are DIRECTLY required to begin this task.
- You will be asked again after seeing results. Later rounds can add more capabilities
  if the findings justify it. Do not front-load the plan.
- Prefer capabilities that ARE in the registry. If none match, pick the closest or return [].
- If the task is simple enough that Venice can answer directly, return an empty array.

Return a JSON object on a single line: { "capabilities": string[], "reasoning": "one sentence explaining your choice" }`,
        },
        { role: 'user', content: task },
      ],
    })
  )

  try {
    const raw = response.choices[0].message.content ?? ''
    const parsed = safeParseJSON<{ capabilities?: string[]; reasoning?: string }>(raw)
    return {
      capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities : [],
      reasoning: parsed.reasoning ?? 'Analysing task requirements.',
    }
  } catch {
    return { capabilities: [], reasoning: 'Venice will handle this task directly.' }
  }
}
