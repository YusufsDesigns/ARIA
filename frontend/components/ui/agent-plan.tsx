'use client'

import { useState, useEffect } from 'react'

export type SubTask = {
  id: string
  title: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  tools?: string[]
}

export type PlanTask = {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  tools?: string[]
  subtasks?: SubTask[]
  dependencies?: string[]
}

type AgentPlanProps = {
  tasks: PlanTask[]
  className?: string
}

const STATUS_DOT: Record<string, string> = {
  pending: '#555',
  'in-progress': '#FF6B35',
  completed: '#22C55E',
  failed: '#EF4444',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'PENDING',
  'in-progress': 'RUNNING',
  completed: 'DONE',
  failed: 'FAILED',
}

function PulsingDot({ color }: { color: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10, flexShrink: 0 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%', background: color,
        animation: color === '#FF6B35' ? 'ping 1s cubic-bezier(0,0,0.2,1) infinite' : 'none',
        opacity: 0.4,
      }} />
      <span style={{ position: 'relative', width: 10, height: 10, borderRadius: '50%', background: color }} />
    </span>
  )
}

function TaskRow({ task, depth = 0 }: { task: PlanTask | SubTask; depth?: number }) {
  const [open, setOpen] = useState(task.status === 'in-progress' || task.status === 'completed')
  const hasChildren = 'subtasks' in task && task.subtasks && task.subtasks.length > 0
  const color = STATUS_DOT[task.status]

  return (
    <div style={{ borderLeft: depth > 0 ? '1px solid #222' : 'none', marginLeft: depth > 0 ? 16 : 0, paddingLeft: depth > 0 ? 16 : 0 }}>
      <div
        onClick={() => hasChildren && setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0',
          cursor: hasChildren ? 'pointer' : 'default',
          borderBottom: '1px solid #111',
        }}
      >
        <div style={{ paddingTop: 4, flexShrink: 0 }}>
          <PulsingDot color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: depth === 0 ? 13 : 11,
              fontWeight: 600,
              color: task.status === 'pending' ? '#555' : '#fff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {task.title}
            </span>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 9,
              fontWeight: 700,
              color: color,
              letterSpacing: '0.1em',
              background: `${color}15`,
              border: `1px solid ${color}40`,
              padding: '1px 6px',
            }}>
              {STATUS_LABEL[task.status]}
            </span>
          </div>
          {'description' in task && task.description && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#666', marginTop: 3, lineHeight: 1.5 }}>
              {task.description}
            </p>
          )}
          {task.tools && task.tools.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {task.tools.map((t) => (
                <span key={t} style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 9,
                  color: '#FF6B35',
                  background: '#FF6B3510',
                  border: '1px solid #FF6B3530',
                  padding: '1px 6px',
                  letterSpacing: '0.06em',
                }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        {hasChildren && (
          <span style={{ color: '#444', fontSize: 10, flexShrink: 0, paddingTop: 4 }}>
            {open ? '▾' : '▸'}
          </span>
        )}
      </div>
      {hasChildren && open && (task as PlanTask).subtasks && (
        <div style={{ marginTop: 2 }}>
          {(task as PlanTask).subtasks!.map((sub) => (
            <TaskRow key={sub.id} task={sub as any} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function AgentPlan({ tasks, className }: AgentPlanProps) {
  const completed = tasks.filter((t) => t.status === 'completed').length
  const running = tasks.filter((t) => t.status === 'in-progress').length
  const pending = tasks.filter((t) => t.status === 'pending').length

  return (
    <div className={className} style={{
      background: '#080808',
      border: '1px solid #1E1E1E',
      fontFamily: 'var(--font-body)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid #1E1E1E', background: '#0D0D0D',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 10,
          fontWeight: 700,
          color: '#FF6B35',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          AGENT PLAN
        </span>
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { label: 'DONE', val: completed, color: '#22C55E' },
            { label: 'RUN', val: running, color: '#FF6B35' },
            { label: 'WAIT', val: pending, color: '#555' },
          ].map(({ label, val, color }) => (
            <span key={label} style={{ fontFamily: 'var(--font-display)', fontSize: 9, color, letterSpacing: '0.08em' }}>
              {val} {label}
            </span>
          ))}
        </div>
      </div>

      {/* Tasks */}
      <div style={{ padding: '0 20px' }}>
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

/* Animated live demo that cycles through states */
export function AgentPlanDemo({ tasks: initialTasks }: { tasks: PlanTask[] }) {
  const [tasks, setTasks] = useState<PlanTask[]>(initialTasks)

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      setTasks((prev) => {
        const next = [...prev]
        const pendingIdx = next.findIndex((t) => t.status === 'pending')
        const runningIdx = next.findIndex((t) => t.status === 'in-progress')
        if (runningIdx !== -1) {
          next[runningIdx] = { ...next[runningIdx], status: 'completed' }
        }
        if (pendingIdx !== -1) {
          next[pendingIdx] = { ...next[pendingIdx], status: 'in-progress' }
        } else if (runningIdx === -1) {
          // Reset
          return initialTasks
        }
        return next
      })
      i++
    }, 2200)
    return () => clearInterval(interval)
  }, [initialTasks])

  return <AgentPlan tasks={tasks} />
}
