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
          content: `You are ARIA's orchestrator. Your job is to reason about what a task genuinely needs, then identify the most critical specialist capabilities to start with.

Registry context — these capabilities already have registered agents:
${availableCapabilities.length > 0 ? availableCapabilities.join(', ') : 'none registered yet'}

How the system works:
- You name the capabilities the task needs. The system searches for agents.
- If an agent exists for a capability → it gets hired and paid to do the work.
- If no agent exists → Venice handles it directly AND the gap is logged on-chain so developers know to build one.
- You are NOT limited to what's in the registry. Name what the task actually needs.

Your rules:
1. Only return capabilities that can do useful work RIGHT NOW using only the user's message.
   Ask yourself: "Can this capability produce meaningful output with NO prior findings?"
   If the answer is no — it needs data from another capability first — leave it out of Round 1.
   It will be added in a later round once the data it depends on exists.

2. Return 1-2 capabilities maximum for this first round — only the ones that can START immediately.
   Examples of what belongs in Round 1:
   - "market-intelligence": can search and analyse with just a token name or topic ✓
   - "onchain-analytics": can query blockchain data with just a contract address or name ✓
   - "code-generation": can write code from a spec ✓
   Examples of what does NOT belong in Round 1:
   - "positioning": needs competitive landscape data from market research first ✗
   - "strategy": needs findings to strategise against ✗
   - "image-generation": needs a positioning angle or brief before generating ✗
   - "copywriting": needs a strategy or product brief before writing ✗
   - "tts" / "audio-production": needs a script, which needs a strategy first ✗

3. Use short lowercase tags: "market-intelligence", "onchain-analytics", "code-generation", etc.

4. NEVER substitute a capability that doesn't fit just because it exists in the registry.
   If the task needs "legal-analysis" and no agent has it, return "legal-analysis" —
   Venice handles it directly and logs the gap on-chain.

5. If the task is conversational or simple enough that Venice can answer directly, return [].

Return a JSON object on a single line: { "capabilities": string[], "reasoning": "one sentence explaining what the task needs and why you picked these" }`,
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
