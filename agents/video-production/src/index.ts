import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { x402ExactEvmErc7710ServerScheme } from '@metamask/x402'
import { HTTPFacilitatorClient } from '@x402/core/server'
import OpenAI from 'openai'

// ─── Config ──────────────────────────────────────────────────────────────────

const NETWORK_ID = 'eip155:84532' // Base Sepolia
const PORT = Number(process.env.PORT ?? 4005)
const VENICE_API_KEY = process.env.VENICE_API_KEY!
const VENICE_BASE_URL = 'https://api.venice.ai/api/v1'
// Set AGENT_BASE_URL to your public URL (ngrok/Railway) so the frontend can reach /video/:id
const AGENT_BASE_URL = (process.env.AGENT_BASE_URL ?? `http://localhost:${PORT}`).replace(/\/$/, '')

const payToAddress = (
  process.env.AGENT_VIDEO_PRODUCTION_PAY_TO ?? process.env.ORCHESTRATOR_SESSION_ADDRESS!
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

// ─── Venice clients ───────────────────────────────────────────────────────────

// OpenAI-compatible client for text + TTS
const venice = new OpenAI({
  apiKey: VENICE_API_KEY,
  baseURL: VENICE_BASE_URL,
})

// Raw Venice API helper for video (not in OpenAI SDK)
function veniceVideoHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${VENICE_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

// ─── In-memory video store ────────────────────────────────────────────────────
// Stores completed video buffers so /video/:id can serve them.
// Fine for a hackathon demo; replace with S3/R2 for production.
interface StoredVideo {
  buffer: Buffer
  mimeType: string
  createdAt: number
}
const videoStore = new Map<string, StoredVideo>()

// ─── Video generation helpers ─────────────────────────────────────────────────

interface VideoResult {
  videoUrl: string | null        // served from this agent OR Venice CDN
  videoBase64: string | null     // populated when we only have raw bytes
  videoMimeType: string
  videoPrompt: string
  durationSeconds: number
}

interface VideoError {
  videoUrl: null
  videoBase64: null
  videoError: string
  videoPrompt: string
  durationSeconds: number
}

async function generateVideo(
  prompt: string,
  durationSecs: 5 | 10 = 5
): Promise<VideoResult | VideoError> {
  const duration = `${durationSecs}s`
  const log = (msg: string) => console.log(`[video-production] ${msg}`)

  // ── 1. Queue the job ────────────────────────────────────────────────────────
  log(`Queueing video: "${prompt.slice(0, 80)}..."`)

  const queueRes = await fetch(`${VENICE_BASE_URL}/video/queue`, {
    method: 'POST',
    headers: veniceVideoHeaders(),
    body: JSON.stringify({
      model: 'seedance-2-0-text-to-video',
      prompt,
      duration,
      aspect_ratio: '16:9',
    }),
  })

  if (!queueRes.ok) {
    const body = await queueRes.text()
    return {
      videoUrl: null,
      videoBase64: null,
      videoError: `Venice video queue failed (${queueRes.status}): ${body}`,
      videoPrompt: prompt,
      durationSeconds: durationSecs,
    }
  }

  const queueData = (await queueRes.json()) as {
    model: string
    queue_id: string
    download_url?: string
  }
  const { model, queue_id, download_url: vpsDownloadUrl } = queueData
  log(`Job queued — queue_id: ${queue_id}`)

  // ── 2. Poll until complete or 120 s timeout ─────────────────────────────────
  const TIMEOUT_MS = 120_000
  const POLL_INTERVAL_MS = 3_000
  const startTime = Date.now()
  let pollCount = 0

  while (Date.now() - startTime < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    pollCount++

    const elapsedSec = Math.round((Date.now() - startTime) / 1000)
    if (pollCount % 5 === 0) {
      log(`Still generating — ${elapsedSec}s elapsed (job ${queue_id})`)
    }

    let retrieveRes: globalThis.Response
    try {
      retrieveRes = await fetch(`${VENICE_BASE_URL}/video/retrieve`, {
        method: 'POST',
        headers: veniceVideoHeaders(),
        body: JSON.stringify({ model, queue_id }),
      })
    } catch (err) {
      log(`Retrieve network error: ${err} — retrying`)
      continue
    }

    if (!retrieveRes.ok) {
      if (retrieveRes.status === 404) {
        return {
          videoUrl: null,
          videoBase64: null,
          videoError: `Video job ${queue_id} not found (404)`,
          videoPrompt: prompt,
          durationSeconds: durationSecs,
        }
      }
      log(`Retrieve returned ${retrieveRes.status} — retrying`)
      continue
    }

    const contentType = retrieveRes.headers.get('content-type') ?? ''

    // Binary video response → completed (public/standard model path)
    if (contentType.includes('video/')) {
      log(`Video complete after ${Math.round((Date.now() - startTime) / 1000)}s (binary)`)
      const buffer = Buffer.from(await retrieveRes.arrayBuffer())
      const videoId = randomUUID()
      videoStore.set(videoId, { buffer, mimeType: 'video/mp4', createdAt: Date.now() })
      return {
        videoUrl: `${AGENT_BASE_URL}/video/${videoId}`,
        videoBase64: buffer.toString('base64'),
        videoMimeType: 'video/mp4',
        videoPrompt: prompt,
        durationSeconds: durationSecs,
      }
    }

    // JSON response — check status
    const statusData = (await retrieveRes.json()) as {
      status?: string
      download_url?: string
      average_execution_time?: number
    }

    if (statusData.status === 'COMPLETED') {
      const downloadUrl = statusData.download_url ?? vpsDownloadUrl ?? null
      log(`Video complete after ${Math.round((Date.now() - startTime) / 1000)}s (CDN URL)`)
      if (downloadUrl) {
        return {
          videoUrl: downloadUrl,
          videoBase64: null,
          videoMimeType: 'video/mp4',
          videoPrompt: prompt,
          durationSeconds: durationSecs,
        }
      }
      return {
        videoUrl: null,
        videoBase64: null,
        videoError: 'Video status COMPLETED but no download URL returned',
        videoPrompt: prompt,
        durationSeconds: durationSecs,
      }
    }

    // PROCESSING — continue polling
  }

  return {
    videoUrl: null,
    videoBase64: null,
    videoError: `Video generation timed out after ${TIMEOUT_MS / 1000}s`,
    videoPrompt: prompt,
    durationSeconds: durationSecs,
  }
}

// ─── Express app ─────────────────────────────────────────────────────────────

const app = express()
app.use(cors({ exposedHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE'] }))
app.use(express.json({ limit: '10mb' }))

// Serve stored videos
app.get('/video/:id', (req: Request, res: Response) => {
  const stored = videoStore.get(req.params.id)
  if (!stored) {
    res.status(404).json({ error: 'Video not found or expired' })
    return
  }
  res.setHeader('Content-Type', stored.mimeType)
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.send(stored.buffer)
})

// ─── x402 payment gate ────────────────────────────────────────────────────────

app.use(
  paymentMiddleware(
    {
      'POST /execute': {
        accepts: [
          {
            scheme: 'exact',
            price: '$0.60',
            network: NETWORK_ID,
            payTo: payToAddress,
            extra: { assetTransferMethod: 'erc7710' },
          },
        ],
        description: 'Video production: AI launch video (5s) + TTS narration',
        mimeType: 'application/json',
      },
    },
    resourceServer
  )
)

// ─── Main execute endpoint ────────────────────────────────────────────────────

app.post('/execute', async (req: Request, res: Response) => {
  const { task, context } = req.body as { task: string; context?: Record<string, unknown> }
  const start = Date.now()

  // ── Parse context from prior agents ────────────────────────────────────────
  // Agent 3 (positioning) provides strategy; Agent 4 (visual-asset) provides
  // imagePrompt, brandIdentity, and audioScript.
  let agent4Data: Record<string, unknown> = {}
  if (typeof context?.output === 'string') {
    try {
      agent4Data = JSON.parse(context.output)
    } catch { /* context.output is plain text, not JSON */ }
  }

  const positioningStrategy =
    (context?.positioning as string) ??
    (context?.strategy as string) ??
    (typeof context?.output === 'string' ? context.output : '') ??
    task

  const existingImagePrompt =
    (agent4Data?.imagePrompt as string) ??
    (context?.imagePrompt as string) ??
    null

  const existingAnnouncement =
    (agent4Data?.audioScript as string) ??
    (context?.announcementScript as string) ??
    (context?.audioScript as string) ??
    null

  console.log(`[video-production] Starting task: "${task.slice(0, 80)}"`)

  try {
    // ── STEP 1: REASON — craft a detailed video generation prompt ─────────────
    console.log('[video-production] REASON: Crafting video generation prompt...')

    const videoPromptText = await venice.chat.completions.create({
      model: 'llama-3.3-70b',
      messages: [
        {
          role: 'system',
          content: `You are an expert video director and prompt engineer specialising in AI video generation. Create a detailed text-to-video prompt for a 5-second product launch video. The prompt must describe: (1) the opening shot and scene composition, (2) key visual elements and motion, (3) lighting mood and colour palette, (4) the camera movement or transition, (5) the overall emotional tone. Write for the Seedance AI video model. Be vivid, precise, and cinematic. Do NOT include text overlays or logos — describe only the visual scene. Return ONLY the prompt, no explanation.`,
        },
        {
          role: 'user',
          content: `Project task: ${task}

Positioning strategy:
${positioningStrategy.slice(0, 1500)}

${existingImagePrompt ? `Visual style reference (from brand banner prompt): ${existingImagePrompt.slice(0, 500)}` : ''}`,
        },
      ],
    })

    const videoPrompt = videoPromptText.choices[0].message.content ?? task

    // ── STEP 2: ACT — Venice video generation (async + polling) ───────────────
    console.log('[video-production] ACT: Generating video via Venice...')

    // ── STEP 3: ACT — Venice TTS (runs in parallel with video polling) ────────
    // Build announcement script if Agent 4 didn't provide one
    const ttsScriptPromise = existingAnnouncement
      ? Promise.resolve(existingAnnouncement)
      : venice.chat.completions.create({
          model: 'llama-3.3-70b',
          messages: [
            {
              role: 'system',
              content: `Write a punchy 20-second TTS launch announcement (55-70 words). Start with a strong hook. State what it is and why it matters. End with a clear call to action. No hype clichés. Natural spoken rhythm.`,
            },
            {
              role: 'user',
              content: `Project: ${task}\nPositioning: ${positioningStrategy.slice(0, 800)}`,
            },
          ],
        }).then((r) => r.choices[0].message.content ?? task)

    // Run video generation and TTS script generation concurrently
    const [videoResult, audioScript] = await Promise.all([
      generateVideo(videoPrompt),
      ttsScriptPromise,
    ])

    // Generate TTS audio from the final script
    console.log('[video-production] ACT: Generating TTS audio...')
    const audioRes = await venice.audio.speech.create({
      model: 'tts-kokoro',
      input: audioScript,
      voice: 'af_sky',
    })
    const audioBuf = Buffer.from(
      await (audioRes as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer()
    )
    const audioBase64 = audioBuf.toString('base64')

    // ── Assemble response ─────────────────────────────────────────────────────
    const isVideoError = 'videoError' in videoResult

    const output = JSON.stringify({
      videoUrl: videoResult.videoUrl,
      videoBase64: videoResult.videoBase64,
      videoMimeType: 'video/mp4',
      videoPrompt: videoResult.videoPrompt,
      durationSeconds: videoResult.durationSeconds,
      ...(isVideoError && { videoError: (videoResult as VideoError).videoError }),
      audioBase64,
      audioMimeType: 'audio/mpeg',
      audioScript,
    })

    console.log(
      `[video-production] Complete in ${((Date.now() - start) / 1000).toFixed(1)}s — video: ${isVideoError ? 'FAILED' : 'OK'}, audio: OK`
    )

    res.json({
      status: isVideoError ? 'partial' : 'success',
      output,
      outputType: 'json',
      contentType: 'application/json',
      executionTime: (Date.now() - start) / 1000,
    })
  } catch (err) {
    console.error('[video-production] Fatal error:', err)
    res.status(500).json({
      status: 'error',
      output: String(err),
      outputType: 'text',
      contentType: 'text/plain',
      executionTime: (Date.now() - start) / 1000,
    })
  }
})

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    agent: 'video-production',
    capabilities: ['video-generation', 'video-production', 'media-content'],
    price: '0.60 USDC',
    network: NETWORK_ID,
    payTo: payToAddress,
  })
})

// ─── Boot ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[video-production] Agent running on port ${PORT}`)
  console.log(`[video-production] Pay to: ${payToAddress}`)
})
