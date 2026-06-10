import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/task — create a new task
export async function POST(req: NextRequest) {
  const { userAddress, input, budgetUsdc } = (await req.json()) as {
    userAddress: string
    input: string
    budgetUsdc: number
  }

  if (!userAddress || !input) {
    return NextResponse.json({ error: 'userAddress and input required' }, { status: 400 })
  }

  const task = await prisma.task.create({
    data: { userAddress, input, status: 'pending' },
  })

  // Fire orchestrator in background (non-blocking)
  void import('@/lib/orchestrator').then(({ runOrchestrator }) =>
    runOrchestrator(task.id, input, budgetUsdc ?? 10, userAddress)
  )

  return NextResponse.json({ taskId: task.id })
}

// GET /api/task?id=xxx — get task status
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
