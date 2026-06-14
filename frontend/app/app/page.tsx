'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { SmokeBackground } from '@/components/ui/smoke-background'
import { WalletWall } from '@/components/app/WalletWall'
import { useWallet } from '@/components/app/WalletContext'

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
  const canSubmit = !!prompt.trim() && !submitting

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
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'rgba(0,0,0,0.62)' }} />

      <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', padding: '64px 16px 16px' }}>
        {/* Centred greeting fills the space above the docked input */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Image src="/Logo.png" alt="ARIA" width={84} height={32} style={{ objectFit: 'contain', marginBottom: 22, filter: 'brightness(0) invert(1)' }} />
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(15px, 2vw, 19px)',
            fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.8)', textAlign: 'center', maxWidth: 460, lineHeight: 1.4,
          }}>
            What would you like to accomplish?
          </p>
        </div>

        {/* Bottom-docked input */}
        <div style={{ width: '100%', maxWidth: 680, margin: '0 auto' }}>

          {/* Budget — thin line above the field so it doesn't crowd the prompt */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
              Budget
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {BUDGET_PRESETS.map((b) => {
                const active = effectiveBudget === b
                const disabled = grantedBudget !== null && b > grantedBudget
                return (
                  <button
                    key={b}
                    onClick={() => setBudget(grantedBudget !== null ? Math.min(b, grantedBudget) : b)}
                    disabled={disabled}
                    style={{
                      height: 28, minWidth: 38, padding: '0 10px', borderRadius: 8,
                      fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                      border: active ? '1px solid #FF6B35' : '1px solid rgba(255,255,255,0.12)',
                      background: active ? 'rgba(255,107,53,0.15)' : 'rgba(255,255,255,0.04)',
                      color: active ? '#FF6B35' : 'rgba(255,255,255,0.55)',
                      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1, transition: 'all 150ms',
                    }}
                  >
                    {b}
                  </button>
                )
              })}
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>USDC</span>
          </div>

          {/* Input card — the prompt field is the dominant element */}
          <div
            style={{
              width: '100%',
              background: dragging ? 'rgba(255,107,53,0.08)' : 'rgba(12,12,12,0.9)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${dragging ? 'rgba(255,107,53,0.7)' : focused ? 'rgba(255,107,53,0.55)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 22,
              transition: 'border-color 200ms, background 200ms',
              padding: '4px 6px 6px',
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
              placeholder="Describe your goal in plain language…"
              rows={3}
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'var(--font-body)', fontSize: 15, color: '#fff',
                padding: '14px 14px 6px', resize: 'none', lineHeight: 1.55, minHeight: 76, maxHeight: 240, caretColor: '#FF6B35',
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
            />

            {attachedFiles.length > 0 && (
              <div style={{ padding: '0 10px 6px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {attachedFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.25)', borderRadius: 8, padding: '3px 8px' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#FF6B35' }}>📎 {f.name}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#8a8a8a' }}>{formatSize(f.size)}</span>
                    <button onClick={() => removeFile(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8a8a8a', fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* One compact control row: attach (left) · send (right) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 2px' }}>
              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.json,.csv" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
                style={{ flex: '0 0 auto', width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                📎
              </button>
              <div style={{ flex: 1 }} />
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  flex: '0 0 auto', height: 38, padding: '0 18px', borderRadius: 11,
                  background: canSubmit ? '#FF6B35' : 'rgba(255,107,53,0.18)',
                  color: canSubmit ? '#000' : 'rgba(255,107,53,0.5)',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12.5,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  border: 'none', cursor: canSubmit ? 'pointer' : 'default',
                  transition: 'background 200ms, color 200ms', whiteSpace: 'nowrap',
                }}
              >
                {submitting ? 'Starting…' : 'Start →'}
              </button>
            </div>
          </div>

          {error && (
            <p style={{ color: '#EF4444', fontSize: 12, fontFamily: 'var(--font-body)', textAlign: 'center', marginTop: 8 }}>{error}</p>
          )}

          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 10 }}>
            Agents charge 0.20–0.60 USDC per task · ⌘↵ to submit
          </p>
        </div>
      </div>
    </div>
  )
}
