// ARIA structured agent result — keep in sync with frontend/lib/agent-result.ts
export type Tone = 'good' | 'bad' | 'warn' | 'neutral'

export type MetricItem = { label: string; value: string; sub?: string; tone?: Tone; href?: string }
export type BadgeItem = { label: string; tone: Tone; detail?: string }
export type LinkItem = { label: string; href: string }

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
  agent: string
  headline?: string
  blocks: RenderBlock[]
  summary: string
  jobId?: string
  provenance?: string
}
