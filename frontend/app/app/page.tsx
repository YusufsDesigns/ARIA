'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { SmokeBackground } from '@/components/ui/smoke-background'
import { WalletWall } from '@/components/app/WalletWall'
import { useWallet } from '@/components/app/WalletContext'

const QUICK_PROMPTS = [
  'Launch a memecoin called MOONCAT on Base',
  'Research the top DeFi protocols by TVL',
  'Analyse Uniswap v4 competition',
  'Create a Web3 gaming campaign',
]
const BUDGET_PRESETS = [5, 10, 15]
const MAX_ATTACH_CHARS = 4000

export default function AppPage() {
  const { address, isConnected } = useWallet()
  const router = useRouter()

  const [prompt, setPrompt] = useState('')
  const [budget, setBudget] = useState(10)
  const [grantedBudget, setGrantedBudget] = useState<number | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clamp the per-task budget to whatever the ERC-7715 grant actually approved.
  useEffect(() => {
    if (!address) return
    ;(async () => {
      try {
        const res = await fetch(`/api/delegate?address=${encodeURIComponent(address)}`)
        if (res.ok) {
          const data = await res.json()
          if (data?.periodAmountUsdc) {
            const granted = Number(data.periodAmountUsdc)
            setGrantedBudget(granted)
            setBudget((b) => Math.min(b, granted))
          }
        }
      } catch { /* proceed with selected budget */ }
    })()
  }, [address])

  if (!isConnected) return <WalletWall />

  const effectiveBudget = grantedBudget !== null ? Math.min(budget, grantedBudget) : budget

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return
    setAttachedFiles([...attachedFiles, ...Array.from(incoming)].slice(0, 5))
  }
  const removeFile = (i: number) => setAttachedFiles(attachedFiles.filter((_, idx) => idx !== i))
  const formatSize = (bytes: number) =>
    bytes < 1024 ? `${bytes}B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)}KB` : `${(bytes / (1024 * 1024)).toFixed(1)}MB`

  const handleSubmit = async () => {
    if (!prompt.trim() || submitting) return
    setError(null)
    setSubmitting(true)

    // Fold readable text attachments into the prompt as context; note images by name.
    let input = prompt.trim()
    try {
      const texts: string[] = []
      const images: string[] = []
      for (const f of attachedFiles) {
        if (f.type.startsWith('image/')) images.push(f.name)
        else texts.push(`--- ${f.name} ---\n${(await f.text().catch(() => '')).slice(0, MAX_ATTACH_CHARS)}`)
      }
      const textCtx = texts.join('\n\n').slice(0, MAX_ATTACH_CHARS)
      if (textCtx) input += `\n\nAttached files:\n${textCtx}`
      if (images.length) input += `\n\n(Images attached: ${images.join(', ')})`

      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: address!.toLowerCase(), input, budgetUsdc: effectiveBudget }),
      })
      if (!res.ok) throw new Error('Failed to start task')
      const { taskId } = await res.json()
      router.push(`/app/chat/${taskId}`)
    } catch (err) {
      setError(String(err))
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100%', overflow: 'hidden', background: '#000' }}>
      <SmokeBackground smokeColor="#FF6B35" />
      {/* Dark scrim so content stays readable over the smoke */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'rgba(0,0,0,0.62)' }} />

      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px', overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          <Image src="/Logo.png" alt="ARIA" width={90} height={34} style={{ objectFit: 'contain', marginBottom: 28, filter: 'brightness(0) invert(1)' }} />

          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(14px, 1.8vw, 18px)',
            fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.75)', marginBottom: 36, textAlign: 'center',
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
                padding: '18px 20px 12px', resize: 'none', lineHeight: 1.6, caretColor: '#FF6B35',
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
            />

            {attachedFiles.length > 0 && (
              <div style={{ padding: '0 16px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {attachedFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.25)', padding: '3px 10px 3px 8px' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#FF6B35' }}>📎 {f.name}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#555', letterSpacing: '0.06em' }}>{formatSize(f.size)}</span>
                    <button onClick={() => removeFile(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#555', fontSize: 12, padding: '0 0 0 2px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.json,.csv" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', padding: '5px 12px', cursor: 'pointer', transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 5 }}
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
                style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', padding: '5px 12px', cursor: 'pointer', transition: 'all 150ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FF6B35'; e.currentTarget.style.borderColor = 'rgba(255,107,53,0.4)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Budget + submit row */}
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 6 }}>
            Spending cap — unused budget is never charged
          </p>
          <div className="aria-budget-row" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
              {BUDGET_PRESETS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBudget(grantedBudget !== null ? Math.min(b, grantedBudget) : b)}
                  style={{
                    fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '0 18px', cursor: 'pointer',
                    border: effectiveBudget === b ? '1px solid #FF6B35' : '1px solid rgba(255,255,255,0.1)',
                    background: effectiveBudget === b ? 'rgba(255,107,53,0.12)' : 'rgba(10,10,10,0.6)',
                    color: effectiveBudget === b ? '#FF6B35' : 'rgba(255,255,255,0.3)',
                    transition: 'all 150ms', backdropFilter: 'blur(8px)', whiteSpace: 'nowrap',
                  }}
                >
                  {b} USDC
                </button>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || submitting}
              style={{
                flex: 1,
                background: prompt.trim() && !submitting ? '#FF6B35' : 'rgba(26,10,0,0.6)',
                color: prompt.trim() && !submitting ? '#000' : 'rgba(255,107,53,0.4)',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                border: 'none', cursor: prompt.trim() && !submitting ? 'pointer' : 'default',
                padding: '0 24px', height: 48, transition: 'background 200ms, color 200ms', backdropFilter: 'blur(8px)',
              }}
            >
              {submitting ? 'STARTING…' : '→ START TASK'}
            </button>
          </div>

          {error && <p style={{ color: '#EF4444', fontSize: 13, fontFamily: 'var(--font-body)', textAlign: 'center' }}>{error}</p>}

          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 8 }}>
            Agents charge 0.20–0.60 USDC per task · Unused budget is never spent · ⌘↵ to submit
          </p>
        </div>
      </div>
    </div>
  )
}
