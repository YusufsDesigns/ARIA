'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { InlineExecution, type AgentStep, type Payment } from '@/components/task/InlineExecution'
import { ContinuationInput } from '@/components/app/ContinuationInput'
import { WalletWall } from '@/components/app/WalletWall'
import { useWallet } from '@/components/app/WalletContext'

type AgentCall = {
  agentName: string
  capability: string
  amountUsdc: number
  txHash: string | null
  finding: string | null
  outputType: string
  status: string
}
type TaskData = {
  id: string
  userAddress: string
  input: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  totalSpent: number
  result: { synthesis?: string } | null
  agentCalls: AgentCall[]
}

function hydrate(task: TaskData): { agents: AgentStep[]; payments: Payment[]; synthesis: { content: string; outputType?: string } | null } {
  const agents: AgentStep[] = task.agentCalls.map((c) => ({
    agentName: c.agentName,
    capability: c.capability,
    amount: c.amountUsdc,
    status: c.status === 'failed' ? 'failed' : 'done',
    finding: c.finding ?? undefined,
    outputType: c.outputType,
    isPaid: c.amountUsdc > 0,
    isFallback: c.agentName.startsWith('↪'),
  }))
  const payments: Payment[] = task.agentCalls
    .filter((c) => c.amountUsdc > 0 && c.status !== 'failed')
    .map((c) => ({ agent: c.agentName, capability: c.capability, amount: c.amountUsdc, txHash: c.txHash ?? undefined, timestamp: 0 }))
  const raw = task.result?.synthesis
  const synthesis = raw ? { content: String(raw), outputType: 'json' } : null
  return { agents, payments, synthesis }
}

export default function ChatPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const { address, isConnected } = useWallet()
  const router = useRouter()

  const [task, setTask] = useState<TaskData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [continuation, setContinuation] = useState('')
  const [continuing, setContinuing] = useState(false)
  // Follow-ups stay in THIS chat as additional turns (no navigation away).
  const [extraTurns, setExtraTurns] = useState<{ taskId: string; prompt: string }[]>([])
  const [completedTurns, setCompletedTurns] = useState<Set<string>>(new Set())
  const [spentByTurn, setSpentByTurn] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/task/${taskId}`)
        if (!res.ok) { if (!cancelled) setNotFound(true); return }
        const data = (await res.json()) as TaskData
        if (cancelled) return
        setTask(data)
        setSpentByTurn((p) => ({ ...p, [taskId]: data.totalSpent }))
        if (data.status === 'completed' || data.status === 'failed') {
          setCompletedTurns((prev) => new Set(prev).add(taskId))
        }
      } catch {
        if (!cancelled) setNotFound(true)
      }
    })()
    return () => { cancelled = true }
  }, [taskId])

  // A task belongs to one wallet. If the connected address doesn't own it, leave.
  useEffect(() => {
    if (task && address && task.userAddress.toLowerCase() !== address.toLowerCase()) {
      router.push('/app')
    }
  }, [task, address, router])

  const markComplete = (id: string) => setCompletedTurns((prev) => new Set(prev).add(id))
  const updateSpent = (id: string, s: number) => setSpentByTurn((p) => ({ ...p, [id]: s }))

  const lastTurnId = extraTurns.length > 0 ? extraTurns[extraTurns.length - 1].taskId : taskId

  const handleContinue = async () => {
    if (!continuation.trim() || continuing) return
    setContinuing(true)
    try {
      const promptText = continuation.trim()
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address!.toLowerCase(),
          input: promptText,
          parentTaskId: lastTurnId, // build on the most recent turn's results
        }),
      })
      const { taskId: newId } = await res.json()
      setExtraTurns((prev) => [...prev, { taskId: newId, prompt: promptText }])
      setContinuation('')
      setContinuing(false)
      // Bring the new turn into view.
      requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
    } catch {
      setContinuing(false)
    }
  }

  if (!isConnected) return <WalletWall />

  // Turn 0: optimistic live stream (buffered replay) unless the DB says it's done.
  const terminal = !!task && (task.status === 'completed' || task.status === 'failed')
  const rootLive = !terminal
  const rootInitial = terminal ? hydrate(task!) : undefined

  const totalSpent = Object.values(spentByTurn).reduce((a, b) => a + b, 0)
  const lastDone = completedTurns.has(lastTurnId)
  const displayStatus = !lastDone ? 'running' : task?.status === 'failed' && extraTurns.length === 0 ? 'failed' : 'completed'
  const statusColor = displayStatus === 'failed' ? 'text-red-400' : displayStatus === 'completed' ? 'text-green-400' : 'text-[#FF6B35]'

  return (
    <div className="min-h-full bg-[#0A0A0A] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {notFound ? (
          <p className="text-white/70 font-body text-sm text-center mt-16">Task not found.</p>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6 pb-5 border-b border-white/[0.08]">
              <p className="text-[10px] font-display uppercase tracking-[0.2em] text-white/60 mb-2">Your request</p>
              <p className="text-white/85 font-body text-[15px] leading-relaxed">{task?.input ?? ' '}</p>
              <div className="flex items-center gap-4 mt-3 text-xs font-display uppercase tracking-wider">
                <span className="text-white/60">Spent: <span className="text-[#FF6B35]">{totalSpent.toFixed(2)} USDC</span></span>
                <span className={statusColor}>{displayStatus}</span>
              </div>
            </div>

            {/* Turn 0 */}
            <InlineExecution
              key={rootLive ? 'live' : 'done'}
              taskId={taskId}
              live={rootLive}
              initial={rootInitial}
              onBudgetUpdate={(s) => updateSpent(taskId, s)}
              onComplete={() => markComplete(taskId)}
            />

            {/* Follow-up turns — stay in the same chat */}
            {extraTurns.map((turn) => (
              <div key={turn.taskId}>
                <div className="mt-10 mb-6 pt-6 border-t border-white/[0.08]">
                  <p className="text-[10px] font-display uppercase tracking-[0.2em] text-[#FF6B35] mb-2">Follow-up</p>
                  <p className="text-white/85 font-body text-[15px] leading-relaxed">{turn.prompt}</p>
                </div>
                <InlineExecution
                  taskId={turn.taskId}
                  live
                  onBudgetUpdate={(s) => updateSpent(turn.taskId, s)}
                  onComplete={() => markComplete(turn.taskId)}
                />
              </div>
            ))}

            {/* Continue — once the most recent turn finishes */}
            {lastDone && (
              <ContinuationInput value={continuation} onChange={setContinuation} onSubmit={handleContinue} loading={continuing} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
