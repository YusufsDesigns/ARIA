'use client'

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
  return (
    <div className="mt-4 mb-12">
      <div className="bg-white/[0.04] border border-white/[0.08] p-4 focus-within:border-white/20 transition-all">
        <p className="text-[10px] font-display uppercase tracking-[0.2em] text-[#FF6B35] mb-3">Continue this task</p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Now create the tokenomics… or dig deeper into competitors…"
          className="w-full bg-transparent text-white resize-none outline-none text-sm font-body placeholder-white/20 min-h-[60px]"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit() }}
        />
        <div className="flex justify-between items-center mt-3">
          <p className="text-white/20 text-xs font-body">Context from this task is passed to the next run</p>
          <button
            onClick={onSubmit}
            disabled={!value.trim() || loading}
            className="bg-[#FF6B35] text-black font-bold text-xs px-5 py-2 font-display uppercase tracking-wider hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            {loading ? 'Starting…' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
