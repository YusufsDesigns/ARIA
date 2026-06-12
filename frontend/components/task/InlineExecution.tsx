'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

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

type Payment = {
  agent: string
  capability: string
  amount: number
  txHash?: string
  timestamp: number
}

type AgentStep = {
  agentName: string
  capability: string
  amount: number
  status: 'running' | 'done' | 'failed'
  finding?: string
  outputType?: string
}

type Props = {
  taskId: string
  prompt: string
  budgetUsdc: number
}

const BASESCAN = 'https://sepolia.basescan.org/tx/'

// ─── Markdown renderer with full styling ────────────────────────────────────

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

// ─── Rich media renderer for JSON agent outputs ──────────────────────────────

type RichMediaPayload = {
  // visual-asset
  image?: string
  imageUrl?: string
  imagePrompt?: string
  brandIdentity?: unknown
  audioScript?: string
  audio?: string
  audioMimeType?: string
  // video-production
  videoUrl?: string
  videoBase64?: string
  videoMimeType?: string
  videoPrompt?: string
  durationSeconds?: number
  videoError?: string
}

function RichMediaOutput({ data }: { data: RichMediaPayload }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Image */}
      {(data.image || data.imageUrl) && (
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#FF6B35', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Generated Banner
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.imageUrl ?? `data:image/png;base64,${data.image}`}
            alt="Generated launch banner"
            style={{ width: '100%', maxWidth: 600, borderRadius: 8, border: '1px solid #2A2A2A', display: 'block' }}
          />
          {data.imagePrompt && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#555', marginTop: 6, lineHeight: 1.5, fontStyle: 'italic' }}>
              Prompt: {data.imagePrompt}
            </p>
          )}
        </div>
      )}

      {/* Audio announcement */}
      {data.audio && (
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#FF6B35', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Launch Announcement (TTS)
          </p>
          <audio
            controls
            src={`data:${data.audioMimeType ?? 'audio/mpeg'};base64,${data.audio}`}
            style={{ width: '100%', accentColor: '#FF6B35' }}
          />
          {data.audioScript && (
            <div style={{ marginTop: 8, padding: '10px 14px', background: '#0D0D0D', border: '1px solid #1A1A1A', borderRadius: 6 }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#888', lineHeight: 1.6, fontStyle: 'italic' }}>
                &ldquo;{data.audioScript}&rdquo;
              </p>
            </div>
          )}
        </div>
      )}

      {/* Video */}
      {(data.videoUrl || data.videoBase64) && !data.videoError && (
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#FF6B35', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Launch Video {data.durationSeconds ? `(${data.durationSeconds}s)` : ''}
          </p>
          <video
            controls
            playsInline
            src={data.videoUrl ?? `data:${data.videoMimeType ?? 'video/mp4'};base64,${data.videoBase64}`}
            style={{ width: '100%', maxWidth: 640, borderRadius: 8, border: '1px solid #2A2A2A', display: 'block', background: '#000' }}
          />
          {data.videoPrompt && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#555', marginTop: 6, lineHeight: 1.5, fontStyle: 'italic' }}>
              Prompt: {data.videoPrompt}
            </p>
          )}
        </div>
      )}

      {/* Video error (partial result) */}
      {data.videoError && (
        <div style={{ padding: '10px 14px', background: '#1A0000', border: '1px solid #3A1A1A', borderRadius: 6 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#EF4444' }}>
            Video generation failed: {data.videoError}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Generic finding renderer — dispatches by outputType ─────────────────────

function FindingRenderer({ finding, outputType }: { finding?: string; outputType?: string }) {
  if (!finding) return null

  // JSON output from visual-asset or video-production
  if (outputType === 'json') {
    let data: RichMediaPayload
    try {
      data = JSON.parse(finding) as RichMediaPayload
    } catch {
      return <MarkdownContent content={finding} />
    }
    return <RichMediaOutput data={data} />
  }

  // Raw image (base64 or URL)
  if (outputType === 'image') {
    const src = finding.startsWith('data:') || finding.startsWith('http')
      ? finding
      : `data:image/png;base64,${finding}`
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="Agent output" style={{ width: '100%', maxWidth: 600, borderRadius: 8, border: '1px solid #2A2A2A' }} />
    )
  }

  // Raw audio base64
  if (outputType === 'audio') {
    const src = finding.startsWith('data:') ? finding : `data:audio/mpeg;base64,${finding}`
    return <audio controls src={src} style={{ width: '100%', accentColor: '#FF6B35' }} />
  }

  // Raw video (URL or base64)
  if (outputType === 'video') {
    const src = finding.startsWith('http') ? finding : `data:video/mp4;base64,${finding}`
    return (
      <video controls playsInline src={src} style={{ width: '100%', maxWidth: 640, borderRadius: 8, border: '1px solid #2A2A2A', background: '#000' }} />
    )
  }

  // Default: treat as markdown text
  return <MarkdownContent content={finding} />
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InlineExecution({ taskId, prompt, budgetUsdc }: Props) {
  const [thoughts, setThoughts] = useState<string[]>([])
  const [agents, setAgents] = useState<AgentStep[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [privacyLogs, setPrivacyLogs] = useState<string[]>([])
  const [synthesis, setSynthesis] = useState<{ content: string; outputType?: string } | null>(null)
  const [budgetSpent, setBudgetSpent] = useState(0)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const es = new EventSource(`/api/task/${taskId}/stream`)
    eventSourceRef.current = es

    es.onmessage = (e) => {
      const event: TaskEvent = JSON.parse(e.data)
      switch (event.type) {
        case 'orchestrator_thinking':
          if (event.payload.message) {
            setThoughts((prev) => [...prev, event.payload.message!])
          }
          break
        case 'agent_hired':
          setAgents((prev) => [
            ...prev,
            {
              agentName: event.payload.agentName ?? 'Unknown',
              capability: event.payload.capability ?? '',
              amount: event.payload.amountUsdc ?? 0,
              status: 'running',
            },
          ])
          break
        case 'payment_confirmed':
          setPayments((prev) => [
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
        case 'finding_received':
          setAgents((prev) =>
            prev.map((a) =>
              a.capability === event.payload.capability
                ? {
                    ...a,
                    status: 'done',
                    finding: event.payload.finding ?? event.payload.output,
                    outputType: event.payload.outputType,
                  }
                : a
            )
          )
          break
        case 'privacy_log':
          if (event.payload.message) {
            setPrivacyLogs((prev) => [...prev, event.payload.message!])
          }
          break
        case 'budget_update':
          setBudgetSpent(event.payload.budgetSpent ?? 0)
          break
        case 'synthesis_complete':
          setSynthesis({
            content: event.payload.finding ?? event.payload.output ?? '',
            outputType: event.payload.outputType,
          })
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

    es.onerror = () => {
      if (!done) es.close()
    }

    return () => es.close()
  }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  const doneAgents = agents.filter((a) => a.status === 'done' && a.finding)

  return (
    <div style={{ width: '100%', maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Original prompt */}
      <div style={{ background: '#1A1A1A', border: '1px solid #4A4A4A', borderRadius: 8, padding: '16px 20px' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: '#FF6B35', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Your Task</p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: '#FFF', lineHeight: 1.5 }}>{prompt}</p>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#888' }}>Budget: {budgetUsdc} USDC</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#888' }}>Spent: {budgetSpent.toFixed(2)} USDC</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: budgetUsdc - budgetSpent < 2 ? '#EF4444' : '#888' }}>
            Remaining: {(budgetUsdc - budgetSpent).toFixed(2)} USDC
          </span>
        </div>
      </div>

      {/* Orchestrator thinking */}
      {thoughts.length > 0 && (
        <Section label="ARIA ORCHESTRATOR">
          {thoughts.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid #1A1A1A' }}>
              <span style={{ color: '#FF6B35', fontSize: 14, marginTop: 1 }}>›</span>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#CCC', lineHeight: 1.5 }}>{t}</p>
            </div>
          ))}
          {!done && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0' }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#FF6B35',
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
              <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
            </div>
          )}
        </Section>
      )}

      {/* Agent plan */}
      {agents.length > 0 && (
        <Section label="AGENT PLAN">
          {agents.map((a, i) => (
            <div key={i} style={{
              borderRadius: 6,
              background: a.status === 'done' ? '#0D1A0D' : '#1A1A1A',
              border: `1px solid ${a.status === 'done' ? '#22C55E33' : a.status === 'failed' ? '#EF444433' : '#4A4A4A'}`,
              marginBottom: 6,
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
                <span style={{ fontSize: 16, color: a.status === 'done' ? '#22C55E' : a.status === 'failed' ? '#EF4444' : '#FF6B35' }}>
                  {a.status === 'done' ? '✓' : a.status === 'failed' ? '✗' : '⟳'}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: '#FFF' }}>{a.agentName}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#888', marginTop: 2 }}>{a.capability}</p>
                </div>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#FF6B35' }}>
                  {a.amount.toFixed(2)} USDC
                </span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Payment ledger */}
      {payments.length > 0 && (
        <Section label="LIVE PAYMENTS">
          {payments.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #1A1A1A' }}>
              <span style={{ color: '#22C55E', fontSize: 10 }}>●</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#CCC', flex: 1 }}>{p.agent}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#FF6B35', fontVariantNumeric: 'tabular-nums' }}>
                {p.amount.toFixed(2)} USDC
              </span>
              {p.txHash && (
                <a
                  href={`${BASESCAN}${p.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#3B82F6' }}
                >
                  ↗ BaseScan
                </a>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Per-agent findings — renders inline as each agent completes */}
      {doneAgents.map((a, i) => (
        <Section key={i} label={`${a.agentName.toUpperCase()} — FINDINGS`}>
          <FindingRenderer finding={a.finding} outputType={a.outputType} />
        </Section>
      ))}

      {/* Privacy section */}
      {privacyLogs.length > 0 && (
        <Section label="PRIVACY PROTECTION">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#0D0000', border: '1px solid #3A1A1A', padding: '16px', opacity: 0.7 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#EF4444', marginBottom: 12 }}>
                Standard AI Platforms
              </p>
              {['Your prompts logged', 'Data used for model training', 'Competitor data exposed', 'Business strategy visible to AI company'].map((item) => (
                <div key={item} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <span style={{ color: '#EF4444', fontSize: 12, flexShrink: 0 }}>✗</span>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#666' }}>{item}</p>
                </div>
              ))}
            </div>
            <div style={{ background: '#001A0D', border: '1px solid #22C55E44', padding: '16px' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#22C55E', marginBottom: 12 }}>
                ARIA × Venice AI
              </p>
              {['Zero data retention', 'Zero training on your data', 'Private by architectural design', 'Privacy receipt after every task'].map((item) => (
                <div key={item} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <span style={{ color: '#22C55E', fontSize: 12, flexShrink: 0 }}>✓</span>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#ccc' }}>{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1A1A1A', paddingTop: 12 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Live Zero-Retention Log
            </p>
            {privacyLogs.map((log, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
                <span style={{ fontSize: 12 }}>🔒</span>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#555' }}>{log}</p>
              </div>
            ))}
          </div>

          {done && (
            <div style={{ marginTop: 16, background: '#050505', border: '1px solid #1A1A1A', padding: '16px', fontFamily: 'monospace', fontSize: 11, color: '#555', lineHeight: 1.8 }}>
              <p style={{ color: '#FF6B35', marginBottom: 8, fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Task Privacy Receipt
              </p>
              <p>Task ID: {taskId.slice(0, 8)}…</p>
              <p>Venice AI Calls: {privacyLogs.length}</p>
              <p>Data Retained: <span style={{ color: '#22C55E' }}>0 bytes</span></p>
              <p>Training Data Shared: <span style={{ color: '#22C55E' }}>None</span></p>
              <p style={{ marginTop: 8, color: '#333', fontFamily: 'var(--font-body)', fontSize: 10 }}>
                All data processed by Venice zero-retention infrastructure and permanently deleted.
              </p>
            </div>
          )}
        </Section>
      )}

      {/* Error */}
      {failed && (
        <Section label="ERROR">
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#EF4444' }}>{failed}</p>
        </Section>
      )}

      {/* Final synthesis */}
      {synthesis && (
        <Section label="FINAL SYNTHESIS">
          <FindingRenderer finding={synthesis.content} outputType={synthesis.outputType ?? 'text'} />
        </Section>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #2A2A2A', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: '#0D0D0D', padding: '8px 16px', borderBottom: '1px solid #2A2A2A' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#FF6B35', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {label}
        </p>
      </div>
      <div style={{ padding: '12px 16px' }}>
        {children}
      </div>
    </div>
  )
}
