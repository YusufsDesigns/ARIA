'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useWalletGuard } from '@/hooks/useWalletGuard'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { InlineExecution } from '@/components/task/InlineExecution'
import { SmokeBackground } from '@/components/ui/smoke-background'

const QUICK_PROMPTS = [
  'Launch a memecoin called MOONCAT on Base',
  'Research the top DeFi protocols by TVL',
  'Analyse Uniswap v4 competition',
  'Create a Web3 gaming campaign',
]

const BUDGET_PRESETS = [5, 10, 15]

// ─── Full-viewport centered layout (shared by pre-connect and pre-task views) ──
function CenteredLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      background: '#000',
    }}>
      <SmokeBackground smokeColor="#FF6B35" />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 680, padding: '0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Wallet guard screen ──────────────────────────────────────────────────────
function WalletGuard({ onConnected }: { onConnected: (addr: string) => void }) {
  return (
    <CenteredLayout>
      <Image
        src="/Logo.png"
        alt="ARIA"
        width={110}
        height={42}
        style={{ objectFit: 'contain', marginBottom: 40, filter: 'brightness(0) invert(1)' }}
        priority
      />
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: 'clamp(14px, 2vw, 18px)',
        fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.5)', marginBottom: 40, textAlign: 'center',
      }}>
        Any goal. The right agents.
      </p>
      <ConnectButton onConnected={onConnected} budgetUsdc={10} />
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 12,
        color: 'rgba(255,255,255,0.2)', marginTop: 24, textAlign: 'center', letterSpacing: '0.04em',
      }}>
        Powered by Venice AI · Zero data retention · ERC-7710 micropayments
      </p>
    </CenteredLayout>
  )
}

// ─── Pre-task prompt screen ────────────────────────────────────────────────────
function PromptScreen({
  address,
  budget,
  setBudget,
  prompt,
  setPrompt,
  submitting,
  error,
  onSubmit,
  onDisconnect,
  attachedFiles,
  setAttachedFiles,
}: {
  address: string
  budget: number
  setBudget: (n: number) => void
  prompt: string
  setPrompt: (s: string) => void
  submitting: boolean
  error: string | null
  onSubmit: () => void
  onDisconnect: () => void
  attachedFiles: File[]
  setAttachedFiles: (files: File[]) => void
}) {
  const [focused, setFocused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const next = [...attachedFiles, ...Array.from(incoming)].slice(0, 5) // max 5 files
    setAttachedFiles(next)
  }

  const removeFile = (i: number) => {
    setAttachedFiles(attachedFiles.filter((_, idx) => idx !== i))
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', background: '#000' }}>
      <SmokeBackground smokeColor="#FF6B35" />

      {/* Nav */}
      <nav style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <Image src="/Logo.png" alt="ARIA" width={72} height={28} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: '#22C55E', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            ● {address.slice(0, 6)}…{address.slice(-4)}
          </span>
          <span className="aria-hide-mob" style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Venice AI
          </span>
          <button onClick={onDisconnect} style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#444', background: 'transparent', border: '1px solid #222', padding: '5px 12px', cursor: 'pointer' }}>
            Disconnect
          </button>
        </div>
      </nav>

      {/* Centered content */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '80px 24px 40px', overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

          {/* Logo */}
          <Image
            src="/Logo.png"
            alt="ARIA"
            width={90}
            height={34}
            style={{ objectFit: 'contain', marginBottom: 28, filter: 'brightness(0) invert(1)' }}
          />

          {/* Subheading */}
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(14px, 1.8vw, 18px)',
            fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)', marginBottom: 36, textAlign: 'center',
          }}>
            What would you like to accomplish?
          </p>

          {/* Prompt textarea + file drop zone */}
          <div
            style={{
              width: '100%',
              background: dragging ? 'rgba(255,107,53,0.06)' : 'rgba(10,10,10,0.82)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${dragging ? 'rgba(255,107,53,0.7)' : focused ? 'rgba(255,107,53,0.6)' : 'rgba(255,255,255,0.08)'}`,
              transition: 'border-color 200ms, background 200ms',
              marginBottom: 8,
            }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Describe your goal in plain language..."
              rows={4}
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'var(--font-body)', fontSize: 15, color: '#fff',
                padding: '18px 20px 12px', resize: 'none', lineHeight: 1.6,
                caretColor: '#FF6B35',
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) onSubmit() }}
            />

            {/* Attached files list */}
            {attachedFiles.length > 0 && (
              <div style={{ padding: '0 16px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {attachedFiles.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.25)',
                    padding: '3px 10px 3px 8px',
                  }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#FF6B35' }}>
                      📎 {f.name}
                    </span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#555', letterSpacing: '0.06em' }}>
                      {formatSize(f.size)}
                    </span>
                    <button
                      onClick={() => removeFile(i)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#555', fontSize: 12, padding: '0 0 0 2px', lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Attach button row */}
            <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.md,.json,.csv"
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.3)',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                  padding: '5px 12px', cursor: 'pointer', transition: 'all 150ms',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FF6B35'; e.currentTarget.style.borderColor = 'rgba(255,107,53,0.4)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              >
                <span>⊕</span> Attach File
              </button>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.06em' }}>
                or drop files here · max 5 · images, PDF, text
              </span>
            </div>
          </div>

          {/* Quick prompts */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 22, marginTop: 6 }}>
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => setPrompt(q)}
                style={{
                  fontFamily: 'var(--font-body)', fontSize: 12,
                  color: 'rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '5px 12px', cursor: 'pointer', transition: 'all 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FF6B35'; e.currentTarget.style.borderColor = 'rgba(255,107,53,0.4)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Budget + submit row */}
          <div className="aria-budget-row" style={{ marginBottom: 12 }}>
            {/* Budget pills */}
            <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
              {BUDGET_PRESETS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBudget(b)}
                  style={{
                    fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '0 18px', cursor: 'pointer',
                    border: budget === b ? '1px solid #FF6B35' : '1px solid rgba(255,255,255,0.1)',
                    background: budget === b ? 'rgba(255,107,53,0.12)' : 'rgba(10,10,10,0.6)',
                    color: budget === b ? '#FF6B35' : 'rgba(255,255,255,0.3)',
                    transition: 'all 150ms', backdropFilter: 'blur(8px)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b} USDC
                </button>
              ))}
            </div>

            {/* Submit */}
            <button
              onClick={onSubmit}
              disabled={!prompt.trim() || submitting}
              style={{
                flex: 1,
                background: prompt.trim() && !submitting ? '#FF6B35' : 'rgba(26,10,0,0.6)',
                color: prompt.trim() && !submitting ? '#000' : 'rgba(255,107,53,0.4)',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                border: 'none', cursor: prompt.trim() && !submitting ? 'pointer' : 'default',
                padding: '0 24px', height: 48,
                transition: 'background 200ms, color 200ms',
                backdropFilter: 'blur(8px)',
              }}
            >
              {submitting ? 'STARTING…' : '→ START TASK'}
            </button>
          </div>

          {error && (
            <p style={{ color: '#EF4444', fontSize: 13, fontFamily: 'var(--font-body)', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.15)', textAlign: 'center', marginTop: 8 }}>
            Agents charge 0.20–0.60 USDC per task · Unused budget is never spent · ⌘↵ to submit
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── App page ─────────────────────────────────────────────────────────────────
export default function AppPage() {
  const { address, showGuard, onConnected, disconnect } = useWalletGuard()
  const [budget, setBudget] = useState(10)
  const [prompt, setPrompt] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [taskId, setTaskId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!prompt.trim() || !address || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          input: prompt,
          budgetUsdc: budget,
          attachments: attachedFiles.map((f) => f.name),
        }),
      })
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(msg)
      }
      const { taskId: id } = await res.json()
      setTaskId(id)
    } catch (err) {
      setError(String(err))
      setSubmitting(false)
    }
  }

  // 1. Wallet guard
  if (showGuard) return <WalletGuard onConnected={onConnected} />

  // 2. Pre-task prompt
  if (!taskId) {
    return (
      <PromptScreen
        address={address!}
        budget={budget}
        setBudget={setBudget}
        prompt={prompt}
        setPrompt={setPrompt}
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
        onDisconnect={disconnect}
        attachedFiles={attachedFiles}
        setAttachedFiles={setAttachedFiles}
      />
    )
  }

  // 3. Inline execution view
  return (
    <main style={{
      minHeight: '100vh', backgroundColor: '#000', color: '#fff',
      backgroundImage: `linear-gradient(rgba(255,107,53,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,53,0.13) 1px, transparent 1px)`,
      backgroundSize: '72px 72px',
    }}>
      {/* Sticky nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #111', padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <Image src="/Logo.png" alt="ARIA" width={64} height={24} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: '#22C55E', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            ● {address!.slice(0, 6)}…{address!.slice(-4)}
          </span>
          <span className="aria-hide-mob" style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Venice AI · 0 bytes retained
          </span>
          <button onClick={disconnect} style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#444', background: 'transparent', border: '1px solid #1A1A1A', padding: '5px 12px', cursor: 'pointer' }}>
            Disconnect
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        {/* Prompt bubble */}
        <div style={{
          background: '#0A0A0A', border: '1px solid #1E1E1E',
          padding: '16px 24px', marginBottom: 32,
          display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#FF6B35', letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0, paddingTop: 3 }}>
            TASK
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#ccc', lineHeight: 1.6 }}>
              {prompt}
            </p>
            {attachedFiles.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {attachedFiles.map((f, i) => (
                  <span key={i} style={{
                    fontFamily: 'var(--font-display)', fontSize: 9, color: '#FF6B35',
                    background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.25)',
                    padding: '2px 8px', letterSpacing: '0.06em',
                  }}>
                    📎 {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: '#22C55E', letterSpacing: '0.08em', flexShrink: 0, paddingTop: 3 }}>
            {budget} USDC
          </span>
        </div>

        <InlineExecution taskId={taskId} prompt={prompt} budgetUsdc={budget} />

        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <button
            onClick={() => { setTaskId(null); setPrompt(''); setSubmitting(false) }}
            style={{
              fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#444', background: 'transparent', border: '1px solid #1A1A1A',
              padding: '12px 28px', cursor: 'pointer',
            }}
          >
            ← NEW TASK
          </button>
        </div>
      </div>
    </main>
  )
}
