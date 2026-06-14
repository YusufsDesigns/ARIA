'use client'

import { createContext, useContext, useEffect } from 'react'
import { useWalletGuard, type WalletState } from '@/hooks/useWalletGuard'

// Single source of wallet identity for the whole /app area. Wraps the existing
// useWalletGuard (sessionStorage-backed) so the sidebar, new-task page and chat
// page all share ONE address state. Does NOT touch the ERC-7715 grant / payment
// flow — that still lives in ConnectButton.
const WalletContext = createContext<WalletState | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWalletGuard()
  const { address, onConnected, disconnect } = wallet

  // React to MetaMask account switches: a new address is a new identity.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const eth = (window as unknown as { ethereum?: { on?: (e: string, h: (a: string[]) => void) => void; removeListener?: (e: string, h: (a: string[]) => void) => void } }).ethereum
    if (!eth?.on) return

    const handler = (accounts: string[]) => {
      // Only react once the user is already connected (don't auto-connect).
      if (!address) return
      const next = accounts[0]?.toLowerCase() ?? null
      if (!next) void disconnect()
      else if (next !== address.toLowerCase()) onConnected(next)
    }

    eth.on('accountsChanged', handler)
    return () => eth.removeListener?.('accountsChanged', handler)
  }, [address, onConnected, disconnect])

  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
