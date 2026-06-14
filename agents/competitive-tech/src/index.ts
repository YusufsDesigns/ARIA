import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { x402ExactEvmErc7710ServerScheme } from '@metamask/x402'
import { HTTPFacilitatorClient } from '@x402/core/server'
import OpenAI from 'openai'
import type { AgentResult, RenderBlock, Tone } from './agent-result.js'

const NETWORK_ID = 'eip155:84532'
const PORT = process.env.PORT ?? 4002
const payToAddress = (
  process.env.AGENT_COMPETITIVE_TECH_PAY_TO ?? process.env.ORCHESTRATOR_SESSION_ADDRESS!
) as `0x${string}`

const facilitatorClient = new HTTPFacilitatorClient({
  url:
    process.env.METAMASK_FACILITATOR_URL ??
    'https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402',
})

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK_ID,
  new x402ExactEvmErc7710ServerScheme()
)

const app = express()
app.use(cors({ exposedHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE'] }))
app.use(express.json())

app.use(
  paymentMiddleware(
    {
      'POST /execute': {
        accepts: [
          {
            scheme: 'exact',
            price: '$0.50',
            network: NETWORK_ID,
            payTo: payToAddress,
            extra: { assetTransferMethod: 'erc7710' },
          },
        ],
        description: 'On-chain analytics: live Base token data + verifiable risk assessment',
        mimeType: 'application/json',
      },
    },
    resourceServer
  )
)

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY!,
  baseURL: 'https://api.venice.ai/api/v1',
})
const MODEL = 'llama-3.3-70b'

// Real on-chain data sources — these are what a chat model cannot reach.
const BASE_RPC = process.env.BASE_MAINNET_RPC ?? 'https://mainnet.base.org'
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY ?? ''
const BASE_CHAINID = '8453'

async function veniceChat(messages: OpenAI.ChatCompletionMessageParam[]): Promise<string> {
  const res = await venice.chat.completions.create({ model: MODEL, messages })
  return res.choices[0].message.content ?? ''
}

// ── Real data helpers ────────────────────────────────────────────────────────

type DexPair = {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  baseToken: { address: string; name: string; symbol: string }
  priceUsd?: string
  liquidity?: { usd?: number }
  volume?: { h24?: number }
  fdv?: number
  marketCap?: number
  pairCreatedAt?: number
  priceChange?: { h24?: number }
}

// DexScreener: live DEX market + token data, free, no API key.
async function dexScreenerBest(query: string): Promise<DexPair | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      { headers: { accept: 'application/json' } }
    )
    if (!res.ok) return null
    const data = (await res.json()) as { pairs?: DexPair[] }
    const basePairs = (data.pairs ?? []).filter((p) => p.chainId === 'base')
    if (basePairs.length === 0) return null
    // Highest-liquidity pair is the canonical one.
    basePairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    return basePairs[0]
  } catch {
    return null
  }
}

async function rpcCall(method: string, params: unknown[]): Promise<string | null> {
  try {
    const res = await fetch(BASE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    const json = (await res.json()) as { result?: string }
    return json.result ?? null
  } catch {
    return null
  }
}

// eth_call totalSupply() (selector 0x18160ddd) + decimals() (0x313ce567)
async function onChainSupply(address: string): Promise<{ supply: number | null; decimals: number }> {
  const [supplyHex, decHex] = await Promise.all([
    rpcCall('eth_call', [{ to: address, data: '0x18160ddd' }, 'latest']),
    rpcCall('eth_call', [{ to: address, data: '0x313ce567' }, 'latest']),
  ])
  const decimals = decHex && decHex !== '0x' ? parseInt(decHex, 16) : 18
  if (!supplyHex || supplyHex === '0x') return { supply: null, decimals }
  try {
    const raw = BigInt(supplyHex)
    return { supply: Number(raw / 10n ** BigInt(decimals)), decimals }
  } catch {
    return { supply: null, decimals }
  }
}

async function isDeployedContract(address: string): Promise<boolean> {
  const code = await rpcCall('eth_getCode', [address, 'latest'])
  return !!code && code !== '0x'
}

// Etherscan v2 (Base) source verification status.
async function isVerified(address: string): Promise<{ verified: boolean; name?: string }> {
  if (!ETHERSCAN_KEY) return { verified: false }
  try {
    const url = `https://api.etherscan.io/v2/api?chainid=${BASE_CHAINID}&module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_KEY}`
    const res = await fetch(url)
    const data = (await res.json()) as { result?: Array<{ SourceCode?: string; ContractName?: string }> }
    const entry = data.result?.[0]
    const verified = !!entry?.SourceCode && entry.SourceCode.length > 0
    return { verified, name: entry?.ContractName || undefined }
  } catch {
    return { verified: false }
  }
}

// ── Formatting ───────────────────────────────────────────────────────────────

const fmtUsd = (n?: number) =>
  n == null ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(2)}`
const fmtNum = (n?: number | null) =>
  n == null ? '—' : n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n.toLocaleString()}`
const ageDays = (ms?: number) => (ms ? Math.floor((Date.now() - ms) / 86_400_000) : null)

function liquidityTone(usd?: number): Tone {
  if (usd == null) return 'neutral'
  if (usd >= 500_000) return 'good'
  if (usd >= 50_000) return 'warn'
  return 'bad'
}

// ── Per-token on-chain profile (all real, all verifiable) ────────────────────

type TokenProfile = {
  symbol: string
  found: boolean
  pair?: DexPair
  supply?: number | null
  decimals?: number
  deployed?: boolean
  verified?: boolean
  contractName?: string
}

async function profileToken(symbol: string): Promise<TokenProfile> {
  const pair = await dexScreenerBest(symbol)
  if (!pair) return { symbol, found: false }
  const addr = pair.baseToken.address
  const [{ supply, decimals }, deployed, ver] = await Promise.all([
    onChainSupply(addr),
    isDeployedContract(addr),
    isVerified(addr),
  ])
  return {
    symbol: pair.baseToken.symbol || symbol,
    found: true,
    pair,
    supply,
    decimals,
    deployed,
    verified: ver.verified,
    contractName: ver.name,
  }
}

function tokenBlocks(p: TokenProfile): RenderBlock[] {
  if (!p.found || !p.pair) {
    return [
      {
        kind: 'badges',
        title: `${p.symbol.toUpperCase()} — not found on Base DEXs`,
        items: [
          { label: 'No live trading pair', tone: 'neutral', detail: 'Name appears unclaimed on Base — clear runway for a new launch.' },
        ],
      },
    ]
  }
  const pair = p.pair
  const liq = pair.liquidity?.usd
  const days = ageDays(pair.pairCreatedAt)
  const baseScan = `https://basescan.org/token/${pair.baseToken.address}`
  const blocks: RenderBlock[] = [
    {
      kind: 'metrics',
      title: `${p.symbol.toUpperCase()} — live on-chain metrics`,
      items: [
        { label: 'Price', value: pair.priceUsd ? `$${Number(pair.priceUsd).toPrecision(4)}` : '—', sub: pair.priceChange?.h24 != null ? `${pair.priceChange.h24 > 0 ? '+' : ''}${pair.priceChange.h24}% 24h` : undefined, tone: (pair.priceChange?.h24 ?? 0) >= 0 ? 'good' : 'bad' },
        { label: 'Liquidity', value: fmtUsd(liq), sub: 'pool depth', tone: liquidityTone(liq) },
        { label: '24h Volume', value: fmtUsd(pair.volume?.h24), sub: 'traded' },
        { label: 'FDV', value: fmtUsd(pair.fdv), sub: 'fully diluted' },
        { label: 'Total Supply', value: fmtNum(p.supply), sub: p.supply != null ? 'on-chain (eth_call)' : 'unavailable', href: baseScan },
        { label: 'Pair Age', value: days != null ? `${days}d` : '—', sub: days != null && days < 30 ? 'new' : 'established', tone: days != null && days < 14 ? 'warn' : 'neutral' },
      ],
    },
    {
      kind: 'badges',
      title: 'Risk signals (computed from live data)',
      items: [
        p.verified
          ? { label: 'Contract verified', tone: 'good', detail: p.contractName ? `${p.contractName} · BaseScan` : 'Source verified on BaseScan' }
          : { label: 'Unverified source', tone: 'bad', detail: 'No verified source on BaseScan — higher rug risk' },
        p.deployed
          ? { label: 'Live bytecode confirmed', tone: 'good', detail: 'eth_getCode returned contract code' }
          : { label: 'No bytecode', tone: 'bad', detail: 'Address has no contract code' },
        liquidityTone(liq) === 'good'
          ? { label: 'Deep liquidity', tone: 'good', detail: `${fmtUsd(liq)} — hard to rug` }
          : liquidityTone(liq) === 'warn'
          ? { label: 'Moderate liquidity', tone: 'warn', detail: `${fmtUsd(liq)} — exit-risk on size` }
          : { label: 'Thin liquidity', tone: 'bad', detail: `${fmtUsd(liq)} — easily manipulated` },
      ],
    },
    {
      kind: 'links',
      items: [
        { label: `${p.symbol.toUpperCase()} on BaseScan`, href: baseScan },
        { label: `${p.symbol.toUpperCase()} on DexScreener`, href: pair.url },
      ],
    },
  ]
  return blocks
}

app.post('/execute', async (req: Request, res: Response) => {
  const { task, context } = req.body as { task: string; context?: Record<string, unknown> }
  const start = Date.now()

  try {
    // REASON — extract the token symbols/names to analyse from the task + context.
    const extraction = await veniceChat([
      {
        role: 'system',
        content: `Extract the crypto token names/symbols that should be analysed on-chain from the task. Include both competitors mentioned and any proposed new token. Return ONLY a JSON array of short symbol/name strings (max 5), no other text. Example: ["BRETT","TOSHI","LUNARPUP"]`,
      },
      { role: 'user', content: `Task: ${task}\nContext: ${JSON.stringify(context ?? {}).slice(0, 1200)}` },
    ])
    let symbols: string[] = []
    try {
      symbols = JSON.parse(extraction.match(/\[[\s\S]*\]/)?.[0] ?? '[]')
    } catch { /* ignore */ }
    symbols = (Array.isArray(symbols) ? symbols : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
    if (symbols.length === 0) symbols = [task.split(/\s+/).slice(0, 2).join(' ')]

    // ACT — pull live, verifiable on-chain data for every token in parallel.
    const profiles = await Promise.all(symbols.map(profileToken))

    // Build the structured render payload from REAL data (no LLM in the numbers).
    const blocks: RenderBlock[] = []
    const found = profiles.filter((p) => p.found)
    if (found.length > 1) {
      blocks.push({
        kind: 'table',
        title: 'Live comparison (Base mainnet)',
        columns: ['Token', 'Price', 'Liquidity', '24h Vol', 'FDV', 'Verified'],
        rows: found.map((p) => [
          p.symbol.toUpperCase(),
          p.pair?.priceUsd ? `$${Number(p.pair.priceUsd).toPrecision(3)}` : '—',
          fmtUsd(p.pair?.liquidity?.usd),
          fmtUsd(p.pair?.volume?.h24),
          fmtUsd(p.pair?.fdv),
          p.verified ? '✓' : '✗',
        ]),
      })
    }
    for (const p of profiles) blocks.push(...tokenBlocks(p))

    // SYNTHESIZE — one Venice call turns the verified data into a risk verdict.
    const dataDigest = profiles
      .map((p) =>
        p.found
          ? `${p.symbol}: price $${p.pair?.priceUsd ?? '?'}, liquidity ${fmtUsd(p.pair?.liquidity?.usd)}, 24h vol ${fmtUsd(p.pair?.volume?.h24)}, FDV ${fmtUsd(p.pair?.fdv)}, age ${ageDays(p.pair?.pairCreatedAt) ?? '?'}d, verified ${p.verified}, supply ${fmtNum(p.supply)}`
          : `${p.symbol}: no live Base pair found (name appears unclaimed)`
      )
      .join('\n')

    const verdict = await veniceChat([
      {
        role: 'system',
        content: `You are a blockchain security analyst. You are given REAL, live on-chain data (DexScreener + Base RPC + BaseScan verification). Write a concise markdown verdict: which tokens are healthy vs at-risk and why, citing the actual numbers. End with a one-line recommendation. Do NOT invent numbers beyond what is given.`,
      },
      { role: 'user', content: `Task: ${task}\n\nVerified on-chain data:\n${dataDigest}` },
    ])
    blocks.push({ kind: 'markdown', title: 'Analyst verdict', body: verdict })

    const healthy = found.filter((p) => liquidityTone(p.pair?.liquidity?.usd) === 'good' && p.verified)
    const headline =
      found.length === 0
        ? `No live Base pairs found for ${symbols.join(', ')}`
        : `${found.length} token${found.length > 1 ? 's' : ''} analysed live · ${healthy.length} healthy`

    const result: AgentResult = {
      status: 'success',
      agent: 'On-chain Analytics',
      headline,
      blocks,
      summary: `On-chain analysis (live Base data):\n${dataDigest}\n\nVerdict:\n${verdict}`,
      provenance: 'DexScreener + Base RPC (eth_call) + BaseScan verification',
    }

    res.json({
      status: 'success',
      output: JSON.stringify(result),
      outputType: 'json',
      contentType: 'application/json',
      executionTime: (Date.now() - start) / 1000,
    })
  } catch (err) {
    console.error('[competitive-tech] Error:', err)
    res.status(500).json({
      status: 'error',
      output: String(err),
      outputType: 'text',
      contentType: 'text/plain',
      executionTime: (Date.now() - start) / 1000,
    })
  }
})

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    agent: 'competitive-tech',
    capabilities: ['onchain-analytics', 'smart-contract-analysis', 'blockchain-data'],
    price: '0.50 USDC',
    network: NETWORK_ID,
    payTo: payToAddress,
  })
})

app.listen(PORT, () => {
  console.log(`[competitive-tech] On-chain Analytics agent on port ${PORT}`)
  console.log(`[competitive-tech] Pay to: ${payToAddress}`)
})
