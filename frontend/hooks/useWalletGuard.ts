'use client'

import { useState, useEffect, useCallback } from 'react'

export type WalletState = {
  address: string | null
  isConnected: boolean
  showGuard: boolean
  onConnected: (addr: string) => void
  disconnect: () => void
}

export function useWalletGuard(): WalletState {
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = sessionStorage.getItem('aria_address')
    if (stored) setAddress(stored)
  }, [])

  const onConnected = useCallback((addr: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('aria_address', addr)
    }
    setAddress(addr)
  }, [])

  const disconnect = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('aria_address')
    }
    setAddress(null)
  }, [])

  return {
    address,
    isConnected: !!address,
    showGuard: !address,
    onConnected,
    disconnect,
  }
}
