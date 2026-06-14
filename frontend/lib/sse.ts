// In-memory SSE event bus — one buffer + listener set per task.
//
// Two things make this reliable:
//  1. The bus lives on `globalThis`, so every Next route handler bundle shares
//     ONE instance (the orchestrator emits and the /stream route listens — they
//     must be the same map, or events never arrive).
//  2. Events are BUFFERED per task and replayed to any client that connects late.
//     The orchestrator starts the moment the task is created (before the browser
//     has even navigated to the chat page), so without replay the early
//     "thinking" / agent events would be lost and the page would look frozen.

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

type Listener = (data: string) => void
type Bus = {
  listeners: Map<string, Listener[]>
  buffers: Map<string, string[]>
}

const g = globalThis as unknown as { __ariaSSEBus?: Bus }
const bus: Bus = g.__ariaSSEBus ?? (g.__ariaSSEBus = { listeners: new Map(), buffers: new Map() })

const MAX_BUFFER = 1000 // cap per task so a long run can't grow unbounded

export function emitTaskEvent(taskId: string, event: TaskEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`

  // Buffer for replay to late-joining clients.
  const buf = bus.buffers.get(taskId) ?? []
  buf.push(data)
  if (buf.length > MAX_BUFFER) buf.shift()
  bus.buffers.set(taskId, buf)

  // Notify currently-connected listeners.
  const listeners = bus.listeners.get(taskId) ?? []
  listeners.forEach((emit) => {
    try { emit(data) } catch { /* listener disconnected */ }
  })

  // Free the buffer a minute after a terminal event (gives revisits a grace window).
  if (event.type === 'synthesis_complete' || event.type === 'task_failed') {
    setTimeout(() => bus.buffers.delete(taskId), 60_000)
  }
}

export function addTaskListener(taskId: string, emit: (data: string) => void) {
  // Replay everything that already happened so the client catches up instantly.
  const buf = bus.buffers.get(taskId) ?? []
  for (const data of buf) {
    try { emit(data) } catch { /* ignore */ }
  }

  const listeners = bus.listeners.get(taskId) ?? []
  listeners.push(emit)
  bus.listeners.set(taskId, listeners)
  return () => removeTaskListener(taskId, emit)
}

function removeTaskListener(taskId: string, emit: Listener) {
  const remaining = (bus.listeners.get(taskId) ?? []).filter((l) => l !== emit)
  if (remaining.length === 0) bus.listeners.delete(taskId)
  else bus.listeners.set(taskId, remaining)
}
