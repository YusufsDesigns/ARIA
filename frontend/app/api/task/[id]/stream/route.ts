import { NextRequest } from 'next/server'
import { addTaskListener, emitTaskEvent } from '@/lib/sse'

export const dynamic = 'force-dynamic'

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
