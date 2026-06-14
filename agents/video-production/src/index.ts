import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { x402ExactEvmErc7710ServerScheme } from '@metamask/x402'
import { HTTPFacilitatorClient } from '@x402/core/server'
import OpenAI from 'openai'
import type { AgentResult, RenderBlock } from './agent-result.js'

// ─── Config ──────────────────────────────────────────────────────────────────

const NETWORK_ID = 'eip155:84532' // Base Sepolia
const PORT = Number(process.env.PORT ?? 4005)
const VENICE_API_KEY = process.env.VENICE_API_KEY!
const VENICE_BASE_URL = 'https://api.venice.ai/api/v1'
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

const venice = new OpenAI({ apiKey: VENICE_API_KEY, baseURL: VENICE_BASE_URL })

function veniceVideoHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${VENICE_API_KEY}`, 'Content-Type': 'application/json' }
}

// ─── Stores ───────────────────────────────────────────────────────────────────
// Completed video bytes, served by /video/:id.
const videoStore = new Map<string, { buffer: Buffer; mimeType: string; createdAt: number }>()

// Two-phase async job state. POST /execute creates a job + returns its id fast;
// GET /result/:jobId checks the Venice queue once per call (orchestrator polls).
type JobState = {
  veniceModel: string
  queueId: string
  vpsDownloadUrl?: string
  videoPrompt: string
  durationSeconds: number
  audioB64: string
  audioScript: string
  createdAt: number
  // The agent's own PUBLIC base URL, derived from the incoming request so the
  // video can be served from a reachable host without needing AGENT_BASE_URL set.
  baseUrl: string
  // cached terminal result once finished, so repeat polls are cheap
  finished?: AgentResult
}

// Public base URL of THIS agent, inferred from the request (Railway sets the
// forwarded host/proto). Falls back to AGENT_BASE_URL, then localhost.
function publicBaseUrl(req: Request): string {
  const xfHost = (req.headers['x-forwarded-host'] as string) || req.headers.host
  const xfProto = (req.headers['x-forwarded-proto'] as string) || 'https'
  if (xfHost) return `${xfProto}://${xfHost}`.replace(/\/$/, '')
  return AGENT_BASE_URL
}
const jobStore = new Map<string, JobState>()

// ─── Venice video: queue + single-shot check (no internal polling loop) ───────

async function queueVideo(
  prompt: string,
  durationSecs: 5 | 10 = 5
): Promise<{ model: string; queueId: string; vpsDownloadUrl?: string } | { error: string }> {
  const res = await fetch(`${VENICE_BASE_URL}/video/queue`, {
    method: 'POST',
    headers: veniceVideoHeaders(),
    body: JSON.stringify({
      model: 'seedance-1-5-pro-text-to-video',
      prompt,
      duration: `${durationSecs}s`,
      aspect_ratio: '16:9',
    }),
  })
  if (!res.ok) return { error: `Venice video queue failed (${res.status}): ${await res.text()}` }
  const data = (await res.json()) as { model: string; queue_id: string; download_url?: string }
  return { model: data.model, queueId: data.queue_id, vpsDownloadUrl: data.download_url }
}

type VideoCheck =
  | { state: 'processing' }
  | { state: 'done'; videoUrl: string | null; videoB64: string | null }
  | { state: 'error'; error: string }

async function checkVideo(model: string, queueId: string, baseUrl: string, vpsDownloadUrl?: string): Promise<VideoCheck> {
  let retrieveRes: globalThis.Response
  try {
    retrieveRes = await fetch(`${VENICE_BASE_URL}/video/retrieve`, {
      method: 'POST',
      headers: veniceVideoHeaders(),
      body: JSON.stringify({ model, queue_id: queueId }),
    })
  } catch (err) {
    return { state: 'processing' } // transient network error — let the next poll retry
  }
  if (!retrieveRes.ok) {
    if (retrieveRes.status === 404) return { state: 'error', error: `Video job ${queueId} not found (404)` }
    return { state: 'processing' }
  }
  const contentType = retrieveRes.headers.get('content-type') ?? ''
  if (contentType.includes('video/') || contentType.includes('octet-stream')) {
    const buffer = Buffer.from(await retrieveRes.arrayBuffer())
    const videoId = randomUUID()
    videoStore.set(videoId, { buffer, mimeType: 'video/mp4', createdAt: Date.now() })
    // Serve via URL (streamed, range-enabled) — NOT base64. A ~5MB video as ~7MB
    // of base64 over SSE/DB corrupts/truncates and won't play.
    return { state: 'done', videoUrl: `${baseUrl}/video/${videoId}`, videoB64: null }
  }
  const statusData = (await retrieveRes.json()) as { status?: string; download_url?: string }
  if (statusData.status === 'COMPLETED') {
    const url = statusData.download_url ?? vpsDownloadUrl ?? null
    return { state: 'done', videoUrl: url, videoB64: null }
  }
  return { state: 'processing' }
}

// ─── Result assembly ──────────────────────────────────────────────────────────

function buildResult(job: JobState, video: { videoUrl: string | null; videoB64: string | null } | null, errored = false): AgentResult {
  const blocks: RenderBlock[] = []
  if (video && (video.videoUrl || video.videoB64)) {
    blocks.push({
      kind: 'video',
      title: 'Launch teaser',
      url: video.videoUrl ?? undefined,
      contentType: 'video/mp4',
    })
  } else if (errored) {
    blocks.push({ kind: 'badges', title: 'Video', items: [{ label: 'Video render unavailable', tone: 'warn', detail: 'Voiced narration delivered below.' }] })
  }
  blocks.push({ kind: 'audio', title: 'Voiced narration', b64: job.audioB64, contentType: 'audio/mpeg', script: job.audioScript })
  blocks.push({ kind: 'markdown', title: 'Scene direction', body: job.videoPrompt })

  return {
    status: video && (video.videoUrl || video.videoB64) ? 'success' : errored ? 'partial' : 'success',
    agent: 'Video Production',
    headline: video && (video.videoUrl || video.videoB64) ? 'Launch teaser + narration ready' : 'Narration ready · video unavailable',
    blocks,
    summary: `Generated a ${job.durationSeconds}s launch teaser video and a voiced narration.\nNarration: ${job.audioScript}`,
    provenance: 'Venice Seedance (text-to-video, async) + tts-kokoro — zero retention',
  }
}

function processingResult(job: JobState, jobId: string): AgentResult {
  return {
    status: 'processing',
    agent: 'Video Production',
    jobId,
    headline: 'Rendering launch teaser…',
    blocks: [
      { kind: 'badges', title: 'Status', items: [{ label: 'Video rendering', tone: 'warn', detail: 'Venice Seedance is generating your teaser.' }] },
      { kind: 'audio', title: 'Voiced narration (ready now)', b64: job.audioB64, contentType: 'audio/mpeg', script: job.audioScript },
    ],
    summary: `Launch video is rendering; voiced narration is ready. Narration: ${job.audioScript}`,
    provenance: 'Venice Seedance (async) + tts-kokoro',
  }
}

// ─── Express app ─────────────────────────────────────────────────────────────

const app = express()
app.use(cors({ exposedHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE'] }))
app.use(express.json({ limit: '10mb' }))

app.get('/video/:id', (req: Request, res: Response) => {
  const stored = videoStore.get(req.params.id)
  if (!stored) {
    res.status(404).json({ error: 'Video not found or expired' })
    return
  }
  const { buffer, mimeType } = stored
  const total = buffer.length
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', mimeType)
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Range support — browsers need 206/partial responses to play & seek video.
  const range = req.headers.range
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range)
    const start = m ? parseInt(m[1], 10) : 0
    const end = m && m[2] ? parseInt(m[2], 10) : total - 1
    if (Number.isNaN(start) || start >= total || end >= total) {
      res.status(416).setHeader('Content-Range', `bytes */${total}`).end()
      return
    }
    res.status(206)
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`)
    res.setHeader('Content-Length', String(end - start + 1))
    res.end(buffer.subarray(start, end + 1))
  } else {
    res.setHeader('Content-Length', String(total))
    res.end(buffer)
  }
})

// Phase 2 — free polling endpoint. Each call checks the Venice queue ONCE and
// returns quickly, so no single request is ever held open long enough to 502.
app.get('/result/:jobId', async (req: Request, res: Response) => {
  const job = jobStore.get(req.params.jobId)
  if (!job) {
    res.status(404).json({ error: 'Job not found or expired' })
    return
  }
  if (job.finished) {
    res.json({ done: true, status: job.finished.status, output: JSON.stringify(job.finished), outputType: 'json', contentType: 'application/json', executionTime: 0 })
    return
  }
  const check = await checkVideo(job.veniceModel, job.queueId, job.baseUrl || publicBaseUrl(req), job.vpsDownloadUrl)
  if (check.state === 'processing') {
    // Safety timeout — after 5 min deliver the narration as a partial result.
    if (Date.now() - job.createdAt > 300_000) {
      const partial = buildResult(job, null, true)
      job.finished = partial
      res.json({ done: true, status: 'partial', output: JSON.stringify(partial), outputType: 'json', contentType: 'application/json', executionTime: 0 })
      return
    }
    res.json({ done: false, status: 'processing', output: JSON.stringify(processingResult(job, req.params.jobId)), outputType: 'json', contentType: 'application/json', executionTime: 0, jobId: req.params.jobId })
    return
  }
  if (check.state === 'error') {
    const partial = buildResult(job, null, true)
    job.finished = partial
    res.json({ done: true, status: 'partial', output: JSON.stringify(partial), outputType: 'json', contentType: 'application/json', executionTime: 0 })
    return
  }
  const final = buildResult(job, { videoUrl: check.videoUrl, videoB64: check.videoB64 })
  job.finished = final
  res.json({ done: true, status: final.status, output: JSON.stringify(final), outputType: 'json', contentType: 'application/json', executionTime: 0 })
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

// Phase 1 — paid. Does the FAST work (prompt + narration + TTS), queues the video
// job, and returns { status: processing, jobId } immediately so the request settles
// quickly. The minutes-long video render happens out of band, polled via /result.
app.post('/execute', async (req: Request, res: Response) => {
  const { task, context } = req.body as { task: string; context?: Record<string, unknown> }
  const start = Date.now()

  const contextStr = JSON.stringify(context ?? {}).slice(0, 4000)

  try {
    // REASON + narration script in parallel (both fast).
    const [videoPrompt, audioScript] = await Promise.all([
      venice.chat.completions
        .create({
          model: 'llama-3.3-70b',
          messages: [
            {
              role: 'system',
              content: `You are a cinematic video director. Write a vivid text-to-video prompt for a 5-second product launch teaser (Seedance model). Describe opening shot, key motion, lighting/colour, camera movement, emotional tone. No text overlays or logos — visual scene only. Return ONLY the prompt.`,
            },
            { role: 'user', content: `Project: ${task}\n\nPositioning from prior agents:\n${contextStr}` },
          ],
        })
        .then((r) => r.choices[0].message.content ?? task),
      venice.chat.completions
        .create({
          model: 'llama-3.3-70b',
          messages: [
            {
              role: 'system',
              content: `Write a punchy 20-second spoken launch narration (55-70 words). Strong hook → what it is → why it matters → call to action. No hype clichés. Natural spoken rhythm.`,
            },
            { role: 'user', content: `Project: ${task}\nPositioning: ${contextStr}` },
          ],
        })
        .then((r) => r.choices[0].message.content ?? task),
    ])

    // TTS audio (fast, ~5s).
    const audioRes = await venice.audio.speech.create({ model: 'tts-kokoro', input: audioScript, voice: 'af_sky' })
    const audioB64 = Buffer.from(await (audioRes as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer()).toString('base64')

    // Queue the long video job (returns immediately with a queue id).
    const queued = await queueVideo(videoPrompt)

    if ('error' in queued) {
      // Couldn't even queue — still deliver the narration as a partial (paid work done).
      const jobId = randomUUID()
      const job: JobState = { veniceModel: 'seedance-1-5-pro-text-to-video', queueId: '', videoPrompt, durationSeconds: 5, audioB64, audioScript, createdAt: Date.now(), baseUrl: publicBaseUrl(req) }
      const partial = buildResult(job, null, true)
      res.json({ status: 'partial', output: JSON.stringify(partial), outputType: 'json', contentType: 'application/json', executionTime: (Date.now() - start) / 1000, jobId })
      return
    }

    const jobId = randomUUID()
    jobStore.set(jobId, {
      veniceModel: queued.model,
      queueId: queued.queueId,
      vpsDownloadUrl: queued.vpsDownloadUrl,
      videoPrompt,
      durationSeconds: 5,
      audioB64,
      audioScript,
      createdAt: Date.now(),
      baseUrl: publicBaseUrl(req),
    })

    const processing = processingResult(jobStore.get(jobId)!, jobId)
    res.json({
      status: 'success', // x402-level: the paid request succeeded (job accepted)
      output: JSON.stringify(processing),
      outputType: 'json',
      contentType: 'application/json',
      executionTime: (Date.now() - start) / 1000,
      jobId, // signals the orchestrator to poll /result/:jobId
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

app.listen(PORT, () => {
  console.log(`[video-production] Async video agent on port ${PORT}`)
  console.log(`[video-production] Pay to: ${payToAddress}`)
})
