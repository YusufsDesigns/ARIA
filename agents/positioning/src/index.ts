import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { x402ExactEvmErc7710ServerScheme } from '@metamask/x402'
import { HTTPFacilitatorClient } from '@x402/core/server'
import OpenAI from 'openai'
import type { AgentResult, RenderBlock, Tone } from './agent-result.js'

const NETWORK_ID = 'eip155:84532'
const PORT = process.env.PORT ?? 4003
const payToAddress = (
  process.env.AGENT_POSITIONING_PAY_TO ?? process.env.ORCHESTRATOR_SESSION_ADDRESS!
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
            price: '$0.20',
            network: NETWORK_ID,
            payTo: payToAddress,
            extra: { assetTransferMethod: 'erc7710' },
          },
        ],
        description: 'Positioning & strategy: differentiation analysis + brand messaging',
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

const toneFor = (feasibility?: string): Tone => {
  const f = (feasibility ?? '').toUpperCase()
  return f.includes('HIGH') ? 'good' : f.includes('LOW') ? 'bad' : 'warn'
}

app.post('/execute', async (req: Request, res: Response) => {
  const { task, context } = req.body as { task: string; context?: Record<string, unknown> }
  const start = Date.now()
  const contextStr = JSON.stringify(context ?? {}).slice(0, 6000)

  try {
    // Two Venice calls in parallel — both grounded in the REAL data the prior
    // agents produced (live on-chain + market metrics in `context`). No web
    // search: keeps the paid request fast (no 502) while staying differentiated
    // because the strategy is anchored to verified competitor numbers, not vibes.
    const [structuredRaw, narrative] = await Promise.all([
      // (A) Structured strategy as JSON — drives the rich UI blocks.
      veniceChat([
        {
          role: 'system',
          content: `You are a ruthless Web3 brand strategist. Using the prior agents' REAL market + on-chain findings, decide ONE positioning. Return ONLY JSON:
{
  "positioning": "one-sentence north-star positioning",
  "nameDecision": { "verdict": "KEEP" | "REBRAND", "name": "recommended name", "reason": "why" },
  "feasibility": "HIGH" | "MEDIUM" | "LOW",
  "tagline": "short memorable tagline",
  "persona": "the specific target buyer (not 'crypto users')",
  "differentiators": [ { "dimension": "e.g. Liquidity story", "thisProject": "...", "competitors": "..." } ],
  "talkingPoints": ["...", "...", "..."]
}
Base every claim on the provided data. 3 differentiators.`,
        },
        { role: 'user', content: `Task: ${task}\n\nPrior agent findings (real data):\n${contextStr}` },
      ]),
      // (B) Launch narrative as markdown — the readable playbook.
      veniceChat([
        {
          role: 'system',
          content: `You are a senior Web3 brand strategist. Write a tight launch playbook in markdown grounded in the prior agents' real findings. Sections: ## Positioning Rationale, ## Key Differentiators (evidence-backed), ## What to Avoid, ## 30-Day Launch Narrative. Be opinionated and specific — cite real competitor numbers where given.`,
        },
        { role: 'user', content: `Task: ${task}\n\nPrior agent findings (real data):\n${contextStr}` },
      ]),
    ])

    type Strategy = {
      positioning?: string
      nameDecision?: { verdict?: string; name?: string; reason?: string }
      feasibility?: string
      tagline?: string
      persona?: string
      differentiators?: { dimension?: string; thisProject?: string; competitors?: string }[]
      talkingPoints?: string[]
    }
    let s: Strategy = {}
    try {
      s = JSON.parse(structuredRaw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Strategy
    } catch { /* fall back to narrative-only */ }

    const blocks: RenderBlock[] = []

    if (s.positioning) {
      blocks.push({ kind: 'markdown', title: 'Recommended positioning', body: `**${s.positioning}**${s.tagline ? `\n\n_“${s.tagline}”_` : ''}` })
    }

    const decisionBadges: { label: string; tone: Tone; detail?: string }[] = []
    if (s.nameDecision?.verdict) {
      decisionBadges.push({
        label: s.nameDecision.verdict === 'REBRAND' ? `Rebrand → ${s.nameDecision.name ?? '?'}` : 'Keep the name',
        tone: s.nameDecision.verdict === 'REBRAND' ? 'warn' : 'good',
        detail: s.nameDecision.reason,
      })
    }
    if (s.feasibility) decisionBadges.push({ label: `Feasibility: ${s.feasibility}`, tone: toneFor(s.feasibility) })
    if (s.persona) decisionBadges.push({ label: 'Target', tone: 'neutral', detail: s.persona })
    if (decisionBadges.length > 0) blocks.push({ kind: 'badges', title: 'Strategic call', items: decisionBadges })

    if (s.differentiators && s.differentiators.length > 0) {
      blocks.push({
        kind: 'table',
        title: 'Differentiation matrix',
        columns: ['Dimension', 'This project', 'Competitors'],
        rows: s.differentiators.map((d) => [d.dimension ?? '—', d.thisProject ?? '—', d.competitors ?? '—']),
      })
    }

    if (s.talkingPoints && s.talkingPoints.length > 0) {
      blocks.push({ kind: 'markdown', title: 'Key talking points', body: s.talkingPoints.map((t) => `- ${t}`).join('\n') })
    }

    blocks.push({ kind: 'markdown', title: 'Launch playbook', body: narrative })

    const headline = s.positioning
      ? s.positioning.slice(0, 120)
      : s.nameDecision?.verdict === 'REBRAND'
      ? `Rebrand recommended → ${s.nameDecision.name}`
      : 'Positioning strategy ready'

    const result: AgentResult = {
      status: 'success',
      agent: 'Positioning & Strategy',
      headline,
      blocks,
      summary: `Positioning: ${s.positioning ?? '(see narrative)'}\nName: ${s.nameDecision?.verdict ?? '?'} ${s.nameDecision?.name ?? ''}\nTagline: ${s.tagline ?? ''}\nPersona: ${s.persona ?? ''}\n\nPlaybook:\n${narrative}`,
      provenance: 'Strategy grounded in prior agents’ live on-chain + market data',
    }

    res.json({
      status: 'success',
      output: JSON.stringify(result),
      outputType: 'json',
      contentType: 'application/json',
      executionTime: (Date.now() - start) / 1000,
    })
  } catch (err) {
    console.error('[positioning] Error:', err)
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
    agent: 'positioning',
    capabilities: ['strategy', 'positioning', 'copywriting', 'marketing'],
    price: '0.20 USDC',
    network: NETWORK_ID,
    payTo: payToAddress,
  })
})

app.listen(PORT, () => {
  console.log(`[positioning] Agent running on port ${PORT}`)
  console.log(`[positioning] Pay to: ${payToAddress}`)
})
