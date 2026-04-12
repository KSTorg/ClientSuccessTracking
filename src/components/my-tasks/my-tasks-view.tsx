'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, ChevronRight, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SPECIALTY_LABELS } from '@/lib/types'
import type { Specialty } from '@/lib/types'

export interface ActionableTask {
  id: string
  clientId: string
  companyName: string
  program: string | null
  taskTitle: string
  stageName: string
  stageOrder: number
  dueDate: string | null
  isOverdue: boolean
  overdueDays: number
  assignedTo: string | null
  ownerId: string | null
  isClientTask: boolean
  isImported: boolean
  isActionItem?: boolean
}

export interface TeamMemberGroup {
  userId: string
  fullName: string
  specialty: string | null
  tasks: ActionableTask[]
  upcoming: ActionableTask[]
}

interface MyTasksViewProps {
  myTasks: ActionableTask[]
  myUpcoming: ActionableTask[]
  teamGroups: TeamMemberGroup[]
  isAdmin: boolean
  overdueCount: number
  totalCount: number
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function fmtDate(iso: string | null): string {
  if (!iso) return 'No due date'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return '—'
  return `${MONTH_SHORT[m - 1]} ${d}`
}

function sortTasks(tasks: ActionableTask[]): {
  overdue: ActionableTask[]
  todo: ActionableTask[]
} {
  const overdue = tasks
    .filter((t) => t.isOverdue)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  const todo = tasks
    .filter((t) => !t.isOverdue)
    .sort((a, b) => {
      // Null due dates go last
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })
  return { overdue, todo }
}

function TaskRow({ task }: { task: ActionableTask }) {
  const href = task.isActionItem
    ? `/clients/${task.clientId}?tab=success`
    : `/clients/${task.clientId}`
  return (
    <Link
      href={href}
      className="glass-panel-sm glass-panel-interactive flex items-center gap-3 px-4 py-3"
    >
      <span
        className={cn(
          'w-2.5 h-2.5 rounded-full shrink-0',
          task.isOverdue ? 'bg-red-400' : 'bg-kst-gold'
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-kst-white font-medium text-sm truncate">
            {task.companyName}
          </span>
          {task.isClientTask && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-kst-muted">
              Client task
            </span>
          )}
          {task.isActionItem && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-kst-gold/10 text-kst-gold">
              Action item
            </span>
          )}
          {task.isImported && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-kst-muted">
              imported
            </span>
          )}
        </div>
        <p className="text-kst-muted text-xs truncate mt-0.5">
          {task.stageName} — {task.taskTitle}
        </p>
      </div>
      <div className="text-right shrink-0">
        {task.isOverdue ? (
          <>
            <p className="text-xs text-kst-muted">{fmtDate(task.dueDate)}</p>
            <p className="text-xs text-red-400 font-medium">
              {task.overdueDays}d overdue
            </p>
          </>
        ) : (
          <p className="text-xs text-kst-muted">
            {task.dueDate ? `Due ${fmtDate(task.dueDate)}` : 'No due date'}
          </p>
        )}
      </div>
      <ChevronRight size={14} className="text-kst-muted/50 shrink-0" />
    </Link>
  )
}

function UpcomingTaskRow({ task }: { task: ActionableTask }) {
  const href = task.isActionItem
    ? `/clients/${task.clientId}?tab=success`
    : `/clients/${task.clientId}`
  return (
    <Link
      href={href}
      className="glass-panel-sm glass-panel-interactive flex items-center gap-3 px-4 py-3 opacity-60"
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#60A5FA]/50" />
      <div className="flex-1 min-w-0">
        <span className="text-kst-white/70 font-medium text-sm truncate block">
          {task.companyName}
        </span>
        <p className="text-kst-muted text-xs truncate mt-0.5">
          {task.stageName} — {task.taskTitle}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-kst-muted">
          {task.dueDate ? `Due ${fmtDate(task.dueDate)}` : 'No due date'}
        </p>
      </div>
      <ChevronRight size={14} className="text-kst-muted/30 shrink-0" />
    </Link>
  )
}

function TaskSection({
  title,
  dotColor,
  tasks,
}: {
  title: string
  dotColor: string
  tasks: ActionableTask[]
}) {
  if (tasks.length === 0) return null
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('w-2.5 h-2.5 rounded-full', dotColor)} />
        <h2 className="text-kst-white font-semibold text-sm">
          {title}
          <span className="text-kst-muted font-normal ml-2">({tasks.length})</span>
        </h2>
      </div>
      <div className="glass-panel p-3 space-y-2">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>
    </section>
  )
}

function UpcomingSection({ tasks }: { tasks: ActionableTask[] }) {
  if (tasks.length === 0) return null
  const sorted = [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate.localeCompare(b.dueDate)
  })
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-[#60A5FA]/50" />
        <h2 className="text-kst-white font-semibold text-sm">
          Upcoming
          <span className="text-kst-muted font-normal ml-2">({sorted.length})</span>
        </h2>
      </div>
      <div className="glass-panel p-3 space-y-2">
        {sorted.map((t) => (
          <UpcomingTaskRow key={t.id} task={t} />
        ))}
      </div>
    </section>
  )
}

function PersonGroup({ group }: { group: TeamMemberGroup }) {
  const { overdue, todo } = sortTasks(group.tasks)
  const specialtyLabel = group.specialty
    ? SPECIALTY_LABELS[group.specialty as Specialty] ?? group.specialty
    : null

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-kst-white font-semibold">
          {group.fullName}
        </h2>
        {specialtyLabel && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-kst-muted">
            {specialtyLabel}
          </span>
        )}
        <span className="text-kst-muted text-sm">
          ({group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''})
        </span>
      </div>
      <div className="space-y-4">
        <TaskSection title="Overdue" dotColor="bg-red-400" tasks={overdue} />
        <TaskSection title="To Do" dotColor="bg-kst-gold" tasks={todo} />
        <UpcomingSection tasks={group.upcoming} />
        {overdue.length === 0 && todo.length === 0 && (
          <div className="glass-panel p-6 text-center">
            <CheckCircle size={20} className="text-green-400 mx-auto mb-2" />
            <p className="text-kst-muted text-sm">All caught up!</p>
          </div>
        )}
      </div>
    </section>
  )
}

export function MyTasksView({
  myTasks,
  myUpcoming,
  teamGroups,
  isAdmin,
  overdueCount,
  totalCount,
}: MyTasksViewProps) {
  const [view, setView] = useState<'mine' | 'all'>('mine')
  const { overdue, todo } = sortTasks(myTasks)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1
          className="text-2xl md:text-3xl text-kst-gold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          My Tasks
        </h1>

        {isAdmin && (
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              type="button"
              onClick={() => setView('mine')}
              className={cn(
                'px-4 py-1.5 text-xs font-medium transition-colors',
                view === 'mine'
                  ? 'bg-kst-gold/20 text-kst-gold'
                  : 'text-kst-muted hover:text-kst-white'
              )}
            >
              My Tasks
            </button>
            <button
              type="button"
              onClick={() => setView('all')}
              className={cn(
                'px-4 py-1.5 text-xs font-medium transition-colors border-l border-white/10',
                view === 'all'
                  ? 'bg-kst-gold/20 text-kst-gold'
                  : 'text-kst-muted hover:text-kst-white'
              )}
            >
              All Team
            </button>
          </div>
        )}
      </div>

      {/* My Tasks view */}
      {view === 'mine' && (
        <>
          {totalCount === 0 ? (
            <div className="glass-panel p-12 text-center">
              <Circle size={32} className="text-kst-muted/40 mx-auto mb-3" />
              <p className="text-kst-white text-sm font-medium">
                No tasks assigned to you right now
              </p>
              <p className="text-kst-muted text-xs mt-1">
                Tasks will appear here when clients need your attention
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <TaskSection title="Overdue" dotColor="bg-red-400" tasks={overdue} />
              {todo.length > 0 ? (
                <TaskSection title="To Do" dotColor="bg-kst-gold" tasks={todo} />
              ) : overdue.length > 0 ? null : null}
              {todo.length === 0 && overdue.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-kst-gold" />
                    <h2 className="text-kst-white font-semibold text-sm">To Do</h2>
                  </div>
                  <div className="glass-panel p-6 text-center">
                    <CheckCircle size={20} className="text-green-400 mx-auto mb-2" />
                    <p className="text-kst-muted text-sm">All caught up!</p>
                  </div>
                </section>
              )}
              <UpcomingSection tasks={myUpcoming} />
            </div>
          )}
        </>
      )}

      {/* All Team view (admin only) */}
      {view === 'all' && (
        <>
          {teamGroups.length === 0 ? (
            <div className="glass-panel p-12 text-center">
              <p className="text-kst-muted text-sm">No actionable tasks across the team</p>
            </div>
          ) : (
            teamGroups.map((g) => <PersonGroup key={g.userId} group={g} />)
          )}
        </>
      )}
    </div>
  )
}
