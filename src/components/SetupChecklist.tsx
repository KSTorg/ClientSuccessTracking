'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
// Constants & Helpers
// ───────────────────────────────────────────────────────────────────────────

const TEAM_STATUSES: TaskStatus[] = [
  'not_started',
  'in_progress',
  'in_review',
  'completed',
]
const CLIENT_STATUSES: TaskStatus[] = [
  'not_started',
  'in_progress',
  'completed',
]

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  in_review: 'In Review',
  completed: 'Completed',
}

function hasUrl(url: string | null | undefined): boolean {
  return !!url && url.trim().length > 0
}

function titleCase(s: string) {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function displaySubtaskTitle(title: string) {
  const idx = title.indexOf(':')
  if (idx > 0 && idx < 40) return title.slice(idx + 1).trim()
  return title
}

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

  // Fetch
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

      const normalized: ClientTaskJoined[] = (data ?? []).map((r) => {
        const raw = r as unknown as Record<string, unknown>
        const taskRaw = (Array.isArray(raw.task) ? raw.task[0] : raw.task) as
          | (Omit<TaskRow, 'stage'> & {
              stage: StageRow | StageRow[] | null
            })
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
    for (const stage of byStageId.values()) {
      stage.topLevel.sort(
        (a, b) => (a.task?.order_index ?? 0) - (b.task?.order_index ?? 0)
      )
    }
    return Array.from(byStageId.values()).sort(
      (a, b) => a.stage.order_index - b.stage.order_index
    )
  }, [rows])

  // Subtasks indexed by parent task_id
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

  // Overall progress: top-level only
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

  // Status mutation (now takes an explicit target status)
  const updateTaskStatus = useCallback(
    async (clientTaskId: string, next: TaskStatus) => {
      const target = rows.find((r) => r.id === clientTaskId)
      if (!target || target.task?.has_subtasks) return
      if (target.status === next) return

      const completedAt =
        next === 'completed' ? new Date().toISOString() : null

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
    [rows, supabase, currentUserId]
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
          const stageOpen = openStages[stage.stage.id] ?? true
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
            <div
              key={stage.stage.id}
              className="glass-panel-sm overflow-visible"
            >
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
                      onSetStatus={updateTaskStatus}
                      isParentExpanded={openParents[ct.id] ?? false}
                      toggleParent={() =>
                        setOpenParents((p) => ({
                          ...p,
                          [ct.id]: !(p[ct.id] ?? false),
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
// Top-level task row
// ───────────────────────────────────────────────────────────────────────────

interface TopLevelTaskProps {
  ct: ClientTaskJoined
  subs: ClientTaskJoined[]
  isTeamView: boolean
  onSetStatus: (id: string, next: TaskStatus) => void
  isParentExpanded: boolean
  toggleParent: () => void
}

function TopLevelTask({
  ct,
  subs,
  isTeamView,
  onSetStatus,
  isParentExpanded,
  toggleParent,
}: TopLevelTaskProps) {
  const hasSubs = !!ct.task?.has_subtasks
  const effective = hasSubs ? effectiveParentStatus(ct, subs) : ct.status
  const subsDone = subs.filter((s) => s.status === 'completed').length

  // Group subtasks (static display, no per-group collapse)
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
      <div
        className={cn(
          'group flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors',
          hasSubs && 'cursor-pointer'
        )}
        onClick={hasSubs ? toggleParent : undefined}
        role={hasSubs ? 'button' : undefined}
        tabIndex={hasSubs ? 0 : undefined}
        onKeyDown={
          hasSubs
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleParent()
                }
              }
            : undefined
        }
      >
        {hasSubs ? (
          <div className="mt-0.5">
            <StatusGlyph status={effective} />
          </div>
        ) : (
          <div onClick={(e) => e.stopPropagation()}>
            <StatusPicker
              status={ct.status}
              isTeamView={isTeamView}
              onChange={(next) => onSetStatus(ct.id, next)}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-sm',
                effective === 'completed'
                  ? 'text-kst-muted line-through'
                  : 'text-kst-white',
                hasSubs && 'group-hover:text-kst-gold transition-colors'
              )}
            >
              {ct.task?.title ?? 'Untitled task'}
            </span>
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
        <div className="ml-9 mr-2 mb-2 border-l border-white/[0.06] pl-4 kst-fade-in">
          {grouped.map(([groupName, items]) => {
            const groupDone = items.filter(
              (i) => i.status === 'completed'
            ).length
            return (
              <div key={groupName} className="mt-3 first:mt-1">
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-kst-muted/80 font-semibold">
                    {groupName}
                  </span>
                  <span className="text-[10px] text-kst-muted/60">
                    {groupDone}/{items.length}
                  </span>
                </div>
                {items.map((s) => (
                  <SubtaskRow
                    key={s.id}
                    ct={s}
                    isTeamView={isTeamView}
                    onSetStatus={onSetStatus}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SubtaskRow({
  ct,
  isTeamView,
  onSetStatus,
}: {
  ct: ClientTaskJoined
  isTeamView: boolean
  onSetStatus: (id: string, next: TaskStatus) => void
}) {
  return (
    <div className="group flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors">
      <StatusPicker
        status={ct.status}
        isTeamView={isTeamView}
        onChange={(next) => onSetStatus(ct.id, next)}
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
// Status picker (dropdown)
// ───────────────────────────────────────────────────────────────────────────

function StatusPicker({
  status,
  isTeamView,
  onChange,
}: {
  status: TaskStatus
  isTeamView: boolean
  onChange: (next: TaskStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Click outside / escape
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Smart positioning: flip up if too close to bottom of viewport
  useEffect(() => {
    if (!open || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setFlipUp(spaceBelow < 180)
  }, [open])

  // Hide in_review from client view
  const display: TaskStatus =
    !isTeamView && status === 'in_review' ? 'in_progress' : status

  const options: TaskStatus[] = isTeamView ? TEAM_STATUSES : CLIENT_STATUSES

  return (
    <div ref={wrapRef} className="relative mt-0.5 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="block hover:scale-110 transition-transform"
        aria-label="Change task status"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <StatusGlyph status={display} />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 left-0 min-w-[180px] kst-dropdown p-1 kst-fade-in',
            flipUp ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          {options.map((opt) => {
            const active = opt === status
            return (
              <button
                key={opt}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(opt)
                  setOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-white/[0.06] transition-colors',
                  active && 'bg-kst-gold/10'
                )}
              >
                <StatusGlyph status={opt} />
                <span
                  className={cn(
                    'flex-1',
                    active ? 'text-kst-white' : 'text-kst-muted'
                  )}
                >
                  {STATUS_LABELS[opt]}
                </span>
                {active && <Check size={14} className="text-kst-gold" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusGlyph({ status }: { status: TaskStatus }) {
  switch (status) {
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
}

// ───────────────────────────────────────────────────────────────────────────
// Task links
// ───────────────────────────────────────────────────────────────────────────

function TaskLinks({
  task,
  small = false,
}: {
  task: TaskRow | null
  small?: boolean
}) {
  if (!task) return null

  const validExtras = task.extra_links
    ? Object.entries(task.extra_links).filter(([, url]) => hasUrl(url))
    : []

  const hasTraining = hasUrl(task.training_url)
  const hasDoc = hasUrl(task.doc_url)

  if (!hasTraining && !hasDoc && validExtras.length === 0) return null

  const sizeCls = small ? 'text-[10px] px-2 py-1' : 'text-xs px-2.5 py-1'

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      {hasTraining && (
        <LinkButton href={task.training_url!} className={sizeCls}>
          <PlayCircle size={small ? 11 : 12} />
          Training
        </LinkButton>
      )}
      {hasDoc && (
        <LinkButton href={task.doc_url!} className={sizeCls}>
          <FileText size={small ? 11 : 12} />
          Doc
        </LinkButton>
      )}
      {validExtras.map(([key, url]) => (
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
