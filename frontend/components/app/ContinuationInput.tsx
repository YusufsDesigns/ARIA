'use client'

import { useState } from 'react'

export function ContinuationInput({
  value,
  onChange,
  onSubmit,
  loading,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  loading?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const canSubmit = !!value.trim() && !loading

  return (
    <div style={{ marginTop: 24, marginBottom: 40 }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
        Continue this task
      </p>

      {/* Same look as the original prompt field */}
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${focused ? 'rgba(255,107,53,0.55)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 22,
          transition: 'border-color 200ms',
          padding: '4px 6px 6px',
        }}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Now create the tokenomics… or dig deeper into competitors…"
          rows={3}
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            fontFamily: 'var(--font-body)', fontSize: 15, color: '#fff',
            padding: '14px 14px 6px', resize: 'none', lineHeight: 1.55, minHeight: 72, maxHeight: 200, caretColor: '#FF6B35',
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit() }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 2px' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.4)', flex: 1, minWidth: 0 }}>
            Context from this task is passed to the next run
          </span>
          <button
            onClick={onSubmit}
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
            {loading ? 'Starting…' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
