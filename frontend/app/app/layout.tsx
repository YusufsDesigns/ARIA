'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { WalletProvider, useWallet } from '@/components/app/WalletContext'
import { TaskHistoryList, type TaskSummary } from '@/components/app/TaskHistoryList'
import { BalanceTracker } from '@/components/app/BalanceTracker'

function Shell({ children }: { children: React.ReactNode }) {
  const { address, isConnected, disconnect } = useWallet()
  const router = useRouter()
  const pathname = usePathname()
  const activeTaskId = pathname.startsWith('/app/chat/') ? pathname.split('/').pop() : undefined

  const [history, setHistory] = useState<TaskSummary[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close the mobile drawer whenever the route changes (after navigating).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(false)
  }, [pathname])

  // Refetch the wallet-scoped history when the address changes or the route
  // changes (so a freshly-started task appears in the sidebar).
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!address) { if (!cancelled) setHistory([]); return }
      try {
        const res = await fetch(`/api/history?address=${address.toLowerCase()}`)
        const data = await res.json()
        if (!cancelled) setHistory(data.tasks ?? [])
      } catch {
        if (!cancelled) setHistory([])
      }
    }
    void run()
    return () => { cancelled = true }
  }, [address, pathname])

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''
  // The new-task page has a full-height smoke background — a solid top bar over it
  // looks wrong, so there the wallet controls float as a transparent overlay.
  const isNewTask = pathname === '/app'

  const walletBar = isConnected && address ? (
    <div className="flex items-center gap-3 sm:gap-4">
      <BalanceTracker />
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        <span className="text-white/70 text-xs font-body">{short}</span>
      </div>
      <button
        onClick={() => { void disconnect(); router.push('/app') }}
        className="text-white/70 hover:text-white/80 text-xs font-display uppercase tracking-wider border border-white/10 hover:border-white/25 px-3 py-1.5 transition-all"
      >
        Disconnect
      </button>
    </div>
  ) : null

  const menuButton = (
    <button
      onClick={() => setSidebarOpen(true)}
      aria-label="Open menu"
      className="md:hidden text-white/70 hover:text-white p-2 -ml-2"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#0A0A0A]">
      {/* Mobile drawer backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR — drawer on mobile, static on md+ */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 max-w-[82vw] shrink-0 flex flex-col bg-[#0D0D0D] border-r border-white/[0.06] overflow-hidden transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <span className="font-display text-white font-bold tracking-wider text-sm">ARIA</span>
          <button
            onClick={() => router.push('/app')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-white/60 hover:text-white hover:border-white/30 text-xs font-display uppercase tracking-wider transition-all"
          >
            + New
          </button>
        </div>

        {isConnected && address && (
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-white/70 text-xs font-body">{short}</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-2">
          {!isConnected ? (
            <p className="text-white/60 text-xs text-center mt-8 px-4 font-body">Connect wallet to see history</p>
          ) : history.length === 0 ? (
            <p className="text-white/60 text-xs text-center mt-8 px-4 font-body">No tasks yet</p>
          ) : (
            <TaskHistoryList tasks={history} activeTaskId={activeTaskId} />
          )}
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {/* New-task page: full-height smoke with the controls floating on top.
            Other pages (chat): a normal solid top bar. */}
        {isNewTask ? (
          <div className="flex-1 overflow-y-auto relative">
            <div className="absolute top-0 left-0 z-30 h-14 flex items-center px-4">{menuButton}</div>
            {walletBar && (
              <div className="absolute top-0 right-0 z-30 h-14 flex items-center px-4 sm:px-6">{walletBar}</div>
            )}
            {children}
          </div>
        ) : (
          <>
            <nav className="h-14 shrink-0 flex items-center px-4 sm:px-6 border-b border-white/[0.06] bg-[#0A0A0A]/80 backdrop-blur-sm relative z-20">
              {menuButton}
              <div className="ml-auto">{walletBar}</div>
            </nav>
            <div className="flex-1 overflow-y-auto relative">{children}</div>
          </>
        )}
      </div>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <Shell>{children}</Shell>
    </WalletProvider>
  )
}
