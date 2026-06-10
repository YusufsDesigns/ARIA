import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { x402ExactEvmErc7710ServerScheme } from '@metamask/x402'
import { HTTPFacilitatorClient } from '@x402/core/server'
import OpenAI from 'openai'

const NETWORK_ID = 'eip155:84532'
const PORT = process.env.PORT ?? 4004
const payToAddress = (
  process.env.AGENT_VISUAL_ASSET_PAY_TO ?? process.env.ORCHESTRATOR_SESSION_ADDRESS!
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
            price: '$0.40',
            network: NETWORK_ID,
            payTo: payToAddress,
            extra: { assetTransferMethod: 'erc7710' },
          },
        ],
        description: 'Visual assets: brand-aligned launch banner + TTS announcement',
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
    // STEP 1 — REASON: Extract brand identity from positioning strategy
    const brandExtraction = await veniceChat([
      {
        role: 'system',
        content: `You are a visual brand director. Extract the core visual identity elements from the positioning strategy: (1) dominant emotion/mood (e.g. bold/mysterious/playful/premium), (2) color palette suggestion (3 hex codes with rationale), (3) visual metaphors that represent the brand's differentiation, (4) what to AVOID visually (what makes it look like every other crypto project). Return as structured JSON: { "mood": "", "colors": ["#hex1","#hex2","#hex3"], "metaphors": [], "avoid": [] }`,
      },
      {
        role: 'user',
        content: `Task: ${task}

Strategy and positioning from prior agents:
${JSON.stringify(context ?? {}, null, 2)}`,
      },
    ])

    let brandIdentity = { mood: 'bold and innovative', colors: ['#FF6B35', '#000000', '#FFFFFF'], metaphors: ['launch', 'movement'], avoid: ['generic rocket ships', 'copy-paste moon imagery'] }
    try {
      const parsed = JSON.parse(brandExtraction.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
      if (parsed.mood) brandIdentity = parsed
    } catch { /* use defaults */ }

    // STEP 2 — SEARCH TOOL: Research visual trends in this specific crypto niche
    const visualTrends = await veniceSearch(
      `${task} crypto project visual branding design trends 2024 what makes memorable launch banner`
    )

    // STEP 3 — REASON: Craft a precise, detailed image generation prompt
    const imagePrompt = await veniceChat([
      {
        role: 'system',
        content: `You are an expert at writing Stable Diffusion / Flux image generation prompts. Write a detailed prompt for a crypto project launch banner (1024x1024). The prompt must: specify art style, lighting, mood, color palette, composition, and key visual elements. Include technical quality modifiers. Do NOT include text/words in the image — it's a background banner. Return ONLY the prompt, no explanation.`,
      },
      {
        role: 'user',
        content: `Brand identity: ${JSON.stringify(brandIdentity)}
Visual trends research: ${visualTrends.slice(0, 800)}
Project context: ${JSON.stringify(context ?? {})}
Task: ${task}`,
      },
    ])

    // STEP 4 — SEARCH TOOL (generate assets): Image + announcement script in parallel
    const [imageResult, announcementScript] = await Promise.all([
      venice.images.generate({
        model: 'fluently-xl',
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024',
      }),
      veniceChat([
        {
          role: 'system',
          content: `You are a crypto launch copywriter. Write a punchy 30-second TTS announcement (80-100 words). It should feel like an exciting product launch — energetic, clear, credible. No hype clichés like "to the moon" or "diamond hands". Open with a hook, state what it is, why it matters, and end with a call to action. Make it sound natural when spoken aloud.`,
        },
        {
          role: 'user',
          content: `Project: ${task}
Positioning: ${JSON.stringify(context ?? {})}`,
        },
      ]),
    ])

    // STEP 5 — GENERATE STRATEGY: TTS audio + assemble final package
    const audioRes = await venice.audio.speech.create({
      model: 'tts-kokoro',
      input: announcementScript,
      voice: 'af_sky',
    })
    const audioBuf = Buffer.from(
      await (audioRes as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer()
    )

    const output = JSON.stringify({
      image: imageResult.data?.[0]?.b64_json ?? null,
      imageUrl: imageResult.data?.[0]?.url ?? null,
      imagePrompt,
      brandIdentity,
      audioScript: announcementScript,
      audio: audioBuf.toString('base64'),
      audioMimeType: 'audio/mpeg',
    })

    res.json({
      status: 'success',
      output,
      outputType: 'json',
      contentType: 'application/json',
      executionTime: (Date.now() - start) / 1000,
    })
  } catch (err) {
    console.error('[visual-asset] Error:', err)
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
    agent: 'visual-asset',
    capabilities: ['image-generation', 'visual-design', 'brand-assets', 'tts', 'audio-production'],
    price: '0.40 USDC',
    network: NETWORK_ID,
    payTo: payToAddress,
  })
})

app.listen(PORT, () => {
  console.log(`[visual-asset] Agent running on port ${PORT}`)
  console.log(`[visual-asset] Pay to: ${payToAddress}`)
})
