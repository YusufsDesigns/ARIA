// Strips binary/base64 outputs from accumulated findings before passing context
// to Venice or to downstream agents. Structured (JSON) agent results carry a
// `summary` text field — we forward that, never the full JSON (which may hold
// multi-MB base64 image/audio/video blobs).

import { extractSummary } from '../agent-result'

type SummarizableResult = {
  outputType: string
  output: string
}

export function summarizeContextForVenice(
  context: Record<string, SummarizableResult>,
): Record<string, string> {
  const summary: Record<string, string> = {}
  for (const [capability, result] of Object.entries(context)) {
    const ot = result.outputType as 'text' | 'image' | 'audio' | 'video' | 'json'
    summary[capability] = extractSummary(result.output, ot)
  }
  return summary
}
