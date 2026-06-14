import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { paymentMiddleware } from '@x402/express'
import OpenAI from 'openai'
import { NETWORK_ID, PORT, payToAddress, resourceServer } from './config.js'
import type { AgentResult, RenderBlock, Tone } from './agent-result.js'

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
            price: '$0.30',
            network: NETWORK_ID,
            payTo: payToAddress,
            extra: { assetTransferMethod: 'erc7710' },
          },
        ],
        description: 'Market intelligence: live DEX market data + competitive landscape',
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

async function veniceChat(messages: OpenAI.ChatCompletionMessageParam[]): Promise<string> {
  const res = await venice.chat.completions.create({ model: MODEL, messages })
  return res.choices[0].message.content ?? ''
}

async function veniceSearch(query: string): Promise<string> {
  const res = await venice.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: query }],
    // @ts-expect-error Venice-specific
    venice_parameters: { enable_web_search: 'auto' },
  })
  return res.choices[0].message.content ?? ''
}

// ── Live DEX market data (DexScreener — free, no key) ─────────────────────────

type DexPair = {
  chainId: string
  url: string
  baseToken: { address: string; name: string; symbol: string }
  priceUsd?: string
  liquidity?: { usd?: number }
  volume?: { h24?: number; h6?: number }
  fdv?: number
  marketCap?: number
  pairCreatedAt?: number
  priceChange?: { h24?: number; h6?: number }
  txns?: { h24?: { buys?: number; sells?: number } }
}

async function dexScreenerBest(query: string): Promise<DexPair | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { pairs?: DexPair[] }
    const basePairs = (data.pairs ?? []).filter((p) => p.chainId === 'base')
    if (basePairs.length === 0) return null
    basePairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    return basePairs[0]
  } catch {
    return null
  }
}

const fmtUsd = (n?: number) =>
  n == null ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(2)}`
const ageDays = (ms?: number) => (ms ? Math.floor((Date.now() - ms) / 86_400_000) : null)
const momentumTone = (pct?: number): Tone => (pct == null ? 'neutral' : pct > 5 ? 'good' : pct < -5 ? 'bad' : 'neutral')

app.post('/execute', async (req: Request, res: Response) => {
  const { task, context } = req.body as { task: string; context?: Record<string, unknown> }
  const start = Date.now()

  try {
    // REASON — identify the competitor tokens to benchmark + a sentiment query.
    const planRaw = await veniceChat([
      {
        role: 'system',
        content: `From the task, identify up to 4 competitor crypto token symbols to benchmark on live market data, and write ONE web-search query to gauge narrative/sentiment in this niche. Return ONLY JSON: {"tokens":["BRETT","TOSHI"],"sentimentQuery":"..."}`,
      },
      { role: 'user', content: `Task: ${task}\nContext: ${JSON.stringify(context ?? {}).slice(0, 1200)}` },
    ])
    let plan: { tokens: string[]; sentimentQuery: string } = { tokens: [], sentimentQuery: task }
    try {
      const p = JSON.parse(planRaw.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
      plan = { tokens: Array.isArray(p.tokens) ? p.tokens.slice(0, 4) : [], sentimentQuery: p.sentimentQuery || task }
    } catch { /* defaults */ }
    if (plan.tokens.length === 0) plan.tokens = [task.split(/\s+/).slice(0, 2).join(' ')]

    // ACT — live market data for every competitor + sentiment search, all in parallel.
    const [pairs, sentiment] = await Promise.all([
      Promise.all(plan.tokens.map((t) => dexScreenerBest(t).then((p) => ({ symbol: t, pair: p })))),
      veniceSearch(`${plan.sentimentQuery} — latest narrative, momentum, community sentiment, recent news`),
    ])

    const live = pairs.filter((x) => x.pair) as { symbol: string; pair: DexPair }[]
    const blocks: RenderBlock[] = []

    // Live competitive landscape table (real numbers).
    if (live.length > 0) {
      blocks.push({
        kind: 'table',
        title: 'Live competitive landscape (Base DEXs)',
        columns: ['Token', 'Price', '24h %', 'Liquidity', '24h Vol', 'FDV', 'Age'],
        rows: live.map(({ pair }) => [
          pair.baseToken.symbol,
          pair.priceUsd ? `$${Number(pair.priceUsd).toPrecision(3)}` : '—',
          pair.priceChange?.h24 != null ? `${pair.priceChange.h24 > 0 ? '+' : ''}${pair.priceChange.h24}%` : '—',
          fmtUsd(pair.liquidity?.usd),
          fmtUsd(pair.volume?.h24),
          fmtUsd(pair.fdv),
          ageDays(pair.pairCreatedAt) != null ? `${ageDays(pair.pairCreatedAt)}d` : '—',
        ]),
      })

      // Momentum metrics for the leader.
      const leader = [...live].sort((a, b) => (b.pair.volume?.h24 ?? 0) - (a.pair.volume?.h24 ?? 0))[0]
      const buys = leader.pair.txns?.h24?.buys
      const sells = leader.pair.txns?.h24?.sells
      blocks.push({
        kind: 'metrics',
        title: `Volume leader — ${leader.pair.baseToken.symbol}`,
        items: [
          { label: '24h Volume', value: fmtUsd(leader.pair.volume?.h24), sub: 'most traded', tone: 'good' },
          { label: '24h Change', value: leader.pair.priceChange?.h24 != null ? `${leader.pair.priceChange.h24}%` : '—', tone: momentumTone(leader.pair.priceChange?.h24) },
          { label: 'Buy/Sell 24h', value: buys != null && sells != null ? `${buys}/${sells}` : '—', sub: 'tx pressure', tone: buys != null && sells != null && buys > sells ? 'good' : 'warn' },
          { label: 'Market Cap', value: fmtUsd(leader.pair.marketCap ?? leader.pair.fdv) },
        ],
      })
    }

    // SYNTHESIZE — combine real numbers with web sentiment into a market brief.
    const dataDigest = live
      .map((x) => `${x.pair.baseToken.symbol}: price $${x.pair.priceUsd ?? '?'}, 24h ${x.pair.priceChange?.h24 ?? '?'}%, liquidity ${fmtUsd(x.pair.liquidity?.usd)}, vol ${fmtUsd(x.pair.volume?.h24)}, FDV ${fmtUsd(x.pair.fdv)}`)
      .join('\n')

    const brief = await veniceChat([
      {
        role: 'system',
        content: `You are a Web3 market intelligence analyst. Combine the LIVE market data (authoritative — do not contradict the numbers) with the web sentiment to write a market brief. Markdown with sections: ## Market Overview, ## Competitor Read, ## Whitespace & Opportunity, ## Recommended Angle. Be specific and cite the real figures.`,
      },
      { role: 'user', content: `Task: ${task}\n\nLive market data:\n${dataDigest}\n\nWeb sentiment & narrative:\n${sentiment.slice(0, 4000)}` },
    ])
    blocks.push({ kind: 'markdown', title: 'Market brief', body: brief })

    if (live.length > 0) {
      blocks.push({
        kind: 'links',
        title: 'Sources',
        items: live.map((x) => ({ label: `${x.pair.baseToken.symbol} · DexScreener`, href: x.pair.url })),
      })
    }

    const headline =
      live.length > 0
        ? `${live.length} competitor${live.length > 1 ? 's' : ''} benchmarked live · leader by volume: ${[...live].sort((a, b) => (b.pair.volume?.h24 ?? 0) - (a.pair.volume?.h24 ?? 0))[0].pair.baseToken.symbol}`
        : 'No live Base market data found for the named tokens'

    const result: AgentResult = {
      status: 'success',
      agent: 'Market Intelligence',
      headline,
      blocks,
      summary: `Market intelligence (live DEX data + web sentiment):\n${dataDigest}\n\nBrief:\n${brief}`,
      provenance: 'DexScreener live pairs + Venice web search',
    }

    res.json({
      status: 'success',
      output: JSON.stringify(result),
      outputType: 'json',
      contentType: 'application/json',
      executionTime: (Date.now() - start) / 1000,
    })
  } catch (err) {
    console.error('[market-intelligence] Error:', err)
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
    agent: 'market-intelligence',
    capabilities: ['market-intelligence', 'web-search', 'competitor-analysis'],
    price: '0.30 USDC',
    network: NETWORK_ID,
    payTo: payToAddress,
  })
})

app.listen(PORT, () => {
  console.log(`[market-intelligence] Market Intelligence agent on port ${PORT}`)
  console.log(`[market-intelligence] Pay to: ${payToAddress}`)
})
