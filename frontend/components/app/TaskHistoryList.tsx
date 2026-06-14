'use client'

import { useRouter } from 'next/navigation'

export type TaskSummary = {
  id: string
  input: string
  status: string
  totalSpent: number
  parentTaskId: string | null
  createdAt: string
}

function groupByDay(tasks: TaskSummary[]) {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86_400_000).toDateString()
  const groups: Record<string, TaskSummary[]> = {}
  for (const task of tasks) {
    const day = new Date(task.createdAt).toDateString()
    const label =
      day === today ? 'Today'
      : day === yesterday ? 'Yesterday'
      : new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ;(groups[label] ??= []).push(task)
  }
  return groups
}

export function TaskHistoryList({ tasks, activeTaskId }: { tasks: TaskSummary[]; activeTaskId?: string }) {
  const router = useRouter()
  const groups = groupByDay(tasks)

  return (
    <div className="space-y-1">
      {Object.entries(groups).map(([label, dayTasks]) => (
        <div key={label}>
          <p className="px-4 py-1.5 text-[10px] font-display uppercase tracking-[0.15em] text-white/55">
            {label}
          </p>
          {dayTasks.map((task) => {
            const active = activeTaskId === task.id
            return (
              <button
                key={task.id}
                onClick={() => router.push(`/app/chat/${task.id}`)}
                className={`w-full text-left px-4 py-2.5 hover:bg-white/[0.05] transition-colors border-l-2 ${
                  active ? 'border-l-[#FF6B35] bg-white/[0.04]' : 'border-l-transparent'
                }`}
              >
                <p className="text-white/70 text-sm font-body truncate leading-snug flex items-center gap-1.5">
                  {task.parentTaskId && <span className="text-[#FF6B35] text-xs shrink-0">↳</span>}
                  {task.input}
                </p>
                <p className="text-white/55 text-xs mt-0.5 font-body">
                  {task.totalSpent > 0 ? `${task.totalSpent.toFixed(2)} USDC · ` : ''}
                  {task.status}
                </p>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
