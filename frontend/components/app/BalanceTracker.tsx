'use client'

import { useCallback, useEffect, useState } from 'react'
import { useWallet } from './WalletContext'

type Balance = { address: string; isPayer: boolean; usdc: number; eth: number }

// Below this the payer can't afford even the cheapest agent (0.20) plus a buffer.
const LOW_USDC = 0.6
const POLL_MS = 20_000

// Other parts of the app (e.g. the chat page on a confirmed payment) can dispatch
// this event to force an immediate refresh instead of waiting for the next poll.
export const BALANCE_REFRESH_EVENT = 'aria:balance-refresh'

export function BalanceTracker() {
  const { address, isConnected } = useWallet()
  const [bal, setBal] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const res = await fetch(`/api/balance?address=${address.toLowerCase()}`, { cache: 'no-store' })
      if (res.ok) setBal((await res.json()) as Balance)
    } catch {
      /* keep last known value on transient failure */
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    // When disconnected the component renders nothing, so no need to clear state
    // here (which would trip react-hooks/set-state-in-effect). Just don't poll.
    if (!isConnected || !address) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    const id = setInterval(() => void refresh(), POLL_MS)
    const onFocus = () => void refresh()
    const onEvent = () => void refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener(BALANCE_REFRESH_EVENT, onEvent)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(BALANCE_REFRESH_EVENT, onEvent)
    }
  }, [isConnected, address, refresh])

  if (!isConnected || !address) return null

  const usdc = bal?.usdc ?? null
  const low = usdc !== null && usdc < LOW_USDC
  const color = usdc === null ? '#9CA3AF' : low ? '#F59E0B' : '#FF6B35'
  const title = bal
    ? `Spending account${bal.isPayer ? ' (smart account)' : ''}: ${bal.address}\n` +
      `USDC: ${bal.usdc.toFixed(2)}  ·  ETH: ${bal.eth.toFixed(4)}\n` +
      `${low ? '⚠ Low — fund this account to hire agents.\n' : ''}` +
      `Click to refresh`
    : 'Loading balance…'

  return (
    <button
      onClick={() => void refresh()}
      title={title}
      aria-label="USDC spending balance — click to refresh"
      className="group flex items-center gap-2 border border-white/10 hover:border-white/25 px-3 py-1.5 transition-all"
    >
      <span
        className="w-1.5 h-1.5 rounded-full transition-transform"
        style={{ background: color, transform: loading ? 'scale(1.6)' : 'scale(1)' }}
      />
      <span className="font-display text-xs tabular-nums" style={{ color }}>
        {usdc === null ? '— USDC' : `${usdc.toFixed(2)} USDC`}
      </span>
      {low && (
        <span className="font-display text-[10px] uppercase tracking-wider" style={{ color: '#F59E0B' }}>
          Low
        </span>
      )}
    </button>
  )
}
