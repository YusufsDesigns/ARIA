import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { paymentMiddleware } from '@x402/express'
import OpenAI from 'openai'
import { NETWORK_ID, PORT, payToAddress, resourceServer } from './config.js'

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
        description: 'Market intelligence: multi-query web research + competitor analysis',
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
    // STEP 1 — REASON: Break task into specific research questions
    const researchPlan = await veniceChat([
      {
        role: 'system',
        content: `You are a Web3 market intelligence specialist. Your job is to decompose a research task into 3 specific, targeted search queries that will yield the most useful data. Each query should target a different angle: (1) current market/price data, (2) competitor landscape, (3) community sentiment or recent news. Return ONLY a JSON array of 3 query strings, no other text.`,
      },
      {
        role: 'user',
        content: `Task: ${task}\nContext from prior agents: ${JSON.stringify(context ?? {})}`,
      },
    ])

    let queries: string[] = []
    try {
      queries = JSON.parse(researchPlan)
    } catch {
      // Fallback if model didn't return pure JSON
      queries = [
        `${task} market data price competitors 2024`,
        `${task} crypto project analysis risks opportunities`,
        `${task} community sentiment recent news`,
      ]
    }

    // STEP 2 — SEARCH TOOL: Run all 3 targeted queries in parallel
    const searchResults = await Promise.all(queries.map((q) => veniceSearch(q)))

    // STEP 3 — REASON: Identify gaps and contradictions in findings
    const gapAnalysis = await veniceChat([
      {
        role: 'system',
        content: `You are a critical market analyst. Review these research findings and identify: (1) key facts confirmed across multiple sources, (2) contradictions or uncertain claims, (3) important data that is still missing. Be direct and specific.`,
      },
      {
        role: 'user',
        content: searchResults.map((r, i) => `Query ${i + 1}: "${queries[i]}"\nFindings:\n${r}`).join('\n\n---\n\n'),
      },
    ])

    // STEP 4 — SEARCH TOOL (targeted follow-up): Fill the most critical gap
    const followUpQuery = await veniceChat([
      {
        role: 'system',
        content: `Based on the gap analysis, write ONE targeted follow-up search query to fill the most critical missing piece of information. Return ONLY the query string.`,
      },
      { role: 'user', content: gapAnalysis },
    ])
    const followUpResult = await veniceSearch(followUpQuery.trim().replace(/^["']|["']$/g, ''))

    // STEP 5 — GENERATE STRATEGY: Synthesize all findings into structured intelligence report
    const report = await veniceChat([
      {
        role: 'system',
        content: `You are a senior Web3 market intelligence analyst. Synthesize all research into a structured report. Be specific — include names, numbers, dates. Flag risks clearly. Format in markdown with these sections: ## Market Overview, ## Key Competitors, ## Risks & Red Flags, ## Opportunities, ## Recommended Next Steps.`,
      },
      {
        role: 'user',
        content: `Original task: ${task}

Research findings:
${searchResults.map((r, i) => `### Query: "${queries[i]}"\n${r}`).join('\n\n')}

Gap analysis:
${gapAnalysis}

Follow-up research:
### Query: "${followUpQuery}"
${followUpResult}`,
      },
    ])

    res.json({
      status: 'success',
      output: report,
      outputType: 'text',
      contentType: 'text/plain',
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
  console.log(`[market-intelligence] Agent running on port ${PORT}`)
  console.log(`[market-intelligence] Pay to: ${payToAddress}`)
})
