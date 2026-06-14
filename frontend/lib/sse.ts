// In-memory SSE event bus — one emitter per task
// In production replace with Redis pub/sub
const taskListeners = new Map<string, ((data: string) => void)[]>()

export type TaskEventType =
  | 'connected'
  | 'orchestrator_thinking'
  | 'agent_hired'
  | 'agent_failed'
  | 'agent_progress'
  | 'payment_confirmed'
  | 'finding_received'
  | 'privacy_log'
  | 'budget_update'
  | 'synthesis_complete'
  | 'task_failed'

export type TaskEvent = {
  type: TaskEventType
  payload: {
    agentName?: string
    capability?: string
    amountUsdc?: number
    txHash?: string
    finding?: string
    outputType?: string
    output?: string
    message?: string
    budgetSpent?: number
    budgetRemaining?: number
  }
  timestamp: number
}

export function emitTaskEvent(taskId: string, event: TaskEvent) {
  const listeners = taskListeners.get(taskId) ?? []
  const data = `data: ${JSON.stringify(event)}\n\n`
  listeners.forEach((emit) => {
    try { emit(data) } catch { /* listener disconnected */ }
  })
}

export function addTaskListener(taskId: string, emit: (data: string) => void) {
  const listeners = taskListeners.get(taskId) ?? []
  listeners.push(emit)
  taskListeners.set(taskId, listeners)
  return () => removeTaskListener(taskId, emit)
}

function removeTaskListener(taskId: string, emit: (data: string) => void) {
  const remaining = (taskListeners.get(taskId) ?? []).filter((l) => l !== emit)
  if (remaining.length === 0) taskListeners.delete(taskId)
  else taskListeners.set(taskId, remaining)
}
