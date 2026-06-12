import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { x402ExactEvmErc7710ServerScheme } from '@metamask/x402'
import { HTTPFacilitatorClient } from '@x402/core/server'
import OpenAI from 'openai'

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
        description: 'On-chain analytics: deep blockchain data + contract risk analysis',
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
const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api'
const ETHERSCAN_CHAIN_ID = '84532' // Base Sepolia
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY ?? ''

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

async function etherscanFetch(params: Record<string, string>): Promise<unknown> {
  const url = new URL(ETHERSCAN_BASE)
  Object.entries({ chainid: ETHERSCAN_CHAIN_ID, ...params, apikey: ETHERSCAN_KEY }).forEach(([k, v]) =>
    url.searchParams.set(k, v)
  )
  const res = await fetch(url.toString())
  return res.json()
}

app.post('/execute', async (req: Request, res: Response) => {
  const { task, context } = req.body as { task: string; context?: Record<string, unknown> }
  const start = Date.now()

  try {
    // STEP 1 — REASON: Extract contract addresses and determine what on-chain data to fetch
    const extractionPlan = await veniceChat([
      {
        role: 'system',
        content: `You are a blockchain analyst. From the task and context, extract any Ethereum/Base contract addresses (0x...) mentioned. Also determine what on-chain data would be most valuable: token holders distribution, recent large transactions, liquidity pool data, or contract source verification. Return a JSON object: { "addresses": ["0x..."], "dataNeeded": ["holders", "transactions", "liquidity", "verification"] }. If no addresses are found, return { "addresses": [], "dataNeeded": ["search"] }.`,
      },
      {
        role: 'user',
        content: `Task: ${task}\nContext: ${JSON.stringify(context ?? {})}`,
      },
    ])

    let plan: { addresses: string[]; dataNeeded: string[] } = { addresses: [], dataNeeded: ['search'] }
    try {
      const parsed = JSON.parse(extractionPlan.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
      plan = { addresses: parsed.addresses ?? [], dataNeeded: parsed.dataNeeded ?? ['search'] }
    } catch { /* use defaults */ }

    // STEP 2 — SEARCH TOOL: Fetch on-chain data for each address
    const onChainResults: Record<string, unknown> = {}

    if (plan.addresses.length > 0) {
      await Promise.all(
        plan.addresses.map(async (address) => {
          const fetches: Promise<void>[] = []

          if (plan.dataNeeded.includes('holders')) {
            fetches.push(
              etherscanFetch({
                module: 'token',
                action: 'tokeninfo',
                contractaddress: address,
              }).then((d) => { onChainResults[`tokenInfo_${address}`] = d })
            )
          }

          if (plan.dataNeeded.includes('transactions')) {
            fetches.push(
              etherscanFetch({
                module: 'account',
                action: 'tokentx',
                contractaddress: address,
                page: '1',
                offset: '25',
                sort: 'desc',
              }).then((d) => { onChainResults[`recentTx_${address}`] = d })
            )
          }

          if (plan.dataNeeded.includes('liquidity') || plan.dataNeeded.includes('verification')) {
            fetches.push(
              etherscanFetch({
                module: 'contract',
                action: 'getsourcecode',
                address,
              }).then((d) => { onChainResults[`sourceCode_${address}`] = d })
            )
          }

          // Always fetch balance (quick signal of activity)
          fetches.push(
            etherscanFetch({
              module: 'stats',
              action: 'tokensupply',
              contractaddress: address,
            }).then((d) => { onChainResults[`supply_${address}`] = d })
          )

          await Promise.all(fetches)
        })
      )
    }

    // If no addresses found, use Venice web search to find contract data
    if (plan.addresses.length === 0 || plan.dataNeeded.includes('search')) {
      const searchResult = await veniceSearch(
        `${task} blockchain contract address token supply holders Base Ethereum site:basescan.org OR site:etherscan.io`
      )
      onChainResults['webSearch'] = searchResult
    }

    // STEP 3 — REASON: Identify patterns, anomalies, and risks in the raw data
    const dataAnalysis = await veniceChat([
      {
        role: 'system',
        content: `You are a blockchain security analyst. Analyse this raw on-chain data and identify: (1) token supply and distribution patterns, (2) transaction volume trends and suspicious activity, (3) contract verification status and potential rug-pull signals, (4) holder concentration risks, (5) liquidity depth. Be specific about numbers and flag risks with severity levels (HIGH/MEDIUM/LOW).`,
      },
      {
        role: 'user',
        content: `Task: ${task}

On-chain data fetched:
${JSON.stringify(onChainResults, null, 2).slice(0, 4000)}

Prior context:
${JSON.stringify(context ?? {})}`,
      },
    ])

    // STEP 4 — SEARCH TOOL: Cross-reference findings with public information
    const crossRefQuery = `${task} audit security risks token contract ${plan.addresses[0] ?? ''} site:rekt.news OR site:certik.com OR site:twitter.com`
    const crossRef = await veniceSearch(crossRefQuery)

    // STEP 5 — GENERATE STRATEGY: Produce actionable technical assessment
    const technicalReport = await veniceChat([
      {
        role: 'system',
        content: `You are a senior blockchain technical analyst. Produce a definitive technical assessment. Be concrete — include specific numbers, contract addresses, tx hashes where available. Format in markdown: ## Token Metrics, ## Contract Risk Assessment, ## Transaction Pattern Analysis, ## Security Flags, ## Technical Verdict (BUY/AVOID/MONITOR with reasoning).`,
      },
      {
        role: 'user',
        content: `Task: ${task}

On-chain analysis:
${dataAnalysis}

Cross-reference findings (audits, hacks, community reports):
${crossRef}

Market context from prior agents:
${JSON.stringify(context ?? {})}`,
      },
    ])

    res.json({
      status: 'success',
      output: technicalReport,
      outputType: 'text',
      contentType: 'text/plain',
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
  console.log(`[competitive-tech] Agent running on port ${PORT}`)
  console.log(`[competitive-tech] Pay to: ${payToAddress}`)
})
