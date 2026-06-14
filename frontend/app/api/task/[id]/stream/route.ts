import { NextRequest } from 'next/server'
import { addTaskListener } from '@/lib/sse'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // allow long-running streams where the host honours it

// Process-wide guard so a task's orchestrator is started at most once, even if the
// client reconnects or opens the page in multiple tabs.
const g = globalThis as unknown as { __ariaStarted?: Set<string> }
const started: Set<string> = g.__ariaStarted ?? (g.__ariaStarted = new Set())

// Start the orchestrator when a client first watches the task. Because this runs
// inside the open SSE request, it stays alive while the browser is connected —
// unlike fire-and-forget work, which deployed hosts kill after the POST response.
async function maybeStartOrchestrator(taskId: string) {
  if (started.has(taskId)) return
  started.add(taskId)
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.status !== 'pending') return // already running/done, or gone
    const { runOrchestrator } = await import('@/lib/orchestrator')
    await runOrchestrator(taskId, task.runInput ?? task.input, task.budgetUsdc, task.userAddress)
  } catch (err) {
    console.error('[stream] orchestrator start failed:', err)
    started.delete(taskId) // allow a retry on the next connection
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const emit = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data))
        } catch {
          cleanup()
        }
      }

      const cleanup = addTaskListener(taskId, emit)

      // Send initial ping
      emit(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`)

      req.signal.addEventListener('abort', cleanup)

      // Kick off the run (no-op if it already started). Runs while this stream is open.
      void maybeStartOrchestrator(taskId)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
