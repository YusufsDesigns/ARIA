import OpenAI from 'openai'

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY!,
  baseURL: 'https://api.venice.ai/api/v1',
})

export const VENICE_MODEL = 'llama-3.3-70b'

// Text reasoning — used by Orchestrator and all agents
export async function veniceChat(
  messages: OpenAI.ChatCompletionMessageParam[],
  model = VENICE_MODEL
): Promise<string> {
  const res = await venice.chat.completions.create({ model, messages })
  return res.choices[0].message.content ?? ''
}

// Web search — Venice-native, live web results
export async function veniceSearch(query: string): Promise<string> {
  const res = await venice.chat.completions.create({
    model: VENICE_MODEL,
    messages: [{ role: 'user', content: query }],
    // @ts-expect-error Venice-specific parameter
    venice_parameters: { enable_web_search: 'auto' },
  })
  return res.choices[0].message.content ?? ''
}

// Web scraping — fetch and summarise a URL
export async function venciceScrape(url: string, prompt: string): Promise<string> {
  const res = await venice.chat.completions.create({
    model: 'openai-gpt-55',
    messages: [{ role: 'user', content: `${prompt}\n\nURL: ${url}` }],
    // @ts-expect-error Venice-specific parameter
    venice_parameters: { enable_web_scraping: true },
  })
  return res.choices[0].message.content ?? ''
}

// Image generation
export async function veniceImage(prompt: string): Promise<string> {
  const res = await venice.images.generate({
    model: 'fluently-xl',
    prompt,
    n: 1,
    size: '1024x1024',
  })
  const img = res.data?.[0] as Record<string, string> | undefined
  return img?.b64_json ?? img?.url ?? ''
}

// Text-to-speech
export async function venciceTTS(text: string, voice = 'af_sky'): Promise<Buffer> {
  const res = await venice.audio.speech.create({
    model: 'tts-kokoro',
    input: text,
    voice: voice as any,
  })
  return Buffer.from(await (res as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer())
}

export default venice
