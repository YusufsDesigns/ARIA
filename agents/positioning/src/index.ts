import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { x402ExactEvmErc7710ServerScheme } from '@metamask/x402'
import { HTTPFacilitatorClient } from '@x402/core/server'
import OpenAI from 'openai'

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

async function veniceSearch(query: string): Promise<string> {
  const res = await venice.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: query }],
    // @ts-expect-error Venice-specific
    venice_parameters: { enable_web_search: 'auto' },
  })
  return res.choices[0].message.content ?? ''
}

app.post('/execute', async (req: Request, res: Response) => {
  const { task, context } = req.body as { task: string; context?: Record<string, unknown> }
  const start = Date.now()

  try {
    // STEP 1 — REASON: Analyse what the prior agents found and identify positioning levers
    const situationAnalysis = await veniceChat([
      {
        role: 'system',
        content: `You are a Web3 brand strategist. Analyse the market intelligence and technical data from prior agents and extract: (1) the 3 biggest weaknesses of existing competitors, (2) the 2 most underserved audience segments, (3) the single most defensible differentiator available to this project. Be specific and ruthless — no generic platitudes.`,
      },
      {
        role: 'user',
        content: `Task: ${task}

Prior agent findings:
${JSON.stringify(context ?? {}, null, 2)}`,
      },
    ])

    // STEP 2 — SEARCH TOOL: Research successful positioning in this space
    const positioningExamples = await veniceSearch(
      `successful Web3 crypto brand positioning differentiation examples 2024 what made them stand out`
    )

    // STEP 3 — REASON: Generate 3 distinct positioning angles and evaluate them
    const positioningOptions = await veniceChat([
      {
        role: 'system',
        content: `You are a brand strategist. Based on the situation analysis and market examples, generate exactly 3 distinct positioning angles for this project. For each angle: (1) give it a name, (2) describe the core claim in one sentence, (3) identify the target audience, (4) rate its feasibility (HIGH/MEDIUM/LOW) given what we know about the project. Return as structured text.`,
      },
      {
        role: 'user',
        content: `Situation analysis:
${situationAnalysis}

Successful positioning examples from the market:
${positioningExamples}

Task: ${task}`,
      },
    ])

    // STEP 4 — SEARCH TOOL: Validate the strongest angle — check if it's already taken
    const validationQuery = await veniceChat([
      {
        role: 'system',
        content: `From these 3 positioning options, identify the BEST one (highest feasibility + most differentiated). Then write a search query to check whether any existing project already owns that positioning. Return ONLY the search query string.`,
      },
      { role: 'user', content: positioningOptions },
    ])

    const validationResult = await veniceSearch(validationQuery.trim().replace(/^["']|["']$/g, ''))

    // STEP 5 — GENERATE STRATEGY: Produce complete positioning playbook
    const strategy = await veniceChat([
      {
        role: 'system',
        content: `You are a senior Web3 brand strategist. Based on all research, produce a definitive positioning strategy. Be opinionated — pick ONE angle, not three. Format in markdown:

## Recommended Positioning
(One sentence. This is the north star.)

## Brand Name Recommendation
(If the current name has issues, recommend an alternative and explain why.)

## Target Audience
(Specific description — not "crypto users", but who exactly and why they care.)

## Key Differentiators
(3 specific claims, each backed by evidence from the research.)

## Core Messaging
(Tagline + 3-sentence elevator pitch + 5 key talking points.)

## What to Avoid
(Positioning traps that will make this indistinguishable from competitors.)

## Launch Narrative
(The story arc for the first 30 days.)`,
      },
      {
        role: 'user',
        content: `Task: ${task}

Situation analysis:
${situationAnalysis}

Positioning options evaluated:
${positioningOptions}

Validation check (is the angle already taken?):
${validationResult}

Full context:
${JSON.stringify(context ?? {})}`,
      },
    ])

    res.json({
      status: 'success',
      output: strategy,
      outputType: 'text',
      contentType: 'text/plain',
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
