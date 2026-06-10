import { prisma } from '../prisma'
import { emitTaskEvent } from '../sse'

export type AgentInfo = {
  id: string
  pricePerTask: string // USDC in 6 decimals
  name?: string
}

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

  findAffordableAgent<T extends AgentInfo>(agents: T[]): T | null {
    const sorted = agents
      .filter((a) => {
        const priceUSDC = Number(a.pricePerTask) / 1e6
        return this.canAfford(priceUSDC)
      })
      .sort((a, b) => Number(a.pricePerTask) - Number(b.pricePerTask))
    return sorted[0] ?? null
  }

  async recordPayment(priceUSDC: number, _agentName: string, _txHash: string) {
    this.spent += priceUSDC

    await prisma.task.update({
      where: { id: this.taskId },
      data: { totalSpent: this.spent },
    })

    emitTaskEvent(this.taskId, {
      type: 'budget_update',
      payload: { budgetSpent: this.spent, budgetRemaining: this.remaining },
      timestamp: Date.now(),
    })
  }

  isBudgetExhausted(): boolean {
    return this.remaining <= 0.01
  }
}
