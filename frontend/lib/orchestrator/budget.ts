import { prisma } from '../prisma'
import { emitTaskEvent } from '../sse'

export class BudgetTracker {
  private spent = 0
  private readonly total: number
  private readonly taskId: string

  constructor(totalUSDC: number, taskId: string) {
    this.total = totalUSDC
    this.taskId = taskId
  }

  get remaining() { return this.total - this.spent }

  canAfford(priceUSDC: number): boolean {
    return priceUSDC <= this.remaining
  }

  async recordPayment(priceUSDC: number, _agentName: string, _txHash: string) {
    this.spent += priceUSDC

    // Emit immediately — UI updates the instant payment is recorded, not after DB
    emitTaskEvent(this.taskId, {
      type: 'budget_update',
      payload: { budgetSpent: this.spent, budgetRemaining: this.remaining },
      timestamp: Date.now(),
    })

    // DB write is non-blocking — UI doesn't depend on it completing
    prisma.task.update({
      where: { id: this.taskId },
      data: { totalSpent: this.spent },
    }).catch(() => {})
  }

  isBudgetExhausted(): boolean {
    return this.remaining <= 0.01
  }
}
