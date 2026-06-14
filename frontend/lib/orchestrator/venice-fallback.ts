import { veniceChat, veniceSearch, veniceImage, venciceTTS, venciceScrape } from '../venice'
import { requestCapability } from '../registry'
import type { VeniceCallTracker } from './plan'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FallbackReason = 'no-agent-registered' | 'agent-unavailable' | 'poor-fit' | 'format-unsupported'

type VeniceModality = 'text' | 'image' | 'audio' | 'video' | 'search' | 'scrape' | 'unsupported'

export type FallbackResult = {
  status: 'success'
  output: string
  outputType: 'text' | 'image' | 'audio' | 'json'
  contentType: string
  executionTime: number
  fallbackReason: FallbackReason
  capabilityGapLogged: boolean
}

// ─── Capability classifier ────────────────────────────────────────────────────
// Reads the capability tag and task text to infer which Venice modality
// is appropriate. This is what determines whether we call text/image/audio/
// video/search/scrape or flag something as genuinely unsupported.

function classifyCapability(capability: string, _task: string): VeniceModality {
  const text = capability.toLowerCase()
  if (/\b(image|banner|visual|logo|design|graphic|brand[\s-]?asset)\b/.test(text)) return 'image'
  if (/\b(audio|tts|speech|voice|narration|podcast|announcement)\b/.test(text)) return 'audio'
  if (/\b(video|clip|animation|reel|motion|film)\b/.test(text)) return 'video'
  if (/\b(search|trending|latest|current|news|live|real[\s-]?time)\b/.test(text)) return 'search'
  if (/\b(scrape|webpage|url|article[\s-]?content|web[\s-]?page)\b/.test(text)) return 'scrape'
  if (/\b(pdf|spreadsheet|excel|csv[\s-]?export|3d[\s-]?model|powerpoint|\.docx)\b/.test(text)) return 'unsupported'
  return 'text'
}

// ─── Modality-aware fallback router ──────────────────────────────────────────
// Routes to the right Venice capability based on what the capability tag implies.
// Tracks whether a gap was logged on-chain so the caller can surface it in the UI.
//
// Key rule: format-level gaps (PDF, video) are logged even when an agent exists
// but Venice itself can't produce that format. The `gapLoggedThisRun` Set prevents
// duplicate on-chain writes within a single task run.

export async function veniceFallback(
  capability: string,
  task: string,
  context: object,
  _veniceTracker: VeniceCallTracker,
  fallbackReason: FallbackReason,
  gapLoggedThisRun: Set<string>,
): Promise<FallbackResult> {
  const modality = classifyCapability(capability, task)
  let capabilityGapLogged = false
  const start = Date.now()
  const elapsed = () => (Date.now() - start) / 1000

  const logFormatGap = (key: string) => {
    if (!gapLoggedThisRun.has(key)) {
      requestCapability(capability).catch(() => {})
      gapLoggedThisRun.add(key)
      capabilityGapLogged = true
    }
  }

  if (modality === 'unsupported') {
    logFormatGap(`format:${capability}`)
  }

  switch (modality) {
    case 'image': {
      const promptText = await veniceChat([
        {
          role: 'user',
          // Venice image API hard limit is 1500 chars — ask for a compact prompt
          content: `Write a vivid image generation prompt (max 200 words, under 1200 characters) for: ${task}`,
        },
      ])
      // Truncate defensively in case the model ignores the length instruction
      const b64 = await veniceImage(promptText.slice(0, 1400))
      return {
        status: 'success', output: b64, outputType: 'image', contentType: 'image/png',
        executionTime: elapsed(), fallbackReason, capabilityGapLogged,
      }
    }

    case 'audio': {
      const script = await veniceChat([
        {
          role: 'user',
          content: `Write a punchy 20-second TTS announcement (max 60 words) for: ${task}\nContext: ${JSON.stringify(context)}`,
        },
      ])
      const audioBuf = await venciceTTS(script)
      return {
        status: 'success', output: audioBuf.toString('base64'), outputType: 'audio',
        contentType: 'audio/mpeg', executionTime: elapsed(), fallbackReason, capabilityGapLogged,
      }
    }

    case 'video': {
      // Venice video requires the dedicated video-production agent (async poll loop).
      // Without that agent we can't do real video — log the gap and describe the video as text.
      logFormatGap('format:video-generation')
      const promptText = await veniceChat([
        {
          role: 'user',
          content: `Create a detailed text-to-video prompt for a 5-second launch video: ${task}\nContext: ${JSON.stringify(context)}`,
        },
      ])
      const description = await veniceChat([
        {
          role: 'system',
          content: 'The video-production agent is unavailable. Describe this 5-second launch video scene-by-scene as if writing a director\'s brief — camera angle, motion, lighting, colours, mood. Be vivid and specific.',
        },
        { role: 'user', content: `Video prompt: ${promptText}` },
      ])
      return {
        status: 'success', output: description, outputType: 'text', contentType: 'text/plain',
        executionTime: elapsed(), fallbackReason, capabilityGapLogged,
      }
    }

    case 'search': {
      const result = await veniceSearch(task)
      return {
        status: 'success', output: result, outputType: 'text', contentType: 'text/plain',
        executionTime: elapsed(), fallbackReason, capabilityGapLogged,
      }
    }

    case 'scrape': {
      const result = await venciceScrape('', task)
      return {
        status: 'success', output: result, outputType: 'text', contentType: 'text/plain',
        executionTime: elapsed(), fallbackReason, capabilityGapLogged,
      }
    }

    case 'unsupported': {
      const result = await veniceChat([
        {
          role: 'system',
          content: `The user requested a ${capability} output. Produce the equivalent content as clean markdown (tables, headings, lists) so the user gets the information even without the native file format.`,
        },
        { role: 'user', content: `${task}\nContext: ${JSON.stringify(context)}` },
      ])
      return {
        status: 'success', output: result, outputType: 'text', contentType: 'text/plain',
        executionTime: elapsed(), fallbackReason, capabilityGapLogged,
      }
    }

    default: {
      const result = await veniceChat([
        { role: 'user', content: `${task}\nContext: ${JSON.stringify(context)}` },
      ])
      return {
        status: 'success', output: result, outputType: 'text', contentType: 'text/plain',
        executionTime: elapsed(), fallbackReason, capabilityGapLogged,
      }
    }
  }
}
