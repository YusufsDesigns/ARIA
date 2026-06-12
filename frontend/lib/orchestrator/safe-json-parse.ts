// Defensive JSON parser for Venice response content.
// Venice returns clean JSON in practice (verified), but this handles edge cases:
//   • markdown fences (```json ... ```)
//   • leading/trailing text before/after braces

export function safeParseJSON<T>(raw: string): T {
  let text = raw.trim()

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) text = fenceMatch[1].trim()

  // Fallback: extract first { to last }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1)
  }

  return JSON.parse(text) as T
}
