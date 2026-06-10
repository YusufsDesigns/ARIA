'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { uploadAgentMetadata } from '@/lib/pinata'
import { AriaCard } from '@/components/ui/aria-card'
import { AriaFooter } from '@/components/ui/aria-footer'

type FormData = {
  name: string
  description: string
  endpointUrl: string
  capabilities: string
  priceUsdc: string
  inputType: string
  outputTypes: string[]
  estimatedLatency: string
  docsUrl: string
}

const OUTPUT_TYPES = ['text', 'image', 'audio', 'video', 'json']

declare global {
  interface Window {
    ethereum?: Record<string, unknown>
  }
}

const X402_CODE = `// 1. Install
npm install @x402/express @x402/core @x402/evm @metamask/x402

// 2. Add middleware (5 lines)
import { paymentMiddleware } from '@x402/express'
import { HTTPFacilitatorClient, x402ResourceServer } from '@x402/core/server'
import { Erc7710ExactEvmScheme } from '@x402/evm'

const facilitator = new HTTPFacilitatorClient({
  url: 'https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402'
})
const scheme = new Erc7710ExactEvmScheme(facilitator)
const resourceServer = new x402ResourceServer(facilitator)
  .register('eip155:84532', scheme)

app.use(paymentMiddleware({
  'POST /execute': {
    accepts: [{ scheme: 'exact', price: '$0.30',
      network: 'eip155:84532', payTo: '0xYourWallet' }]
  }
}, resourceServer))

// 3. Return standard AgentResponse
app.post('/execute', async (req, res) => {
  const { task, context } = req.body
  // ... your logic
  res.json({ status: 'success', output: result,
    outputType: 'text', contentType: 'text/plain', executionTime: 1.2 })
})`

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState<FormData>({
    name: '', description: '', endpointUrl: '',
    capabilities: '', priceUsdc: '0.30', inputType: 'json',
    outputTypes: ['text'], estimatedLatency: '10', docsUrl: '',
  })
  const [cid, setCid] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [showX402, setShowX402] = useState(false)

  useEffect(() => {
    const cap = new URLSearchParams(window.location.search).get('capability')
    if (cap) setForm((f) => ({ ...f, capabilities: cap }))
    const stored = sessionStorage.getItem('aria_address')
    if (stored) setAddress(stored)
  }, [])

  const manifest = {
    name: form.name, description: form.description, version: '1.0.0',
    endpointUrl: form.endpointUrl,
    capabilitySchema: {
      capabilities: form.capabilities.split(',').map((s) => s.trim()).filter(Boolean),
      inputs: { type: form.inputType, fields: [{ name: 'task', type: 'string', required: true }, { name: 'context', type: 'object', required: false }] },
      outputs: form.outputTypes.map((t) => ({
        type: t,
        contentType: t === 'text' ? 'text/plain' : t === 'image' ? 'image/png' : t === 'audio' ? 'audio/mpeg' : t === 'video' ? 'video/mp4' : 'application/json',
      })),
    },
    metadata: { estimatedLatencySeconds: Number(form.estimatedLatency), supportsStreaming: false },
    pricing: { priceUSDC: Number(form.priceUsdc), pricingModel: 'per-task' },
    documentation: form.docsUrl || undefined,
  }

  const handleUploadToIPFS = async () => {
    setError(null); setLoading(true)
    try {
      const hash = await uploadAgentMetadata(manifest)
      setCid(hash); setStep(2)
    } catch (err) { setError(String(err)) }
    finally { setLoading(false) }
  }

  const handleRegisterOnChain = async () => {
    if (!cid || !address) return
    setError(null); setLoading(true)
    try {
      const { parseUnits, encodeFunctionData, createWalletClient, http, custom } = await import('viem')
      const { baseSepolia } = await import('viem/chains')
      const { createBundlerClient } = await import('viem/account-abstraction')
      const { toMetaMaskSmartAccount, Implementation } = await import('@metamask/smart-accounts-kit')

      const caps = form.capabilities.split(',').map((s) => s.trim()).filter(Boolean)
      const price = parseUnits(form.priceUsdc, 6)
      const abi = [{
        name: 'registerAgent', type: 'function',
        inputs: [{ name: 'capabilities', type: 'string[]' }, { name: 'pricePerTask', type: 'uint256' }, { name: 'ipfsCID', type: 'string' }],
        outputs: [], stateMutability: 'nonpayable',
      }] as const
      const data = encodeFunctionData({ abi, functionName: 'registerAgent', args: [caps, price, cid] })

      const REGISTRY = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`
      const ONE_SHOT_RPC = 'https://relayer.1shotapi.com/relayers'

      // Attempt Smart Account registration via 1Shot bundler (gas paid in USDC, no ETH needed)
      // Falls back to standard EOA tx if bundler is not available
      let tx: string
      try {
        // Create MetaMask Smart Account for the developer using their connected wallet as signer
        const { createPublicClient } = await import('viem')
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(
            process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ?? 'https://sepolia.base.org'
          ),
        })

        const walletClient = createWalletClient({
          transport: custom(window.ethereum as Parameters<typeof custom>[0]),
          chain: baseSepolia,
        })

        const [signerAddress] = await walletClient.requestAddresses()

        // Build an account object with required signing methods for MetaMask Smart Account
        const signerAccount = {
          address: signerAddress,
          signMessage: ({ message }: { message: string | { raw: `0x${string}` | Uint8Array } }) =>
            walletClient.signMessage({ account: signerAddress, message }),
          signTypedData: (params: Parameters<typeof walletClient.signTypedData>[0]) =>
            walletClient.signTypedData({ ...params, account: signerAddress }),
        }

        const smartAccount = await toMetaMaskSmartAccount({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          client: publicClient as any,
          implementation: Implementation.Hybrid,
          deployParams: [signerAddress, [], [], []],
          deploySalt: '0x',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          signer: { account: signerAccount as any },
        })

        const bundlerClient = createBundlerClient({
          chain: baseSepolia,
          transport: http(ONE_SHOT_RPC), // 1Shot — pays gas in USDC, no ETH needed
        })

        const userOpHash = await bundlerClient.sendUserOperation({
          account: smartAccount,
          calls: [{ to: REGISTRY, data }],
        })

        const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash })
        tx = receipt.receipt.transactionHash
      } catch {
        // Bundler path unavailable — fall back to standard MetaMask EOA tx
        tx = await (window.ethereum?.request as Function)({
          method: 'eth_sendTransaction',
          params: [{ from: address, to: REGISTRY, data, chainId: '0x14a34' }],
        }) as string
      }

      setTxHash(tx); setStep(3)
    } catch (err) { setError(String(err)) }
    finally { setLoading(false) }
  }

  const connectWallet = async () => {
    if (!window.ethereum) { setError('MetaMask not detected'); return }
    const accounts = await (window.ethereum.request as Function)({ method: 'eth_requestAccounts' }) as string[]
    setAddress(accounts[0])
    sessionStorage.setItem('aria_address', accounts[0])
  }

  const toggleOutput = (type: string) => {
    setForm((f) => ({
      ...f,
      outputTypes: f.outputTypes.includes(type)
        ? f.outputTypes.filter((t) => t !== type)
        : [...f.outputTypes, type],
    }))
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#000', color: '#fff',
      backgroundImage: `radial-gradient(rgba(255,107,53,0.25) 1px, transparent 1px)`,
      backgroundSize: '40px 40px',
    }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #111', padding: '0 40px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/Logo.png" alt="ARIA" width={80} height={30} style={{ objectFit: 'contain' }} />
        </Link>
        <Link href="/agents" style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555', textDecoration: 'none' }}>
          ← Registry
        </Link>
      </nav>

      <main className="aria-page-pad" style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Header */}
        <div style={{
          paddingBottom: 48,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          backgroundImage: 'radial-gradient(ellipse at 30% 0%, rgba(255,107,53,0.22) 0%, transparent 60%)',
          marginBottom: 60,
        }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: '#FF6B35', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20 }}>
            Register
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,5vw,52px)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.0, marginBottom: 16 }}>
            LIST YOUR<br />AGENT
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#666', lineHeight: 1.7 }}>
            Register on-chain. Earn USDC every time your agent is hired by ARIA's orchestrator.
          </p>
        </div>

        {/* Progress steps */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 60 }}>
          {[
            { n: 1, label: 'METADATA' },
            { n: 2, label: 'ON-CHAIN' },
            { n: 3, label: 'LIVE' },
          ].map(({ n, label }) => (
            <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 2, background: n <= step ? '#FF6B35' : '#1A1A1A' }} />
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: n === step ? '#FF6B35' : n < step ? '#22C55E' : '#333',
              }}>
                {n < step ? '✓ ' : ''}{label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#FF6B35', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Step 1 of 3</p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                UPLOAD METADATA TO IPFS
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <FormField label="Agent Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Market Intelligence Agent"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Description">
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Searches live web for market data and competitor analysis..."
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </FormField>

              <FormField label="Endpoint URL" note="Public HTTPS endpoint (e.g. ngrok tunnel)">
                <input
                  value={form.endpointUrl}
                  onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })}
                  placeholder="https://your-agent.ngrok.io"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Capabilities" note="Comma-separated tags">
                <input
                  value={form.capabilities}
                  onChange={(e) => setForm({ ...form, capabilities: e.target.value })}
                  placeholder="market-intelligence, web-search, competitor-analysis"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Price per Task (USDC)">
                <input
                  type="number" step="0.01" min="0.01"
                  value={form.priceUsdc}
                  onChange={(e) => setForm({ ...form, priceUsdc: e.target.value })}
                  style={{ ...inputStyle, width: 160 }}
                />
              </FormField>

              <FormField label="Output Types">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {OUTPUT_TYPES.map((t) => (
                    <button key={t} onClick={() => toggleOutput(t)} style={{
                      fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '7px 14px', cursor: 'pointer',
                      background: form.outputTypes.includes(t) ? '#FF6B3515' : 'transparent',
                      border: `1px solid ${form.outputTypes.includes(t) ? '#FF6B35' : '#222'}`,
                      color: form.outputTypes.includes(t) ? '#FF6B35' : '#555',
                    }}>
                      {t}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="Docs URL (optional)">
                <input
                  value={form.docsUrl}
                  onChange={(e) => setForm({ ...form, docsUrl: e.target.value })}
                  placeholder="https://docs.yourservice.com"
                  style={inputStyle}
                />
              </FormField>
            </div>

            {/* Manifest preview */}
            <AriaCard variant="inner" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                padding: '10px 16px', borderBottom: '1px solid #111',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#FF6B35', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  Manifest Preview
                </p>
              </div>
              <pre style={{ padding: '20px', fontFamily: 'monospace', fontSize: 11, color: '#666', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, lineHeight: 1.6 }}>
                {JSON.stringify(manifest, null, 2)}
              </pre>
            </AriaCard>

            {/* x402 guide */}
            <div>
              <button
                onClick={() => setShowX402(!showX402)}
                style={{
                  fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: '#FF6B35', background: 'transparent', border: '1px solid #FF6B3530',
                  padding: '8px 16px', cursor: 'pointer', width: '100%', textAlign: 'left',
                }}
              >
                {showX402 ? '▾' : '▸'} How to implement x402 middleware
              </button>
              {showX402 && (
                <AriaCard variant="inner" style={{ padding: 0, overflow: 'hidden', marginTop: 2 }}>
                  <pre style={{ padding: '24px', fontFamily: 'monospace', fontSize: 11, color: '#777', overflowX: 'auto', margin: 0, lineHeight: 1.7 }}>
                    {X402_CODE}
                  </pre>
                </AriaCard>
              )}
            </div>

            {error && <p style={{ color: '#EF4444', fontSize: 13, fontFamily: 'var(--font-body)' }}>{error}</p>}

            <button
              onClick={handleUploadToIPFS}
              disabled={!form.name || !form.endpointUrl || !form.capabilities || loading}
              style={{
                padding: '18px 32px',
                background: form.name && form.endpointUrl && form.capabilities && !loading ? '#FF6B35' : '#1A1A1A',
                color: form.name && form.endpointUrl && form.capabilities && !loading ? '#000' : '#444',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                border: 'none', cursor: 'pointer', width: '100%',
              }}
            >
              {loading ? 'UPLOADING TO IPFS…' : 'UPLOAD TO IPFS →'}
            </button>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && cid && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#FF6B35', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Step 2 of 3</p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                REGISTER ON-CHAIN
              </h2>
            </div>

            <AriaCard variant="default" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: '#22C55E', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
                ✓ Uploaded to IPFS
              </p>
              {[
                { label: 'Name', val: form.name },
                { label: 'Capabilities', val: form.capabilities },
                { label: 'Price', val: `${form.priceUsdc} USDC / task` },
                { label: 'IPFS CID', val: cid },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 8, borderTop: '1px solid #111' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#ccc', textAlign: 'right', overflowWrap: 'break-word', wordBreak: 'break-all' }}>{val}</span>
                </div>
              ))}
              <a
                href={`https://gateway.pinata.cloud/ipfs/${cid}`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#3B82F6', letterSpacing: '0.08em', marginTop: 8 }}
              >
                View on IPFS →
              </a>
            </AriaCard>

            {!address ? (
              <button onClick={connectWallet} style={{
                padding: '18px 32px', background: '#FF6B35', color: '#000',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
              }}>
                CONNECT METAMASK →
              </button>
            ) : (
              <>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: '#22C55E', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  ● CONNECTED: {address.slice(0, 6)}…{address.slice(-4)}
                </p>
                {error && <p style={{ color: '#EF4444', fontSize: 13, fontFamily: 'var(--font-body)' }}>{error}</p>}
                <button onClick={handleRegisterOnChain} disabled={loading} style={{
                  padding: '18px 32px',
                  background: loading ? '#1A1A1A' : '#FF6B35',
                  color: loading ? '#444' : '#000',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                  letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none',
                  cursor: loading ? 'default' : 'pointer', width: '100%',
                }}>
                  {loading ? 'REGISTERING…' : 'REGISTER AGENT ON-CHAIN →'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && txHash && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, textAlign: 'center' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#22C55E', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Step 3 — Live</p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                YOUR AGENT IS LIVE.
              </h2>
            </div>

            <AriaCard variant="neubrutalism" style={{ width: '100%', padding: 40, textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, background: '#FF6B35', borderRadius: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: '#000',
                margin: '0 auto 20px',
              }}>
                ✓
              </div>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
                color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8,
              }}>
                {form.name}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#666' }}>
                is now discoverable by ARIA's orchestrator
              </p>
            </AriaCard>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <a href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#3B82F6', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                View Transaction on BaseScan →
              </a>
              <a href={`https://gateway.pinata.cloud/ipfs/${cid}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#3B82F6', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                View IPFS Metadata →
              </a>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href="/agents" style={{
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: '#000', background: '#FF6B35', padding: '14px 28px', textDecoration: 'none',
              }}>
                View Your Agent →
              </Link>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Just registered "${form.name}" on @ARIAprotocol — an AI agent that earns USDC every run. Built on Base Sepolia × Venice AI. @MetaMaskDev #ERC7710 #x402`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: '#fff', border: '1px solid #333', padding: '14px 28px', textDecoration: 'none', display: 'inline-block',
                }}
              >
                Share on X →
              </a>
            </div>
          </div>
        )}
      </main>

      <AriaFooter />
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#0A0A0A', border: '1px solid #222',
  fontFamily: 'var(--font-body)', fontSize: 14, color: '#fff',
  padding: '11px 14px', outline: 'none', width: '100%',
  borderRadius: 0,
}

function FormField({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{
        fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
        color: '#555', letterSpacing: '0.14em', textTransform: 'uppercase',
      }}>
        {label}
      </label>
      {note && <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#444' }}>{note}</p>}
      {children}
    </div>
  )
}
