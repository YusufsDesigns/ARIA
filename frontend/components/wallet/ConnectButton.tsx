'use client'

import { useState, useEffect } from 'react'
import { createPublicClient, createWalletClient, custom, http, parseUnits } from 'viem'
import { baseSepolia } from 'viem/chains'
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'
import { getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit'

const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`
const ORCHESTRATOR_ADDRESS = (process.env.NEXT_PUBLIC_ORCHESTRATOR_SESSION_ADDRESS ?? '') as `0x${string}`

export type ConnectButtonProps = {
  onConnected: (address: string) => void
  budgetUsdc?: number
  className?: string
  children?: React.ReactNode
}

declare global {
  interface Window {
    ethereum?: Record<string, unknown>
  }
}

export function ConnectButton({ onConnected, budgetUsdc = 10, className, children }: ConnectButtonProps) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'granting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('aria_address')
    if (!stored) return
    // Only restore the "connected" state if a grant actually exists in the DB for
    // this address. Otherwise the green indicator would show from a stale session
    // while no ERC-7715 permission is stored — payments would silently 402 / fall
    // back to dev mode. If missing, clear the stale session and force a real connect.
    ;(async () => {
      try {
        const res = await fetch(`/api/delegate?address=${encodeURIComponent(stored)}`)
        if (res.ok) {
          setAddress(stored)
          setStatus('done')
          onConnected(stored)
        } else {
          sessionStorage.removeItem('aria_address')
        }
      } catch {
        sessionStorage.removeItem('aria_address')
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async () => {
    setError(null)
    if (!window.ethereum) {
      setError('MetaMask not detected. Please install MetaMask.')
      return
    }

    try {
      setStatus('connecting')

      const accounts = await (window.ethereum.request as Function)({
        method: 'eth_requestAccounts',
      }) as string[]

      const userAddress = accounts[0]
      if (!userAddress) throw new Error('No account returned')
      setAddress(userAddress)

      // Check whether the user's account is already a deployed MetaMask Smart Account.
      // Delegation redemption will fail if the delegator account is not yet deployed.
      const publicClient = createPublicClient({
        chain: baseSepolia,
        // Use public RPC for code read — NEXT_PUBLIC_ALCHEMY_RPC_URL if set, else public fallback
        transport: http(
          process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ?? 'https://sepolia.base.org'
        ),
      })
      const code = await publicClient.getCode({ address: userAddress as `0x${string}` })
      const mmEnv = getSmartAccountsEnvironment(baseSepolia.id)
      const isSmartAccount = code && code !== '0x' &&
        code.toLowerCase().includes(
          mmEnv.implementations.EIP7702StatelessDeleGatorImpl.toLowerCase().slice(2)
        )

      if (code && code !== '0x' && !isSmartAccount) {
        // Account has code but is not a MetaMask Smart Account — warn, but continue
        console.warn('[ARIA] User account has contract code but is not a MetaMask Smart Account.')
      }

      // Try ERC-7715 advanced permission grant (MetaMask Flask / MetaMask with Smart Accounts)
      setStatus('granting')
      try {
        const walletClient = createWalletClient({
          transport: custom(window.ethereum as Parameters<typeof custom>[0]),
          chain: baseSepolia,
        }).extend(erc7715ProviderActions())

        const currentTime = Math.floor(Date.now() / 1000)
        const expiry = currentTime + 86400 // 24 hours

        // CORRECT: use `to` field (not `signer`), per PermissionRequestParameter type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const grantedPermissions = await (walletClient as any).requestExecutionPermissions([{
          chainId: baseSepolia.id,
          expiry,
          to: ORCHESTRATOR_ADDRESS,
          permission: {
            type: 'erc20-token-periodic',
            isAdjustmentAllowed: true,
            data: {
              tokenAddress: USDC_ADDRESS,
              periodAmount: parseUnits(budgetUsdc.toString(), 6),
              periodDuration: 86400,
              startTime: currentTime,
              justification: 'ARIA agent task execution budget',
            },
          },
        }])

        const grant = grantedPermissions[0]
        if (!grant?.context || grant.context === '0x') {
          throw new Error('Wallet returned an empty permission context')
        }

        const storeRes = await fetch('/api/delegate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress,
            permissionContext: grant.context,
            // grant.from = the user's smart account address that granted the permission.
            // Passed to createx402DelegationProvider as `from` per the MetaMask docs pattern.
            permissionFrom: grant.from ?? userAddress,
            expiresAt: new Date(expiry * 1000).toISOString(),
            periodAmountUsdc: budgetUsdc,
          }),
        })
        if (!storeRes.ok) {
          throw new Error(`Failed to store permission (${storeRes.status})`)
        }
        console.info('[ARIA] ERC-7715 grant stored. from:', grant.from ?? userAddress)
      } catch (grantErr) {
        // ERC-7715 not supported / rejected — store minimal context, orchestrator
        // uses Venice direct mode (NO real x402 payments). Surface this clearly:
        // this is the difference between a real on-chain demo and dev mode.
        console.error('[ARIA] ERC-7715 advanced permission grant failed — falling back to dev mode (no real payments):', grantErr)
        setError('Budget approval (ERC-7715) was not granted — running in preview mode without on-chain payments. Use MetaMask with Smart Accounts enabled for real x402 payments.')
        await fetch('/api/delegate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress,
            permissionContext: '0x',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            periodAmountUsdc: budgetUsdc,
          }),
        }).catch(() => {})
      }

      sessionStorage.setItem('aria_address', userAddress)
      setStatus('done')
      onConnected(userAddress)
    } catch (err) {
      setError(String(err))
      setStatus('idle')
    }
  }

  const disconnect = () => {
    sessionStorage.removeItem('aria_address')
    setAddress(null)
    setStatus('idle')
  }

  if (status === 'done' && address) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: '#22C55E', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          ● {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button onClick={disconnect} style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#888', background: 'transparent', border: '1px solid #333', padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button
        onClick={connect}
        disabled={status !== 'idle'}
        className={className}
        style={!className ? {
          background: status !== 'idle' ? '#1A0D00' : '#FF6B35',
          color: status !== 'idle' ? '#FF6B35' : '#000',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '14px 32px',
          border: 'none',
          cursor: status !== 'idle' ? 'default' : 'pointer',
          transition: 'opacity 150ms',
        } : undefined}
      >
        {children ?? (
          status === 'connecting' ? 'CONNECTING…' :
          status === 'granting'   ? 'APPROVING BUDGET…' :
          'CONNECT METAMASK'
        )}
      </button>
      {error && (
        <p style={{ color: '#EF4444', fontSize: 12, fontFamily: 'var(--font-body)', maxWidth: 320, textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  )
}
