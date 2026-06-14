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
  const [spent, setSpent] = useState(0)
  const [continuation, setContinuation] = useState('')
  const [continuing, setContinuing] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/task/${taskId}`)
        if (!res.ok) { if (!cancelled) setNotFound(true); return }
        const data = (await res.json()) as TaskData
        if (!cancelled) { setTask(data); setSpent(data.totalSpent) }
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

  const handleContinue = async () => {
    if (!continuation.trim() || continuing) return
    setContinuing(true)
    try {
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address!.toLowerCase(),
          input: continuation.trim(),
          parentTaskId: taskId,
        }),
      })
      const { taskId: newId } = await res.json()
      router.push(`/app/chat/${newId}`)
    } catch {
      setContinuing(false)
    }
  }

  if (!isConnected) return <WalletWall />

  if (notFound) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#0A0A0A]">
        <p className="text-white/40 font-body text-sm">Task not found.</p>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#0A0A0A]">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-[#FF6B35] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  const live = task.status === 'running' || task.status === 'pending'
  const initial = live ? undefined : hydrate(task)
  const isComplete = task.status === 'completed'

  return (
    <div className="min-h-full bg-[#0A0A0A] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Task header */}
        <div className="mb-6 pb-5 border-b border-white/[0.06]">
          <p className="text-[10px] font-display uppercase tracking-[0.2em] text-white/30 mb-2">Your request</p>
          <p className="text-white/85 font-body text-[15px] leading-relaxed">{task.input}</p>
          <div className="flex items-center gap-4 mt-3 text-xs font-display uppercase tracking-wider">
            <span className="text-white/35">Spent: <span className="text-[#FF6B35]">{spent.toFixed(2)} USDC</span></span>
            <span className={`${task.status === 'failed' ? 'text-red-400' : isComplete ? 'text-green-400' : 'text-[#FF6B35]'}`}>{task.status}</span>
          </div>
        </div>

        {/* Execution / results — the rich renderer (live SSE or hydrated from DB) */}
        <InlineExecution taskId={taskId} live={live} initial={initial} onBudgetUpdate={setSpent} />

        {/* Continue — only on a completed task */}
        {isComplete && (
          <ContinuationInput value={continuation} onChange={setContinuation} onSubmit={handleContinue} loading={continuing} />
        )}
      </div>
    </div>
  )
}
