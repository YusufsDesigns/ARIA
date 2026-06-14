'use client'

import { useState, useMemo, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parseAgentResult, type AgentResult, type RenderBlock, type Tone } from '@/lib/agent-result'

const TONE: Record<Tone, string> = {
  good: '#22C55E',
  bad: '#EF4444',
  warn: '#F59E0B',
  neutral: '#9A9A9A',
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#FF6B35', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
      {children}
    </p>
  )
}

function Markdown({ content }: { content: string }) {
  return (
    <div style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: '#C8C8C8', lineHeight: 1.7 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#fff', margin: '16px 0 6px' }}>{children}</p>,
          h3: ({ children }) => <p style={{ fontFamily: 'var(--font-display)', fontSize: 12.5, color: '#EEE', margin: '12px 0 4px' }}>{children}</p>,
          p: ({ children }) => <p style={{ margin: '0 0 9px' }}>{children}</p>,
          ul: ({ children }) => <ul style={{ margin: '0 0 9px', paddingLeft: 18 }}>{children}</ul>,
          li: ({ children }) => <li style={{ margin: '0 0 4px' }}>{children}</li>,
          strong: ({ children }) => <strong style={{ color: '#fff', fontWeight: 600 }}>{children}</strong>,
          em: ({ children }) => <em style={{ color: '#FF8C5A' }}>{children}</em>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }}>{children}</a>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function MetricsBlock({ block }: { block: Extract<RenderBlock, { kind: 'metrics' }> }) {
  return (
    <div>
      <BlockTitle>{block.title}</BlockTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        {block.items.map((m, i) => {
          const color = m.tone ? TONE[m.tone] : '#EDEDED'
          const value = (
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{m.value}</span>
          )
          return (
            <div key={i} style={{ background: '#0B0B0B', border: '1px solid #1C1C1C', borderRadius: 8, padding: '11px 12px' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 8.5, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{m.label}</p>
              {m.href ? (
                <a href={m.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  {value}<span style={{ color: '#3B82F6', fontSize: 10, marginLeft: 4 }}>↗</span>
                </a>
              ) : value}
              {m.sub && <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#5A5A5A', marginTop: 4 }}>{m.sub}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BadgesBlock({ block }: { block: Extract<RenderBlock, { kind: 'badges' }> }) {
  return (
    <div>
      <BlockTitle>{block.title}</BlockTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {block.items.map((b, i) => {
          const color = TONE[b.tone]
          return (
            <div key={i} title={b.detail} style={{ display: 'flex', flexDirection: 'column', gap: 2, border: `1px solid ${color}40`, background: `${color}0D`, borderRadius: 7, padding: '7px 11px', maxWidth: 260 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 11.5, color: '#E8E8E8' }}>{b.label}</span>
              </span>
              {b.detail && <span style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, color: '#777', lineHeight: 1.4 }}>{b.detail}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TableBlock({ block }: { block: Extract<RenderBlock, { kind: 'table' }> }) {
  return (
    <div>
      <BlockTitle>{block.title}</BlockTitle>
      <div style={{ overflowX: 'auto', border: '1px solid #1C1C1C', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#0F0800' }}>
              {block.columns.map((c, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '8px 12px', fontFamily: 'var(--font-display)', fontSize: 9, color: '#FF6B35', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1C1C1C', whiteSpace: 'nowrap' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 ? '#0A0A0A' : 'transparent' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '8px 12px', color: ci === 0 ? '#EDEDED' : '#A8A8A8', borderBottom: ri < block.rows.length - 1 ? '1px solid #141414' : 'none', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontFamily: ci === 0 ? 'var(--font-display)' : 'var(--font-body)' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ImageBlock({ block }: { block: Extract<RenderBlock, { kind: 'image' }> }) {
  const [showPrompt, setShowPrompt] = useState(false)
  const src = block.url ?? (block.b64 ? `data:image/png;base64,${block.b64}` : null)
  if (!src) return null
  return (
    <div>
      <BlockTitle>{block.title ?? 'Generated image'}</BlockTitle>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={block.alt ?? 'Generated image'} style={{ width: '100%', maxWidth: 520, borderRadius: 10, border: '1px solid #242424', display: 'block' }} />
      {block.prompt && (
        <button onClick={() => setShowPrompt(s => !s)} style={{ marginTop: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 9, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', padding: 0 }}>
          {showPrompt ? '− Hide prompt' : '+ View generation prompt'}
        </button>
      )}
      {showPrompt && block.prompt && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#666', marginTop: 6, lineHeight: 1.5, fontStyle: 'italic', maxWidth: 520 }}>{block.prompt}</p>
      )}
    </div>
  )
}

function AudioBlock({ block }: { block: Extract<RenderBlock, { kind: 'audio' }> }) {
  const src = block.url ?? (block.b64 ? `data:${block.contentType ?? 'audio/mpeg'};base64,${block.b64}` : null)
  if (!src) return null
  return (
    <div>
      <BlockTitle>{block.title ?? 'Audio'}</BlockTitle>
      <audio controls src={src} style={{ width: '100%', maxWidth: 520, accentColor: '#FF6B35' }} />
      {block.script && (
        <div style={{ marginTop: 8, padding: '10px 14px', background: '#0B0B0B', border: '1px solid #1A1A1A', borderRadius: 8, maxWidth: 520 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: '#9A9A9A', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{block.script}&rdquo;</p>
        </div>
      )}
    </div>
  )
}

function VideoBlock({ block }: { block: Extract<RenderBlock, { kind: 'video' }> }) {
  // Prefer a blob URL built from the returned bytes: blob URLs support range
  // requests/seeking (a raw base64 data-URI often won't actually play), and it
  // bypasses agent URLs that may point at an unreachable host (e.g. localhost).
  // Falls back to a direct URL only when no bytes were returned.
  const blobUrl = useMemo(() => {
    if (!block.b64) return null
    try {
      const bin = atob(block.b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return URL.createObjectURL(new Blob([bytes], { type: block.contentType ?? 'video/mp4' }))
    } catch {
      return null
    }
  }, [block.b64, block.contentType])
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }, [blobUrl])

  const src = blobUrl ?? block.url ?? null
  if (!src) return null
  return (
    <div>
      <BlockTitle>{block.title ?? 'Video'}</BlockTitle>
      <video controls playsInline poster={block.poster} src={src} style={{ width: '100%', maxWidth: 580, borderRadius: 10, border: '1px solid #242424', display: 'block', background: '#000' }} />
    </div>
  )
}

function LinksBlock({ block }: { block: Extract<RenderBlock, { kind: 'links' }> }) {
  return (
    <div>
      <BlockTitle>{block.title}</BlockTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {block.items.map((l, i) => (
          <a key={i} href={l.href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #1F2A3A', background: '#0A1018', borderRadius: 6, padding: '5px 10px', fontFamily: 'var(--font-display)', fontSize: 10.5, color: '#5B9BF3', textDecoration: 'none', letterSpacing: '0.03em' }}>
            {l.label} <span style={{ fontSize: 10 }}>↗</span>
          </a>
        ))}
      </div>
    </div>
  )
}

function Block({ block }: { block: RenderBlock }) {
  switch (block.kind) {
    case 'metrics': return <MetricsBlock block={block} />
    case 'badges': return <BadgesBlock block={block} />
    case 'table': return <TableBlock block={block} />
    case 'image': return <ImageBlock block={block} />
    case 'audio': return <AudioBlock block={block} />
    case 'video': return <VideoBlock block={block} />
    case 'links': return <LinksBlock block={block} />
    case 'markdown':
      return (
        <div>
          <BlockTitle>{block.title}</BlockTitle>
          <Markdown content={block.body} />
        </div>
      )
    default:
      return null
  }
}

/**
 * Renders a structured ARIA AgentResult (the rich, branded per-agent output).
 * Accepts either a parsed result or the raw `output` JSON string.
 */
export function AgentResultView({ output, result }: { output?: string; result?: AgentResult }) {
  const data = result ?? (output ? parseAgentResult(output, 'Agent', 'json') : null)
  if (!data) return null
  const processing = data.status === 'processing'
  const partial = data.status === 'partial'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {(data.headline || data.provenance) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.headline && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: '#EDEDED', lineHeight: 1.5 }}>
              {processing && <span style={{ marginRight: 8, color: '#F59E0B' }}>◐</span>}
              {data.headline}
            </p>
          )}
          {data.provenance && (
            <p style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-display)', fontSize: 9, color: '#3E6B3E', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <span style={{ color: '#22C55E' }}>✓ verifiable</span>
              <span style={{ color: '#444' }}>·</span>
              <span style={{ color: '#5A5A5A', letterSpacing: '0.02em', textTransform: 'none', fontFamily: 'var(--font-body)', fontSize: 11 }}>{data.provenance}</span>
            </p>
          )}
        </div>
      )}

      {processing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#140E00', border: '1px solid #F59E0B30', borderRadius: 7 }}>
          <span style={{ display: 'flex', gap: 3 }}>
            {[0, 1, 2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#F59E0B', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#C99A4A' }}>Working in the background — partial results shown below</span>
        </div>
      )}

      {data.blocks.map((b, i) => <Block key={i} block={b} />)}

      {partial && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#8A6A3A', fontStyle: 'italic' }}>
          Delivered partial output — one sub-step did not complete.
        </p>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
    </div>
  )
}
