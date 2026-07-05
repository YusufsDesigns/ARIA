'use client'

import { useState, useEffect } from 'react'
import { createPublicClient, createWalletClient, custom, http, parseUnits } from 'viem'
import { baseSepolia } from 'viem/chains'
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'
import { getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit'

const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`
const ORCHESTRATOR_ADDRESS = (process.env.NEXT_PUBLIC_ORCHESTRATOR_SESSION_ADDRESS ?? '') as `0x${string}`

// ─── ERC-7715 grant diagnostics ───────────────────────────────────────────────
// The grant fails silently for every wallet and the app degrades to dev mode
// (permissionContext '0x' → orchestrator can't pay → x402 agents return 402 →
// everything falls back to Venice text). These helpers extract WHY it failed so
// the real cause is visible in the console and surfaced to the user.

type GrantErrorDetail = {
  code?: number | string
  name?: string
  message: string
  data?: unknown
  stack?: string
}

// Pull the structured fields off whatever the wallet/SDK threw. EIP-1193 provider
// errors carry a numeric `code` and often a `data` payload — the single most
// useful signal for diagnosing a failed permission request.
function describeGrantError(e: unknown): GrantErrorDetail {
  if (e && typeof e === 'object') {
    const any = e as Record<string, unknown>
    // viem/RPC errors sometimes nest the provider error under `.cause`
    const cause = any.cause as Record<string, unknown> | undefined
    const code = (any.code ?? cause?.code) as number | string | undefined
    const data = any.data ?? cause?.data
    return {
      code,
      name: (any.name as string) ?? undefined,
      message: (any.message as string) ?? (cause?.message as string) ?? String(e),
      data,
      stack: (any.stack as string) ?? undefined,
    }
  }
  return { message: String(e) }
}

// Map common EIP-1193 / JSON-RPC error codes to a plain-language cause so the user
// (and we) immediately know which class of failure this is.
function eip1193Hint(code: number | string | undefined): string | null {
  switch (Number(code)) {
    case 4001:
      return 'You rejected the budget-approval request in MetaMask.'
    case 4100:
      return 'MetaMask has not authorised this method (the account/permission is not approved).'
    case 4200:
    case -32601:
      return 'Your MetaMask does not support ERC-7715 advanced permissions (wallet_requestExecutionPermissions). Enable MetaMask Smart Accounts, or use MetaMask Flask.'
    case -32602:
      return 'MetaMask rejected the request parameters — the permission request shape is invalid for this wallet/SDK version.'
    case -32603:
      return 'MetaMask hit an internal error processing the permission request.'
    default:
      return null
  }
}

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

      // ── Preflight diagnostics ───────────────────────────────────────────────
      // Logged BEFORE the grant so that if the call throws we already have the
      // full request context to correlate against the thrown error.
      const eth = window.ethereum as Record<string, unknown>
      console.groupCollapsed('[ARIA][7715] Preflight — about to request execution permissions')
      console.info('provider.isMetaMask:', eth?.isMetaMask)
      console.info('provider keys:', Object.keys(eth ?? {}).slice(0, 40))
      console.info('orchestrator (to):', ORCHESTRATOR_ADDRESS || '*** EMPTY — NEXT_PUBLIC_ORCHESTRATOR_SESSION_ADDRESS not set ***')
      console.info('user account:', userAddress)
      console.info('chainId:', baseSepolia.id, '| USDC:', USDC_ADDRESS, '| budget:', budgetUsdc)
      console.info('account is MetaMask Smart Account (has 7702 impl code):', !!isSmartAccount, '| code present:', !!(code && code !== '0x'))
      console.groupEnd()

      if (!ORCHESTRATOR_ADDRESS) {
        // Empty `to` would make MetaMask reject params (-32602). Fail fast with a
        // precise message rather than letting it look like an unsupported wallet.
        throw new Error('Config error: NEXT_PUBLIC_ORCHESTRATOR_SESSION_ADDRESS is not set, so the grant has no delegate (`to`).')
      }

      try {
        const walletClient = createWalletClient({
          transport: custom(window.ethereum as Parameters<typeof custom>[0]),
          chain: baseSepolia,
        }).extend(erc7715ProviderActions())

        // ── Capability probe (diagnostic, non-fatal) ──────────────────────────
        // If the wallet exposes getSupportedExecutionPermissions, log what it
        // claims to support. An empty/throwing result is a strong signal the
        // wallet has no ERC-7715 support at all (vs. a params/shape problem).
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const wc = walletClient as any
          if (typeof wc.getSupportedExecutionPermissions === 'function') {
            const supported = await wc.getSupportedExecutionPermissions()
            console.info('[ARIA][7715] Wallet-reported supported permissions:', supported)
          } else {
            console.warn('[ARIA][7715] walletClient.getSupportedExecutionPermissions is not a function — SDK action set may be incomplete.')
          }
        } catch (probeErr) {
          console.warn('[ARIA][7715] Supported-permissions probe failed (wallet likely lacks ERC-7715 support):', describeGrantError(probeErr))
        }

        const currentTime = Math.floor(Date.now() / 1000)
        const expiry = currentTime + 86400 // 24 hours

        const permissionRequest = {
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
        }
        // Log the exact request (periodAmount serialised — it's a BigInt).
        console.info('[ARIA][7715] requestExecutionPermissions payload:', JSON.stringify(permissionRequest, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))

        // CORRECT: use `to` field (not `signer`), per PermissionRequestParameter type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const grantedPermissions = await (walletClient as any).requestExecutionPermissions([permissionRequest])
        console.info('[ARIA][7715] Raw grant response:', grantedPermissions)

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
        const detail = describeGrantError(grantErr)
        const hint = eip1193Hint(detail.code)
        console.error('[ARIA][7715] Grant FAILED — falling back to dev mode (no real payments).')
        console.error('[ARIA][7715] code:', detail.code ?? '(none)', '| name:', detail.name ?? '(none)')
        console.error('[ARIA][7715] message:', detail.message)
        if (detail.data !== undefined) console.error('[ARIA][7715] data:', detail.data)
        if (hint) console.error('[ARIA][7715] likely cause:', hint)
        if (detail.stack) console.debug('[ARIA][7715] stack:', detail.stack)
        // Stash the structured detail so it can be inspected after the fact
        // (e.g. from the console: JSON.parse(sessionStorage.getItem('aria_grant_error'))).
        try {
          sessionStorage.setItem('aria_grant_error', JSON.stringify({ ...detail, hint, at: new Date().toISOString() }))
        } catch { /* sessionStorage unavailable — non-fatal */ }

        const codeLabel = detail.code !== undefined ? ` [${detail.code}]` : ''
        setError(
          `Budget approval (ERC-7715) failed${codeLabel} — running in preview mode without on-chain payments, so agents cannot be hired. ` +
          (hint ?? `Reason: ${detail.message}`)
        )
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
