import { prisma } from '../prisma'
import { emitTaskEvent } from '../sse'
import { BudgetTracker } from './budget'
import { runReactLoop } from './react-loop'

export async function runOrchestrator(
  taskId: string,
  userPrompt: string,
  budgetUsdc: number,
  userAddress: string,
): Promise<void> {
  const emit = (type: Parameters<typeof emitTaskEvent>[1]['type'], payload: Parameters<typeof emitTaskEvent>[1]['payload']) =>
    emitTaskEvent(taskId, { type, payload, timestamp: Date.now() })

  try {
    // Mark task as running
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'running' },
    })

    // Retrieve stored permission context for this user (from ERC-7715 grant)
    let permissionContext: `0x${string}` | null = null
    try {
      const perm = await prisma.userPermission.findUnique({
        where: { userAddress },
      })
      if (perm && new Date(perm.expiresAt) > new Date()) {
        permissionContext = perm.permissionContext as `0x${string}`
      }
    } catch { /* proceed without payments */ }

    const budget = new BudgetTracker(budgetUsdc, taskId)

    emit('budget_update', { budgetSpent: 0, budgetRemaining: budgetUsdc })

    // Run the full ReAct loop (intelligent, constrained, gap-aware)
    const synthesis = await runReactLoop(taskId, userPrompt, budget, permissionContext, userAddress)

    // Persist result
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        result: { synthesis, totalSpent: budget.remaining < budgetUsdc ? budgetUsdc - budget.remaining : 0 },
        completedAt: new Date(),
      },
    })

    emit('synthesis_complete', {
      finding: synthesis,
      outputType: 'text',
      budgetSpent: budgetUsdc - budget.remaining,
      budgetRemaining: budget.remaining,
    })
  } catch (err) {
    console.error('[orchestrator] Fatal error:', err)

    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'failed' },
    }).catch(() => {})

    emitTaskEvent(taskId, {
      type: 'task_failed',
      payload: { message: String(err) },
      timestamp: Date.now(),
    })
  }
}
