/**
 * ARIA Structured Agent Result — the shared render contract.
 *
 * Every ARIA agent returns this shape (as a JSON string in `AgentResponse.output`
 * with `outputType: 'json'`). The orchestrator uses `summary` for downstream
 * reasoning/synthesis context; the frontend renders `blocks` as rich, branded
 * components (metric cards, risk badges, tables, image/audio/video, provenance
 * links) so a result reads as "a real agent produced this", not a wall of text.
 *
 * This file is the source of truth. Agents (separate packages) build matching
 * JSON by hand — keep them in sync with this type.
 */

export type Tone = 'good' | 'bad' | 'warn' | 'neutral'

export type MetricItem = {
  label: string
  value: string
  sub?: string // small caption under the value
  tone?: Tone
  href?: string // optional link (e.g. BaseScan) making the value verifiable
}

export type BadgeItem = {
  label: string
  tone: Tone
  detail?: string
}

export type LinkItem = {
  label: string
  href: string
}

export type RenderBlock =
  | { kind: 'metrics'; title?: string; items: MetricItem[] }
  | { kind: 'table'; title?: string; columns: string[]; rows: string[][] }
  | { kind: 'badges'; title?: string; items: BadgeItem[] }
  | { kind: 'markdown'; title?: string; body: string }
  | { kind: 'image'; title?: string; b64?: string; url?: string; prompt?: string; alt?: string }
  | { kind: 'audio'; title?: string; b64?: string; url?: string; contentType?: string; script?: string }
  | { kind: 'video'; title?: string; url?: string; b64?: string; poster?: string; contentType?: string }
  | { kind: 'links'; title?: string; items: LinkItem[] }

export type AgentResultStatus = 'success' | 'partial' | 'error' | 'processing'

export type AgentResult = {
  status: AgentResultStatus
  agent: string // display name, e.g. "On-chain Analytics"
  headline?: string // one-line verdict, e.g. "BRETT healthy · LUNARPUP name is clear"
  blocks: RenderBlock[] // structured render payload
  summary: string // plain-text/markdown digest for orchestrator reasoning + synthesis
  // Two-phase async (slow agents — video): when status === 'processing', the
  // orchestrator polls `${endpoint}/result/${jobId}` until the result is ready.
  jobId?: string
  // What the agent provides, for provenance display.
  provenance?: string // e.g. "DexScreener + Base RPC (block 21,455,001)"
}

/**
 * Parse an agent's raw `output` string into an AgentResult. Tolerant: if the
 * agent returned plain text/markdown (legacy or fallback), wrap it as a single
 * markdown block so the UI still renders something sensible.
 */
export function parseAgentResult(
  raw: string,
  fallbackAgent = 'Agent',
  outputType: 'text' | 'image' | 'audio' | 'video' | 'json' = 'json',
): AgentResult {
  if (outputType === 'json') {
    try {
      const obj = JSON.parse(raw) as Partial<AgentResult>
      if (obj && Array.isArray(obj.blocks)) {
        return {
          status: obj.status ?? 'success',
          agent: obj.agent ?? fallbackAgent,
          headline: obj.headline,
          blocks: obj.blocks,
          summary: obj.summary ?? '',
          jobId: obj.jobId,
          provenance: obj.provenance,
        }
      }
    } catch {
      /* fall through to markdown wrap */
    }
  }
  return {
    status: 'success',
    agent: fallbackAgent,
    blocks: [{ kind: 'markdown', body: raw }],
    summary: raw,
  }
}

/**
 * Extract the text digest the orchestrator should feed to downstream agents and
 * the final synthesis. For structured JSON results this is `summary`; for binary
 * outputs (image/audio/video) it returns a short placeholder so base64 blobs
 * never pollute Venice prompts.
 */
export function extractSummary(
  raw: string,
  outputType: 'text' | 'image' | 'audio' | 'video' | 'json',
): string {
  if (outputType === 'json') {
    try {
      const obj = JSON.parse(raw) as Partial<AgentResult>
      if (obj && typeof obj.summary === 'string' && obj.summary.length > 0) {
        return obj.summary
      }
    } catch {
      /* not structured — fall through */
    }
  }
  if (outputType === 'image' || outputType === 'audio' || outputType === 'video') {
    return `[${outputType} asset generated — rendered in the UI]`
  }
  return raw
}
