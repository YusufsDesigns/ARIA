import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { x402ExactEvmErc7710ServerScheme } from '@metamask/x402'
import { HTTPFacilitatorClient } from '@x402/core/server'
import OpenAI from 'openai'
import { randomUUID } from 'crypto'
import type { AgentResult, RenderBlock } from './agent-result.js'

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
app.use(express.json({ limit: '10mb' }))

// ── Two-phase async job store ─────────────────────────────────────────────────
// Image generation + TTS run ~25s synchronously, which can overrun Railway's
// request window on a buffered x402 request (surfacing as `TypeError: terminated`).
// So the paid POST only STARTS the job and returns a jobId; the work runs out of
// band and is collected via the free GET /result/:jobId poll. Same pattern as the
// video + competitive-tech agents.
type Job = { status: 'processing' | 'done' | 'error'; result?: AgentResult; error?: string; createdAt: number }
const jobStore = new Map<string, Job>()

function processingResult(jobId: string): AgentResult {
  return {
    status: 'processing',
    agent: 'Visual Asset',
    jobId,
    headline: 'Designing your banner + announcement…',
    blocks: [
      { kind: 'badges', title: 'Status', items: [{ label: 'Generating banner + voiced announcement', tone: 'warn', detail: 'Venice image + TTS in progress.' }] },
    ],
    summary: 'Generating a launch banner and a voiced announcement…',
    provenance: 'Venice fluently-xl (image) + tts-kokoro (audio)',
  }
}

// Phase 2 — FREE polling endpoint, registered BEFORE the x402 gate so it is not
// charged. Each call returns immediately, so no request is held open long enough
// to be terminated.
app.get('/result/:jobId', (req: Request, res: Response) => {
  const job = jobStore.get(req.params.jobId)
  if (!job) {
    res.status(404).json({ error: 'Job not found or expired' })
    return
  }
  if (job.status === 'done' && job.result) {
    res.json({ done: true, status: job.result.status, output: JSON.stringify(job.result), outputType: 'json', contentType: 'application/json', executionTime: 0 })
    return
  }
  if (job.status === 'error') {
    res.json({ done: true, status: 'error', output: job.error ?? 'Visual generation failed', outputType: 'text', contentType: 'text/plain', executionTime: 0 })
    return
  }
  // Safety timeout — surface an error so the orchestrator falls back cleanly.
  if (Date.now() - job.createdAt > 120_000) {
    res.json({ done: true, status: 'error', output: 'Visual generation timed out', outputType: 'text', contentType: 'text/plain', executionTime: 0 })
    return
  }
  res.json({ done: false, status: 'processing', output: JSON.stringify(processingResult(req.params.jobId)), outputType: 'json', contentType: 'application/json', executionTime: 0, jobId: req.params.jobId })
})

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

type BrandBrief = { mood: string; colors: string[]; metaphors: string[]; avoid: string[]; imagePrompt: string }

// The heavy creative work — runs out of band (see POST /execute). Returns the
// final structured result; throws on hard failure (caught by caller → job error).
async function runVisualWork(task: string, context?: Record<string, unknown>): Promise<AgentResult> {
  const contextStr = JSON.stringify(context ?? {}).slice(0, 4000)

  {
    // REASON — one call derives the brand identity AND the image prompt together.
    // (Web-search step removed to keep the paid request fast — no 502.)
    const briefRaw = await veniceChat([
      {
        role: 'system',
        content: `You are a visual brand director. From the positioning, produce the brand visual identity AND a ready-to-use image-generation prompt for a 1024x1024 launch banner. Return ONLY JSON:
{
  "mood": "dominant mood",
  "colors": ["#hex1","#hex2","#hex3"],
  "metaphors": ["visual metaphor", "..."],
  "avoid": ["cliché to avoid", "..."],
  "imagePrompt": "detailed Flux/SDXL prompt: art style, lighting, mood, palette, composition, quality modifiers. NO text/words in the image."
}`,
      },
      { role: 'user', content: `Task: ${task}\n\nPositioning from prior agents:\n${contextStr}` },
    ])

    let brief: BrandBrief = {
      mood: 'bold and innovative',
      colors: ['#FF6B35', '#000000', '#FFFFFF'],
      metaphors: ['launch', 'movement'],
      avoid: ['generic rocket ships', 'copy-paste moon imagery'],
      imagePrompt: `A bold, cinematic crypto launch banner, dramatic orange and black palette, volumetric lighting, premium 3D render, high detail, no text — theme: ${task}`,
    }
    try {
      const parsed = JSON.parse(briefRaw.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
      if (parsed.imagePrompt) brief = { ...brief, ...parsed }
    } catch { /* use defaults */ }

    // ACT — image generation runs in parallel with (announcement script → TTS).
    const imagePromptTrimmed = brief.imagePrompt.slice(0, 1500)
    const [imageResult, voiced] = await Promise.all([
      venice.images.generate({ model: 'fluently-xl', prompt: imagePromptTrimmed, n: 1, size: '1024x1024' }),
      (async () => {
        const script = await veniceChat([
          {
            role: 'system',
            content: `You are a crypto launch copywriter. Write a punchy 30-second spoken announcement (80-100 words). Energetic, clear, credible. No clichés like "to the moon" or "diamond hands". Hook → what it is → why it matters → call to action. Natural when read aloud.`,
          },
          { role: 'user', content: `Project: ${task}\nPositioning: ${contextStr}` },
        ])
        const audioRes = await venice.audio.speech.create({ model: 'tts-kokoro', input: script, voice: 'af_sky' })
        const audioBuf = Buffer.from(await (audioRes as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer())
        return { script, audioB64: audioBuf.toString('base64') }
      })(),
    ])

    const imageB64 = imageResult.data?.[0]?.b64_json ?? null
    const imageUrl = imageResult.data?.[0]?.url ?? null

    const blocks: RenderBlock[] = []
    blocks.push({
      kind: 'image',
      title: 'Launch banner',
      b64: imageB64 ?? undefined,
      url: imageUrl ?? undefined,
      prompt: brief.imagePrompt,
      alt: `Launch banner — ${brief.mood}`,
    })
    blocks.push({
      kind: 'audio',
      title: 'Voiced announcement',
      b64: voiced.audioB64,
      contentType: 'audio/mpeg',
      script: voiced.script,
    })
    blocks.push({
      kind: 'badges',
      title: 'Brand direction',
      items: [
        { label: brief.mood, tone: 'good', detail: 'mood' },
        ...brief.colors.slice(0, 3).map((c) => ({ label: c, tone: 'neutral' as const, detail: 'palette' })),
      ],
    })
    if (brief.metaphors?.length || brief.avoid?.length) {
      blocks.push({
        kind: 'markdown',
        title: 'Creative rationale',
        body: `**Visual metaphors:** ${(brief.metaphors ?? []).join(', ') || '—'}\n\n**Deliberately avoided:** ${(brief.avoid ?? []).join(', ') || '—'}`,
      })
    }

    return {
      status: 'success',
      agent: 'Visual Asset',
      headline: `Launch banner + voiced announcement generated (${brief.mood})`,
      blocks,
      // summary carries NO base64 — only the text the orchestrator/synthesis needs.
      summary: `Generated a launch banner (mood: ${brief.mood}, palette: ${(brief.colors ?? []).join(', ')}) and a voiced announcement.\nAnnouncement script: ${voiced.script}`,
      provenance: 'Venice fluently-xl (image) + tts-kokoro (audio) — zero retention',
    }
  }
}

// Phase 1 — PAID. Starts the creative work out of band and returns a jobId
// immediately so the x402 request settles fast; the orchestrator polls /result.
app.post('/execute', async (req: Request, res: Response) => {
  const { task, context } = req.body as { task: string; context?: Record<string, unknown> }
  const start = Date.now()
  const jobId = randomUUID()
  jobStore.set(jobId, { status: 'processing', createdAt: Date.now() })

  runVisualWork(task, context)
    .then((result) => jobStore.set(jobId, { status: 'done', result, createdAt: Date.now() }))
    .catch((err) => {
      console.error('[visual-asset] generation error:', err)
      jobStore.set(jobId, { status: 'error', error: String(err), createdAt: Date.now() })
    })

  res.json({
    status: 'success', // x402-level: the paid request succeeded (job accepted)
    output: JSON.stringify(processingResult(jobId)),
    outputType: 'json',
    contentType: 'application/json',
    executionTime: (Date.now() - start) / 1000,
    jobId, // signals the orchestrator to poll /result/:jobId
  })
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
