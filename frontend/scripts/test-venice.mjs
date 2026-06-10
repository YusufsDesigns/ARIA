import 'dotenv/config'
import OpenAI from 'openai'
import { writeFileSync } from 'fs'

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
})

const MODEL = 'llama-3.3-70b'

async function run(label, fn) {
  process.stdout.write(`\n[${label}] testing... `)
  try {
    const result = await fn()
    console.log('✅', result.slice(0, 120))
    return true
  } catch (e) {
    console.log('❌', e.message)
    return false
  }
}

// 1. Text reasoning
await run('1. Text', async () => {
  const res = await venice.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: 'Say "ARIA text works" and nothing else.' }],
  })
  return res.choices[0].message.content
})

// 2. Web search
await run('2. Web Search', async () => {
  const res = await venice.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: 'What is the current price of ETH? One sentence.' }],
    venice_parameters: { enable_web_search: 'auto' },
  })
  return res.choices[0].message.content
})

// 3. Web scraping
await run('3. Web Scrape', async () => {
  const res = await venice.chat.completions.create({
    model: 'openai-gpt-55',
    messages: [{ role: 'user', content: 'Summarize https://base.org in one sentence.' }],
    venice_parameters: { enable_web_scraping: true },
  })
  return res.choices[0].message.content
})

// 4. Image generation
await run('4. Image Gen', async () => {
  const res = await venice.images.generate({
    model: 'fluently-xl',
    prompt: 'A futuristic AI marketplace on a dark background, orange accents',
    n: 1,
    size: '1024x1024',
  })
  const img = res.data?.[0]
  const preview = img?.b64_json ? `base64 (${img.b64_json.length} chars)` : img?.url
  return `Image received: ${preview}`
})

// 5. Text-to-speech
await run('5. TTS', async () => {
  const res = await venice.audio.speech.create({
    model: 'tts-kokoro',
    input: 'ARIA is live. Welcome to the agent economy.',
    voice: 'af_sky',
  })
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync('/tmp/aria-tts-test.mp3', buf)
  return `Audio saved: ${buf.length} bytes`
})

console.log('\n---\nStep 3 Venice test complete.\n')
