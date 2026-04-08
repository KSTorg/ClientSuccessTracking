'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  Clock,
  FileText,
  PlayCircle,
  ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'in_review'
  | 'completed'

interface StageRow {
  id: string
  name: string
  order_index: number
}

interface TaskRow {
  id: string
  parent_task_id: string | null
  has_subtasks: boolean
  title: string
  description: string | null
  training_url: string | null
  doc_url: string | null
  extra_links: Record<string, string> | null
  order_index: number
  stage: StageRow | null
}

interface ClientTaskJoined {
  id: string
  client_id: string
  task_id: string
  status: TaskStatus
  completed_at: string | null
  task: TaskRow | null
}

interface OrganizedStage {
  stage: StageRow
  topLevel: ClientTaskJoined[]
}

interface SetupChecklistProps {
  clientId: string
  isTeamView: boolean
  clientName?: string
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

const TEAM_CYCLE: TaskStatus[] = [
  'not_started',
  'in_progress',
  'in_review',
  'completed',
]
const CLIENT_CYCLE: TaskStatus[] = ['not_started', 'in_progress', 'completed']

function nextStatus(current: TaskStatus, isTeamView: boolean): TaskStatus {
  const cycle = isTeamView ? TEAM_CYCLE : CLIENT_CYCLE
  const idx = cycle.indexOf(current)
  // If current is in_review and we're in client view, fall back to completed
  if (idx === -1) return cycle[0]!
  return cycle[(idx + 1) % cycle.length]!
}

function titleCase(s: string) {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/** Strip a known group prefix off a subtask title for display. */
function displaySubtaskTitle(title: string) {
  const idx = title.indexOf(':')
  if (idx > 0 && idx < 40) return title.slice(idx + 1).trim()
  return title
}

/** Group label for a subtask, based on title prefix or keyword fallback. */
function groupForSubtask(title: string): string {
  const idx = title.indexOf(':')
  if (idx > 0 && idx < 40) return title.slice(0, idx).trim()

  const t = title.toLowerCase()
  if (
    t.includes('business profile') ||
    t.includes('timezone') ||
    t.includes('google calendar') ||
    t.includes('google meet') ||
    t.includes('zoom') ||
    t.includes('add domain') ||
    t.includes('connect google') ||
    t.includes('connect fb')
  )
    return 'Getting Started'
  if (
    t.includes('meeting title') ||
    t.includes('meeting location') ||
    t.includes('add closer') ||
    t.includes('activate calendar')
  )
    return 'Calendar'
  if (t.includes('connect domain') || t.includes('step url'))
    return 'Funnel / Sites'
  if (
    t.includes('callout') ||
    t.includes('offer statement') ||
    t.includes('vsl') ||
    t.includes('testimonial') ||
    t.includes('color') ||
    t.includes('phone version')
  )
    return 'Landing Page'
  if (t.includes('booking') || t.includes('paste testimonial'))
    return 'Booking Page'
  if (t.includes('pre-call')) return 'Pre-Call Homework'
  if (t.includes('custom value')) return 'Custom Values'
  if (t.includes('automation') || t.includes('workflow'))
    return 'Automations'
  if (t.includes('toll free') || t.includes('phone number'))
    return 'Phone Number'
  return 'Other'
}

const GROUP_ORDER = [
  'Getting Started',
  'Calendar',
  'Funnel / Sites',
  'Landing Page',
  'Booking Page',
  'Pre-Call Homework',
  'Custom Values',
  'Automations',
  'Phone Number',
  'Other',
]

/** Effective status of a parent (has_subtasks) row, computed from its kids. */
function effectiveParentStatus(
  parent: ClientTaskJoined,
  subs: ClientTaskJoined[]
): TaskStatus {
  if (!parent.task?.has_subtasks) return parent.status
  if (subs.length === 0) return parent.status
  if (subs.every((s) => s.status === 'completed')) return 'completed'
  if (subs.every((s) => s.status === 'not_started')) return 'not_started'
  if (subs.some((s) => s.status === 'in_review')) return 'in_review'
  return 'in_progress'
}

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────

export function SetupChecklist({
  clientId,
  isTeamView,
}: SetupChecklistProps) {
  const supabase = useMemo(() => createClient(), [])

  const [rows, setRows] = useState<ClientTaskJoined[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({})
  const [openParents, setOpenParents] = useState<Record<string, boolean>>({})

  // Fetch checklist + current user
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)

      const [{ data: userData }, { data, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('client_tasks')
          .select(
            `
            id, client_id, task_id, status, completed_at,
            task:tasks (
              id, parent_task_id, has_subtasks, title, description,
              training_url, doc_url, extra_links, order_index,
              stage:stages ( id, name, order_index )
            )
            `
          )
          .eq('client_id', clientId),
      ])

      if (cancelled) return

      if (error) {
        setLoadError(error.message)
        setLoading(false)
        return
      }

      // Supabase types nested embeds as arrays; normalize.
      const normalized: ClientTaskJoined[] = (data ?? []).map((r) => {
        const raw = r as unknown as Record<string, unknown>
        const taskRaw = (Array.isArray(raw.task) ? raw.task[0] : raw.task) as
          | (Omit<TaskRow, 'stage'> & { stage: StageRow | StageRow[] | null })
          | null
        const stage = taskRaw
          ? Array.isArray(taskRaw.stage)
            ? taskRaw.stage[0] ?? null
            : taskRaw.stage
          : null
        return {
          id: r.id as string,
          client_id: r.client_id as string,
          task_id: r.task_id as string,
          status: r.status as TaskStatus,
          completed_at: (r.completed_at as string | null) ?? null,
          task: taskRaw ? { ...taskRaw, stage } : null,
        }
      })

      setRows(normalized)
      setCurrentUserId(userData.user?.id ?? null)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [clientId, supabase])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // Organize by stage
  const stages: OrganizedStage[] = useMemo(() => {
    const byStageId = new Map<string, OrganizedStage>()
    for (const r of rows) {
      const s = r.task?.stage
      if (!s) continue
      if (!byStageId.has(s.id)) {
        byStageId.set(s.id, { stage: s, topLevel: [] })
      }
      if (!r.task?.parent_task_id) {
        byStageId.get(s.id)!.topLevel.push(r)
      }
    }
    // Sort top-level tasks by order_index
    for (const stage of byStageId.values()) {
      stage.topLevel.sort(
        (a, b) => (a.task?.order_index ?? 0) - (b.task?.order_index ?? 0)
      )
    }
    return Array.from(byStageId.values()).sort(
      (a, b) => a.stage.order_index - b.stage.order_index
    )
  }, [rows])

  // Subtasks indexed by parent task_id (the master tasks.id)
  const subtasksByParent = useMemo(() => {
    const m = new Map<string, ClientTaskJoined[]>()
    for (const r of rows) {
      const pid = r.task?.parent_task_id
      if (!pid) continue
      if (!m.has(pid)) m.set(pid, [])
      m.get(pid)!.push(r)
    }
    for (const arr of m.values()) {
      arr.sort(
        (a, b) => (a.task?.order_index ?? 0) - (b.task?.order_index ?? 0)
      )
    }
    return m
  }, [rows])

  // Default stage open-state: open stage 1, plus any stage with incomplete top-level tasks
  useEffect(() => {
    if (loading || stages.length === 0) return
    setOpenStages((prev) => {
      // Only initialize once per load
      if (Object.keys(prev).length > 0) return prev
      const next: Record<string, boolean> = {}
      stages.forEach((s, i) => {
        const incomplete = s.topLevel.some((ct) => {
          const eff = ct.task?.has_subtasks
            ? effectiveParentStatus(ct, subtasksByParent.get(ct.task!.id) ?? [])
            : ct.status
          return eff !== 'completed'
        })
        next[s.stage.id] = i === 0 || incomplete
      })
      return next
    })
  }, [loading, stages, subtasksByParent])

  // Overall progress: count only top-level (non-subtask) items
  const { totalTop, completedTop } = useMemo(() => {
    let total = 0
    let done = 0
    for (const s of stages) {
      for (const ct of s.topLevel) {
        total += 1
        const eff = ct.task?.has_subtasks
          ? effectiveParentStatus(ct, subtasksByParent.get(ct.task!.id) ?? [])
          : ct.status
        if (eff === 'completed') done += 1
      }
    }
    return { totalTop: total, completedTop: done }
  }, [stages, subtasksByParent])

  const overallPct =
    totalTop > 0 ? Math.round((completedTop / totalTop) * 100) : 0

  // ───── Mutation ────────────────────────────────────────────────────────
  const cycleTaskStatus = useCallback(
    async (clientTaskId: string) => {
      const target = rows.find((r) => r.id === clientTaskId)
      if (!target) return
      if (target.task?.has_subtasks) return // parent: auto-calculated

      const next = nextStatus(target.status, isTeamView)
      const completedAt =
        next === 'completed' ? new Date().toISOString() : null

      // Optimistic
      const prevStatus = target.status
      const prevCompletedAt = target.completed_at
      setRows((prev) =>
        prev.map((r) =>
          r.id === clientTaskId
            ? { ...r, status: next, completed_at: completedAt }
            : r
        )
      )

      const { error } = await supabase
        .from('client_tasks')
        .update({
          status: next,
          completed_at: completedAt,
          completed_by: next === 'completed' ? currentUserId : null,
        })
        .eq('id', clientTaskId)

      if (error) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === clientTaskId
              ? { ...r, status: prevStatus, completed_at: prevCompletedAt }
              : r
          )
        )
        setToast(`Couldn't update task: ${error.message}`)
      }
    },
    [rows, isTeamView, supabase, currentUserId]
  )

  // ───── Render ─────────────────────────────────────────────────────────
  if (loading) return <ChecklistSkeleton />

  if (loadError) {
    return (
      <div className="glass-panel p-6">
        <p className="text-kst-error text-sm">
          Could not load checklist: {loadError}
        </p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="glass-panel p-8 text-center">
        <p className="text-kst-muted text-sm">
          No checklist tasks have been generated for this client yet.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="mb-4 glass-panel-sm px-4 py-3 text-sm text-kst-error">
          {toast}
        </div>
      )}

      {/* Overall progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-kst-muted text-xs uppercase tracking-wider">
            Overall Progress
          </span>
          <span className="text-kst-muted text-xs">
            {completedTop} of {totalTop} tasks completed ({overallPct}%)
          </span>
        </div>
        <div className="h-2 rounded-full bg-kst-surface overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-kst-gold to-kst-gold-light transition-[width] duration-500 ease-out"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="flex flex-col gap-4">
        {stages.map((stage, stageIdx) => {
          const stageOpen = openStages[stage.stage.id] ?? stageIdx === 0
          const stageDone = stage.topLevel.filter((ct) => {
            const eff = ct.task?.has_subtasks
              ? effectiveParentStatus(
                  ct,
                  subtasksByParent.get(ct.task!.id) ?? []
                )
              : ct.status
            return eff === 'completed'
          }).length

          return (
            <div key={stage.stage.id} className="glass-panel-sm overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setOpenStages((p) => ({
                    ...p,
                    [stage.stage.id]: !stageOpen,
                  }))
                }
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full border border-kst-gold/60 text-kst-gold flex items-center justify-center text-xs font-semibold bg-kst-gold/5">
                    {stageIdx + 1}
                  </span>
                  <span className="text-kst-white font-semibold">
                    {stage.stage.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-kst-muted text-xs">
                    {stageDone}/{stage.topLevel.length}
                  </span>
                  <ChevronDown
                    size={16}
                    className={cn(
                      'text-kst-muted transition-transform',
                      stageOpen && 'rotate-180'
                    )}
                  />
                </div>
              </button>

              {stageOpen && (
                <div className="border-t border-white/[0.05] px-2 py-2">
                  {stage.topLevel.map((ct) => (
                    <TopLevelTask
                      key={ct.id}
                      ct={ct}
                      subs={
                        ct.task?.has_subtasks
                          ? subtasksByParent.get(ct.task!.id) ?? []
                          : []
                      }
                      isTeamView={isTeamView}
                      cycleStatus={cycleTaskStatus}
                      isParentExpanded={
                        openParents[ct.id] ?? !!ct.task?.has_subtasks
                      }
                      toggleParent={() =>
                        setOpenParents((p) => ({
                          ...p,
                          [ct.id]:
                            p[ct.id] === undefined
                              ? !ct.task?.has_subtasks
                              : !p[ct.id],
                        }))
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

interface TopLevelTaskProps {
  ct: ClientTaskJoined
  subs: ClientTaskJoined[]
  isTeamView: boolean
  cycleStatus: (id: string) => void
  isParentExpanded: boolean
  toggleParent: () => void
}

function TopLevelTask({
  ct,
  subs,
  isTeamView,
  cycleStatus,
  isParentExpanded,
  toggleParent,
}: TopLevelTaskProps) {
  const hasSubs = !!ct.task?.has_subtasks
  const effective = hasSubs ? effectiveParentStatus(ct, subs) : ct.status
  const subsDone = subs.filter((s) => s.status === 'completed').length

  // Group subtasks for display
  const grouped = useMemo(() => {
    const m = new Map<string, ClientTaskJoined[]>()
    for (const s of subs) {
      const g = groupForSubtask(s.task?.title ?? '')
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(s)
    }
    return Array.from(m.entries()).sort(
      (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0])
    )
  }, [subs])

  return (
    <div>
      <div className="group flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors">
        <StatusIndicator
          status={effective}
          disabled={hasSubs}
          isTeamView={isTeamView}
          onClick={() => !hasSubs && cycleStatus(ct.id)}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={hasSubs ? toggleParent : undefined}
              className={cn(
                'text-sm text-left',
                effective === 'completed'
                  ? 'text-kst-muted line-through'
                  : 'text-kst-white',
                hasSubs && 'hover:text-kst-gold transition-colors cursor-pointer'
              )}
            >
              {ct.task?.title ?? 'Untitled task'}
            </button>
            {hasSubs && (
              <span className="text-kst-muted text-xs">
                ({subsDone}/{subs.length} subtasks done)
              </span>
            )}
            {hasSubs && (
              <ChevronDown
                size={14}
                className={cn(
                  'text-kst-muted transition-transform ml-1',
                  isParentExpanded && 'rotate-180'
                )}
              />
            )}
          </div>
          {ct.task?.description && (
            <p className="text-kst-muted text-xs mt-0.5">
              {ct.task.description}
            </p>
          )}
        </div>

        <TaskLinks task={ct.task} />
      </div>

      {hasSubs && isParentExpanded && (
        <div className="ml-9 mr-2 mb-2 border-l border-white/[0.06] pl-4">
          {grouped.map(([groupName, items]) => (
            <div key={groupName} className="mt-3 first:mt-1">
              <p className="text-[10px] uppercase tracking-wider text-kst-muted/70 px-2 mb-1">
                {groupName}
              </p>
              {items.map((s) => (
                <SubtaskRow
                  key={s.id}
                  ct={s}
                  isTeamView={isTeamView}
                  cycleStatus={cycleStatus}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SubtaskRow({
  ct,
  isTeamView,
  cycleStatus,
}: {
  ct: ClientTaskJoined
  isTeamView: boolean
  cycleStatus: (id: string) => void
}) {
  return (
    <div className="group flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
      <StatusIndicator
        status={ct.status}
        isTeamView={isTeamView}
        onClick={() => cycleStatus(ct.id)}
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm',
            ct.status === 'completed'
              ? 'text-kst-muted line-through'
              : 'text-kst-white'
          )}
        >
          {displaySubtaskTitle(ct.task?.title ?? '')}
        </p>
      </div>
      <TaskLinks task={ct.task} small />
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Bits
// ───────────────────────────────────────────────────────────────────────────

function StatusIndicator({
  status,
  onClick,
  disabled,
  isTeamView,
}: {
  status: TaskStatus
  onClick?: () => void
  disabled?: boolean
  isTeamView?: boolean
}) {
  // Hide in_review entirely from client view (it should never reach a client
  // anyway, but be safe)
  const display: TaskStatus =
    !isTeamView && status === 'in_review' ? 'in_progress' : status

  const base =
    'mt-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0'

  const inner = (() => {
    switch (display) {
      case 'completed':
        return (
          <div className="w-6 h-6 rounded-full bg-kst-gold flex items-center justify-center shadow-[0_0_12px_rgba(201,168,76,0.4)]">
            <Check size={14} className="text-kst-black" strokeWidth={3} />
          </div>
        )
      case 'in_review':
        return (
          <div className="w-6 h-6 rounded-full border-2 border-kst-gold flex items-center justify-center bg-kst-gold/10">
            <Clock size={11} className="text-kst-gold" />
          </div>
        )
      case 'in_progress':
        return (
          <div className="w-6 h-6 rounded-full border-2 border-kst-gold flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-kst-gold animate-pulse" />
          </div>
        )
      default:
        return (
          <div className="w-6 h-6 rounded-full border-2 border-white/20 group-hover:border-white/40 transition-colors" />
        )
    }
  })()

  if (disabled) {
    return <div className={cn(base, 'opacity-90')}>{inner}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(base, 'cursor-pointer hover:scale-110')}
      aria-label="Toggle task status"
    >
      {inner}
    </button>
  )
}

function TaskLinks({
  task,
  small = false,
}: {
  task: TaskRow | null
  small?: boolean
}) {
  if (!task) return null
  const extras = task.extra_links ?? null
  const hasAny =
    !!task.training_url || !!task.doc_url || (extras && Object.keys(extras).length > 0)
  if (!hasAny) return null

  const sizeCls = small ? 'text-[10px] px-2 py-1' : 'text-xs px-2.5 py-1'

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      {task.training_url && (
        <LinkButton href={task.training_url} className={sizeCls}>
          <PlayCircle size={small ? 11 : 12} />
          Training
        </LinkButton>
      )}
      {task.doc_url && (
        <LinkButton href={task.doc_url} className={sizeCls}>
          <FileText size={small ? 11 : 12} />
          Doc
        </LinkButton>
      )}
      {extras &&
        Object.entries(extras).map(([key, url]) => (
          <LinkButton key={key} href={url} className={sizeCls}>
            <ExternalLink size={small ? 11 : 12} />
            {titleCase(key)}
          </LinkButton>
        ))}
    </div>
  )
}

function LinkButton({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-kst-gold/30 text-kst-gold hover:bg-kst-gold/10 transition-colors font-medium',
        className
      )}
    >
      {children}
    </a>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Skeleton
// ───────────────────────────────────────────────────────────────────────────

function ChecklistSkeleton() {
  return (
    <div>
      <div className="mb-8">
        <div className="h-3 w-40 rounded skeleton-shimmer mb-3" />
        <div className="h-2 w-full rounded-full skeleton-shimmer" />
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass-panel-sm p-5">
            <div className="h-4 w-1/3 rounded skeleton-shimmer" />
            <div className="mt-4 space-y-3">
              <div className="h-3 w-full rounded skeleton-shimmer" />
              <div className="h-3 w-5/6 rounded skeleton-shimmer" />
              <div className="h-3 w-4/6 rounded skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 0%,
            rgba(201,168,76,0.10) 50%,
            rgba(255,255,255,0.04) 100%
          );
          background-size: 200% 100%;
          animation: kst-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes kst-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
