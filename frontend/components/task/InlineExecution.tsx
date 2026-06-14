'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { AgentResultView } from './AgentResultView'

type TaskEvent = {
  type: string
  payload: {
    agentName?: string
    capability?: string
    amountUsdc?: number
    txHash?: string
    finding?: string
    outputType?: string
    output?: string
    message?: string
    budgetSpent?: number
    budgetRemaining?: number
  }
  timestamp: number
}

export type Payment = {
  agent: string
  capability: string
  amount: number
  txHash?: string
  timestamp: number
}

export type AgentStep = {
  agentName: string
  capability: string
  amount: number
  status: 'running' | 'done' | 'failed'
  finding?: string
  outputType?: string
  progress?: string
  isPaid: boolean
  isFallback: boolean
}

// True when a finding is a structured ARIA AgentResult (has a `blocks` array).
function isStructured(finding?: string, outputType?: string): boolean {
  if (!finding || outputType !== 'json') return false
  try {
    const o = JSON.parse(finding)
    return Array.isArray(o?.blocks)
  } catch {
    return false
  }
}

type Props = {
  taskId: string
  onBudgetUpdate?: (spent: number) => void
  // When false, render from `initial` only and do not open the SSE stream
  // (used when revisiting an already-completed task loaded from the DB).
  live?: boolean
  initial?: {
    agents?: AgentStep[]
    payments?: Payment[]
    synthesis?: { content: string; outputType?: string } | null
  }
}

const BASESCAN = 'https://sepolia.basescan.org/tx/'

// ─── Markdown renderer ────────────────────────────────────────────────────────

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: '#FFFFFF', marginTop: 24, marginBottom: 12, borderBottom: '1px solid #2A2A2A', paddingBottom: 8 }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#FFFFFF', marginTop: 20, marginBottom: 10 }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: '#FF6B35', marginTop: 16, marginBottom: 8 }}>{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: '#FFA07A', marginTop: 12, marginBottom: 6 }}>{children}</h4>
  ),
  p: ({ children }) => (
    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#CCC', lineHeight: 1.7, marginBottom: 12 }}>{children}</p>
  ),
  strong: ({ children }) => (
    <strong style={{ color: '#FFFFFF', fontWeight: 600 }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ color: '#AAA', fontStyle: 'italic' }}>{children}</em>
  ),
  ul: ({ children }) => (
    <ul style={{ paddingLeft: 20, marginBottom: 12, listStyleType: 'disc' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: 20, marginBottom: 12, listStyleType: 'decimal' }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#CCC', lineHeight: 1.6, marginBottom: 4 }}>{children}</li>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return (
        <pre style={{ background: '#0D0D0D', border: '1px solid #2A2A2A', borderRadius: 6, padding: '12px 16px', overflowX: 'auto', marginBottom: 12 }}>
          <code style={{ fontFamily: 'monospace', fontSize: 12, color: '#A3E635', lineHeight: 1.6 }}>{children}</code>
        </pre>
      )
    }
    return (
      <code style={{ fontFamily: 'monospace', fontSize: 12, color: '#FF6B35', background: '#1A1A1A', padding: '2px 6px', borderRadius: 3 }}>{children}</code>
    )
  },
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: '3px solid #FF6B35', paddingLeft: 16, marginLeft: 0, marginBottom: 12, opacity: 0.8 }}>{children}</blockquote>
  ),
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid #2A2A2A', margin: '16px 0' }} />
  ),
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: 13 }}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr style={{ borderBottom: '1px solid #2A2A2A' }}>{children}</tr>
  ),
  th: ({ children }) => (
    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#FF6B35', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#0D0D0D' }}>{children}</th>
  ),
  td: ({ children }) => (
    <td style={{ padding: '8px 12px', color: '#CCC', borderBottom: '1px solid #1A1A1A' }}>{children}</td>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6', textDecoration: 'underline' }}>{children}</a>
  ),
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {content}
    </ReactMarkdown>
  )
}

// ─── Rich media renderer ──────────────────────────────────────────────────────

type RichMediaPayload = {
  image?: string
  imageUrl?: string
  imagePrompt?: string
  audioScript?: string
  audio?: string
  audioMimeType?: string
  videoUrl?: string
  videoBase64?: string
  videoMimeType?: string
  videoPrompt?: string
  durationSeconds?: number
  videoError?: string
  text?: string
}

function RichMediaOutput({ data }: { data: RichMediaPayload }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {(data.image || data.imageUrl) && (
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#FF6B35', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Generated Image</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.imageUrl ?? `data:image/png;base64,${data.image}`}
            alt="Generated output"
            style={{ width: '100%', maxWidth: 500, borderRadius: 8, border: '1px solid #2A2A2A', display: 'block' }}
          />
          {data.imagePrompt && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#555', marginTop: 6, lineHeight: 1.5, fontStyle: 'italic' }}>
              Prompt: {data.imagePrompt}
            </p>
          )}
        </div>
      )}
      {data.audio && (
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#FF6B35', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Audio Announcement</p>
          <audio controls src={`data:${data.audioMimeType ?? 'audio/mpeg'};base64,${data.audio}`} style={{ width: '100%', accentColor: '#FF6B35' }} />
          {data.audioScript && (
            <div style={{ marginTop: 8, padding: '10px 14px', background: '#0D0D0D', border: '1px solid #1A1A1A', borderRadius: 6 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#888', lineHeight: 1.6, fontStyle: 'italic' }}>
                &ldquo;{data.audioScript}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}
      {(data.videoUrl || data.videoBase64) && !data.videoError && (
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#FF6B35', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Launch Video {data.durationSeconds ? `(${data.durationSeconds}s)` : ''}
          </p>
          <video
            controls playsInline
            src={data.videoUrl ?? `data:${data.videoMimeType ?? 'video/mp4'};base64,${data.videoBase64}`}
            style={{ width: '100%', maxWidth: 580, borderRadius: 8, border: '1px solid #2A2A2A', display: 'block', background: '#000' }}
          />
        </div>
      )}
      {data.videoError && (
        <div style={{ padding: '10px 14px', background: '#1A0000', border: '1px solid #3A1A1A', borderRadius: 6 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#EF4444' }}>Video generation failed: {data.videoError}</p>
        </div>
      )}
      {data.text && <MarkdownContent content={data.text} />}
    </div>
  )
}

function FindingRenderer({ finding, outputType }: { finding?: string; outputType?: string }) {
  if (!finding) return null

  if (outputType === 'json') {
    let data: RichMediaPayload
    try { data = JSON.parse(finding) as RichMediaPayload } catch { return <MarkdownContent content={finding} /> }
    return <RichMediaOutput data={data} />
  }

  if (outputType === 'image') {
    const src = finding.startsWith('data:') || finding.startsWith('http') ? finding : `data:image/png;base64,${finding}`
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="Generated output" style={{ width: '100%', maxWidth: 500, borderRadius: 8, border: '1px solid #2A2A2A' }} />
  }

  if (outputType === 'audio') {
    const src = finding.startsWith('data:') ? finding : `data:audio/mpeg;base64,${finding}`
    return <audio controls src={src} style={{ width: '100%', accentColor: '#FF6B35' }} />
  }

  if (outputType === 'video') {
    const src = finding.startsWith('http') ? finding : `data:video/mp4;base64,${finding}`
    return <video controls playsInline src={src} style={{ width: '100%', maxWidth: 580, borderRadius: 8, border: '1px solid #2A2A2A', background: '#000' }} />
  }

  return <MarkdownContent content={finding} />
}

// ─── Shorten a text finding to a preview snippet ─────────────────────────────

function shortPreview(text: string, max = 120): string {
  if (!text) return ''
  const flat = text.replace(/\n+/g, ' ').replace(/#+\s*/g, '').replace(/\*\*/g, '').trim()
  if (flat.length <= max) return flat
  return flat.slice(0, max).trimEnd() + '...'
}

// ─── Agent row — expandable finding preview (dim), full content in synthesis ──

function AgentRow({ agent }: { agent: AgentStep }) {
  const structured = isStructured(agent.finding, agent.outputType)
  // Collapsed by default — the final answer is the place to read; each row is a
  // verifiable source you can open. Keeps the page from being overwhelming.
  const [open, setOpen] = useState(false)
  const hasFinding = !!agent.finding
  const done = agent.status !== 'running'
  // Raw media findings (image/audio/video) come from orchestrator fallbacks, which
  // return a bare base64/url payload rather than a structured AgentResult.
  const isMedia = !structured && (agent.outputType === 'image' || agent.outputType === 'audio' || agent.outputType === 'video')
  // Any completed finding is expandable; the detail renders only when opened.
  const expandable = hasFinding && done

  // One-line headline pulled from a structured result, for the collapsed preview.
  let headline: string | null = null
  if (structured && agent.finding) {
    try { headline = (JSON.parse(agent.finding) as { headline?: string }).headline ?? null } catch { /* ignore */ }
  }

  const isFallback = agent.isFallback
  const bgColor = agent.status === 'failed'
    ? '#0D0000'
    : agent.status === 'done' && agent.isPaid
    ? '#0D1500'
    : isFallback && agent.status === 'done'
    ? '#0A0900'
    : '#0A0A0A'
  const borderColor = agent.status === 'failed'
    ? '#EF444422'
    : agent.status === 'done' && agent.isPaid
    ? '#22C55E22'
    : isFallback && agent.status === 'done'
    ? '#FF6B3518'
    : '#1A1A1A'
  const nameColor = agent.status === 'failed' ? '#EF4444' : '#DDD'
  const capColor = '#666'

  const statusIcon = agent.status === 'running'
    ? null
    : agent.status === 'failed'
    ? <span style={{ color: '#EF4444', fontSize: 11, flexShrink: 0 }}>✗</span>
    : agent.isPaid
    ? <span style={{ color: '#22C55E', fontSize: 11, flexShrink: 0 }}>✓</span>
    : <span style={{ color: '#444', fontSize: 11, flexShrink: 0 }}>↪</span>

  // Preview text shown while collapsed. Running → live progress; structured →
  // its headline; media → asset label; text → a snippet.
  const preview = agent.status === 'running' && agent.progress
    ? agent.progress
    : headline
    ? headline
    : isMedia && hasFinding
    ? `${agent.outputType} asset generated — click to view`
    : hasFinding && agent.outputType === 'text'
    ? shortPreview(agent.finding!)
    : null

  return (
    <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 6, overflow: 'hidden', marginBottom: 3 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
          cursor: expandable ? 'pointer' : 'default',
        }}
        onClick={() => expandable && setOpen(o => !o)}
      >
        {/* Status */}
        <span style={{ flexShrink: 0, width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {agent.status === 'running' ? (
            <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#FF6B35', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </span>
          ) : statusIcon}
        </span>

        {/* Name + capability + preview */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: nameColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {agent.agentName}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: capColor, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {agent.capability}
          </p>
          {/* Preview visible when collapsed */}
          {preview && !open && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#777', marginTop: 3, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {preview}
            </p>
          )}
        </div>

        {/* Right badge */}
        {agent.isPaid && agent.status !== 'failed' ? (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: '#FF6B35', flexShrink: 0 }}>
            {agent.amount.toFixed(2)} USDC
          </span>
        ) : isFallback ? (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#FF6B35', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0, border: '1px solid #FF6B3530', padding: '2px 6px', borderRadius: 3 }}>
            orchestrator
          </span>
        ) : null}

        {/* Expand toggle — present whenever there's content to reveal */}
        {expandable && (
          <span style={{ fontSize: 8, color: '#555', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }}>▶</span>
        )}
      </div>

      {/* Detail — collapsed by default; renders the right view for the finding type */}
      {expandable && open && (
        <div style={{ padding: '16px 16px 18px', borderTop: '1px solid #161616', background: '#070707' }}>
          {structured ? (
            <AgentResultView output={agent.finding!} />
          ) : isMedia ? (
            <FindingRenderer finding={agent.finding} outputType={agent.outputType} />
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#999', lineHeight: 1.7, fontStyle: 'italic' }}>
              {agent.finding!.replace(/#+\s*/g, '').replace(/\*\*/g, '').slice(0, 800)}
              {agent.finding!.length > 800 ? '…' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function CollapsibleSection({
  label,
  children,
  defaultOpen = true,
  statusLine,
  running = false,
}: {
  label: string
  children: React.ReactNode
  defaultOpen?: boolean
  statusLine?: string
  running?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{ border: '1px solid #2A2A2A', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: '#0D0D0D', padding: '8px 16px',
          borderBottom: open ? '1px solid #2A2A2A' : 'none',
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', border: 'none', textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#555', letterSpacing: '0.06em', transition: 'transform 150ms', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#FF6B35', letterSpacing: '0.15em', textTransform: 'uppercase', flex: 1 }}>{label}</span>
        {!open && statusLine && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#555', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {statusLine}
          </span>
        )}
        {running && (
          <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#FF6B35', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </span>
        )}
      </button>
      {open && <div style={{ padding: '12px 16px' }}>{children}</div>}
      <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ background: '#0D0D0D', padding: '8px 16px', borderBottom: '1px solid #2A2A2A' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#FF6B35', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{label}</p>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #2A2A2A', borderRadius: 8, overflow: 'hidden' }}>
      <SectionHeader label={label} />
      <div style={{ padding: '12px 16px' }}>{children}</div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InlineExecution({ taskId, onBudgetUpdate, live = true, initial }: Props) {
  const [thoughts, setThoughts] = useState<string[]>([])
  const [agents, setAgents] = useState<AgentStep[]>(initial?.agents ?? [])
  const [payments, setPayments] = useState<Payment[]>(initial?.payments ?? [])
  const [veniceCallCount, setVeniceCallCount] = useState(0)
  const [synthesis, setSynthesis] = useState<{ content: string; outputType?: string } | null>(initial?.synthesis ?? null)
  const [done, setDone] = useState(!live)
  const [failed, setFailed] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!live) return // revisiting a completed task — render from `initial`, no stream
    const es = new EventSource(`/api/task/${taskId}/stream`)

    es.onmessage = (e) => {
      const event: TaskEvent = JSON.parse(e.data)
      switch (event.type) {
        case 'orchestrator_thinking':
          if (event.payload.message) setThoughts(prev => [...prev, event.payload.message!])
          break

        case 'agent_hired': {
          const amountUsdc = event.payload.amountUsdc ?? 0
          const name = event.payload.agentName ?? 'Unknown'
          const isFallback = name.startsWith('↪') || amountUsdc === 0
          setAgents(prev => [
            ...prev,
            {
              agentName: name,
              capability: event.payload.capability ?? '',
              amount: amountUsdc,
              status: 'running',
              isPaid: amountUsdc > 0,
              isFallback,
            },
          ])
          break
        }

        case 'payment_confirmed':
          setPayments(prev => [
            ...prev,
            {
              agent: event.payload.agentName ?? 'Agent',
              capability: event.payload.capability ?? '',
              amount: event.payload.amountUsdc ?? 0,
              txHash: event.payload.txHash,
              timestamp: event.timestamp,
            },
          ])
          break

        case 'agent_failed':
          // Mark the paid agent that failed (x402 error) as failed in the plan
          setAgents(prev =>
            prev.map(a =>
              a.capability === event.payload.capability && a.isPaid && a.status === 'running'
                ? { ...a, status: 'failed' }
                : a
            )
          )
          break

        case 'agent_progress': {
          // Async agents (e.g. Video) stream render progress while we poll /result
          const msg = event.payload.message
          setAgents(prev => {
            const running = [...prev].reverse().find(
              a => a.capability === event.payload.capability && a.status === 'running'
            )
            return prev.map(a => (a === running ? { ...a, progress: msg } : a))
          })
          break
        }

        case 'finding_received': {
          const finding = event.payload.finding ?? event.payload.output
          const outputType = event.payload.outputType
          // Update the most-recently-added 'running' entry for this capability.
          // This handles the case where a paid agent failed and a fallback was added
          // — we want to update the fallback row, not the already-failed paid row.
          setAgents(prev => {
            const running = [...prev].reverse().find(
              a => a.capability === event.payload.capability && a.status === 'running'
            )
            return prev.map(a =>
              a === running ? { ...a, status: 'done', finding, outputType } : a
            )
          })
          break
        }

        case 'privacy_log':
          setVeniceCallCount(n => n + 1)
          break

        case 'budget_update':
          onBudgetUpdate?.(event.payload.budgetSpent ?? 0)
          break

        case 'synthesis_complete':
          setSynthesis({ content: event.payload.finding ?? event.payload.output ?? '', outputType: event.payload.outputType })
          setDone(true)
          es.close()
          break

        case 'task_failed':
          setFailed(event.payload.message ?? 'Unknown error')
          setDone(true)
          es.close()
          break
      }

      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    es.onerror = () => { if (!done) es.close() }
    return () => es.close()
  }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  const lastThought = thoughts[thoughts.length - 1]
  const paidPayments = payments.filter(p => p.amount > 0)
  const doneCount = agents.filter(a => a.status === 'done').length

  return (
    <div style={{ width: '100%', maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Orchestrator reasoning — collapsible, collapses once done */}
      {thoughts.length > 0 && (
        <CollapsibleSection
          label="ARIA ORCHESTRATOR"
          defaultOpen={!done}
          statusLine={lastThought}
          running={!done}
        >
          {thoughts.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '5px 0', borderBottom: '1px solid #111' }}>
              <span style={{ color: '#FF6B35', fontSize: 14, marginTop: 1, flexShrink: 0 }}>›</span>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#AAA', lineHeight: 1.5 }}>{t}</p>
            </div>
          ))}
          {!done && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF6B35', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Unified agent plan — paid agents + orchestrator fallbacks in one list */}
      {agents.length > 0 && (
        <div style={{ border: '1px solid #2A2A2A', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#0D0D0D', padding: '8px 16px', borderBottom: '1px solid #2A2A2A', display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#FF6B35', letterSpacing: '0.15em', textTransform: 'uppercase', flex: 1 }}>
              AGENT PLAN
            </p>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#444' }}>
              {doneCount}/{agents.length} complete
            </span>
            {!done && agents.some(a => a.status === 'running') && (
              <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#FF6B35', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </span>
            )}
          </div>
          <div style={{ padding: '8px 12px' }}>
            {agents.map((a, i) => <AgentRow key={i} agent={a} />)}
          </div>
        </div>
      )}

      {/* Live payments — real x402 payments only */}
      {paidPayments.length > 0 && (
        <div style={{ border: '1px solid #1A1A1A', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#080808', padding: '6px 14px', borderBottom: '1px solid #151515' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#333', letterSpacing: '0.15em', textTransform: 'uppercase' }}>x402 PAYMENTS</p>
          </div>
          <div style={{ padding: '8px 14px' }}>
            {paidPayments.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < paidPayments.length - 1 ? '1px solid #111' : 'none' }}>
                <span style={{ color: '#22C55E', fontSize: 8, flexShrink: 0 }}>●</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.agent}</p>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: '#FF6B35', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {p.amount.toFixed(2)} USDC
                </span>
                {p.txHash ? (
                  <a href={`${BASESCAN}${p.txHash}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#3B82F6', flexShrink: 0, letterSpacing: '0.06em' }}>
                    ↗ BaseScan
                  </a>
                ) : (
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#22C55E', flexShrink: 0, letterSpacing: '0.06em' }}>
                    ✓ Paid
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {failed && (
        <Section label="ERROR">
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#EF4444' }}>{failed}</p>
        </Section>
      )}

      {/* Final synthesis — the star of the show */}
      {synthesis && (
        <div style={{ border: '1px solid #FF6B3540', borderRadius: 8, overflow: 'hidden', background: '#070400' }}>
          <div style={{ background: '#0F0800', padding: '14px 20px', borderBottom: '1px solid #FF6B3520', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>✦</span>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: '#FF6B35', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                ARIA&apos;S ANSWER
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#444', marginTop: 3 }}>
                Synthesised from {agents.filter(a => a.isPaid && a.status === 'done').length} specialist agents · all findings combined
              </p>
            </div>
          </div>
          <div style={{ padding: '24px 24px' }}>
            {isStructured(synthesis.content, synthesis.outputType) ? (
              <AgentResultView output={synthesis.content} />
            ) : (
              <FindingRenderer finding={synthesis.content} outputType={synthesis.outputType ?? 'text'} />
            )}
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#444', marginTop: 18 }}>
              Each contributing agent&apos;s raw output is collapsed in the Agent Plan above — expand any row to verify the source data.
            </p>
          </div>
        </div>
      )}

      {/* Privacy receipt */}
      {done && veniceCallCount > 0 && (
        <div style={{
          padding: '10px 16px',
          background: '#050505',
          border: '1px solid #1A1A1A',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13 }}>🔒</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Privacy Receipt
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#333', flex: 1 }}>
            {veniceCallCount} Venice AI calls · <span style={{ color: '#22C55E' }}>0 bytes retained</span> · Training data: <span style={{ color: '#22C55E' }}>None</span>
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
