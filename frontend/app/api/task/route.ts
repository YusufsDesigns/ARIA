import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractSummary } from '@/lib/agent-result'

// POST /api/task — create a new task (optionally continuing a parent task)
export async function POST(req: NextRequest) {
  const { userAddress, input, budgetUsdc, parentTaskId } = (await req.json()) as {
    userAddress: string
    input: string
    budgetUsdc?: number
    parentTaskId?: string
  }

  if (!userAddress || !input) {
    return NextResponse.json({ error: 'userAddress and input required' }, { status: 400 })
  }

  const addr = userAddress.toLowerCase()

  // Continuation: fold the parent task's findings + answer into the new task's
  // input as prior context. This passes continuation context WITHOUT changing the
  // orchestrator signature (which stays positional and untouched).
  let effectiveInput = input
  if (parentTaskId) {
    const parent = await prisma.task.findUnique({
      where: { id: parentTaskId },
      include: { agentCalls: { orderBy: { createdAt: 'asc' } } },
    })
    if (parent && parent.userAddress.toLowerCase() === addr) {
      const priorFindings = parent.agentCalls
        .filter((c) => c.finding)
        .map((c) => `### ${c.agentName} (${c.capability})\n${extractSummary(c.finding!, (c.outputType as 'text' | 'image' | 'audio' | 'video' | 'json') ?? 'text').slice(0, 1500)}`)
        .join('\n\n')
      const priorAnswer =
        parent.result && typeof parent.result === 'object' && 'synthesis' in parent.result
          ? extractSummary(String((parent.result as { synthesis?: string }).synthesis ?? ''), 'json').slice(0, 2500)
          : ''
      effectiveInput =
        `CONTINUATION OF A PRIOR TASK.\n\nPrior request: ${parent.input}\n\n` +
        (priorFindings ? `Prior findings:\n${priorFindings}\n\n` : '') +
        (priorAnswer ? `Prior answer:\n${priorAnswer}\n\n` : '') +
        `---\n\nNow do this: ${input}`
    }
  }

  let task
  try {
    task = await prisma.task.create({
      data: {
        userAddress: addr,
        input, // the user's actual words (shown in the UI)
        runInput: effectiveInput, // what the orchestrator actually runs (incl. continuation context)
        budgetUsdc: budgetUsdc ?? 10,
        status: 'pending',
        parentTaskId: parentTaskId ?? null,
      },
    })
  } catch (err) {
    console.error('[api/task] create failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  // NOTE: the orchestrator is NOT fired here. It's started by the SSE stream the
  // moment the client connects, so it runs tied to the live connection — which
  // survives on hosts that suspend post-response/background work. See
  // app/api/task/[id]/stream/route.ts.
  return NextResponse.json({ taskId: task.id })
}

// GET /api/task?id=xxx — get task status (kept for back-compat)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const task = await prisma.task.findUnique({
    where: { id },
    include: { agentCalls: { orderBy: { createdAt: 'asc' } } },
  })

  if (!task) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(task)
}
