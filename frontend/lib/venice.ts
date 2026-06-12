const BASE = 'https://api.venice.ai/api/v1'
const KEY = () => process.env.VENICE_API_KEY!

export const VENICE_MODEL = 'llama-3.3-70b'

// ─── Core fetch helper ────────────────────────────────────────────────────────
// Uses raw fetch instead of the OpenAI SDK so we never accidentally send SDK
// default parameters (store, stream_options, service_tier…) that Venice rejects.

async function venicePost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY()}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Venice ${res.status} on ${path}: ${text || '(no body)'}`)
  }
  return res.json()
}

// ─── Text reasoning ───────────────────────────────────────────────────────────

export async function veniceChat(
  messages: Array<{ role: string; content: string }>,
  model = VENICE_MODEL,
): Promise<string> {
  const data = await venicePost('/chat/completions', { model, messages }) as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices[0]?.message?.content ?? ''
}

// ─── Web search ───────────────────────────────────────────────────────────────

export async function veniceSearch(query: string): Promise<string> {
  const data = await venicePost('/chat/completions', {
    model: VENICE_MODEL,
    messages: [{ role: 'user', content: query }],
    venice_parameters: { enable_web_search: 'auto' },
  }) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

// ─── Web scraping ─────────────────────────────────────────────────────────────

export async function venciceScrape(url: string, prompt: string): Promise<string> {
  const content = url ? `${prompt}\n\nURL: ${url}` : prompt
  const data = await venicePost('/chat/completions', {
    model: VENICE_MODEL,
    messages: [{ role: 'user', content }],
    venice_parameters: { enable_web_scraping: true },
  }) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

// ─── Image generation ─────────────────────────────────────────────────────────

export async function veniceImage(prompt: string): Promise<string> {
  const data = await venicePost('/images/generations', {
    model: 'fluently-xl',
    prompt,
    n: 1,
    size: '1024x1024',
  }) as { data: Array<{ b64_json?: string; url?: string }> }
  const img = data.data?.[0]
  return img?.b64_json ?? img?.url ?? ''
}

// ─── Text-to-speech ───────────────────────────────────────────────────────────

export async function venciceTTS(text: string, voice = 'af_sky'): Promise<Buffer> {
  const res = await fetch(`${BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY()}`,
    },
    body: JSON.stringify({ model: 'tts-kokoro', input: text, voice }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Venice TTS ${res.status}: ${errText || '(no body)'}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

// ─── Default export for direct use in react-loop (chat only) ─────────────────

const venice = {
  chat: {
    completions: {
      create: (params: { model: string; messages: Array<{ role: string; content: string }> }) =>
        venicePost('/chat/completions', params as Record<string, unknown>).then((data) => data as {
          choices: Array<{ message: { content: string | null } }>
        }),
    },
  },
}

export default venice
