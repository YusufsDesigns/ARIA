// Strips binary/base64 outputs from accumulated findings before passing context
// to Venice or to downstream agents. Prevents multi-KB image/audio blobs from
// inflating prompts while still informing subsequent agents that the content exists.

type SummarizableResult = {
  outputType: string
  output: string
}

export function summarizeContextForVenice(
  context: Record<string, SummarizableResult>,
): Record<string, string> {
  const summary: Record<string, string> = {}
  for (const [capability, result] of Object.entries(context)) {
    if (result.outputType === 'text') {
      summary[capability] = result.output
    } else {
      summary[capability] = `[${result.outputType} output generated — ${result.output.length} chars of ${result.outputType === 'json' ? 'JSON including potential binary data' : 'binary data'} — not forwarded to preserve context window]`
    }
  }
  return summary
}
