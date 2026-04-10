'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clock,
  FileText,
  PlayCircle,
  ExternalLink,
  Rocket,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  SPECIALTY_LABELS,
  type Program,
  type Specialty,
} from '@/lib/types'
import { SpecialtyBadge } from '@/components/team/specialty-badge'

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
  default_specialty: Specialty | null
  client_facing_accelerator: boolean | null
  accelerator_hide_docs: boolean | null
  stage: StageRow | null
}

interface ClientTaskJoined {
  id: string
  client_id: string
  task_id: string
  status: TaskStatus
  completed_at: string | null
  assigned_to: string | null
  due_date: string | null
  task: TaskRow | null
}

interface OrganizedStage {
  stage: StageRow
  topLevel: ClientTaskJoined[]
}

interface Stage12Progress {
  total: number
  completed: number
}

export interface ChecklistTeamMember {
  id: string
  full_name: string | null
  specialty: Specialty | null
}

interface SetupChecklistProps {
  clientId: string
  isTeamView: boolean
  clientName?: string
  isLaunched?: boolean
  program?: Program
  teamMembers?: ChecklistTeamMember[]
  /** Primary contact name — shown in team view on rows with a null
   *  assignee so the team knows whose work it is. */
  clientContactName?: string | null
  /** Client's joined_date, used to render the timeline indicator
   *  ("Day X of 16") at the top of the checklist. */
  joinedDate?: string | null
  onLaunchedChange?: (launchedDate: string | null) => void
  onStage12ProgressChange?: (progress: Stage12Progress) => void
}

const TIMELINE_TOTAL_DAYS = 16

const LAUNCH_TASK_TITLE = 'Launch Ads'

interface PendingLaunch {
  clientTaskId: string
  prevStatus: TaskStatus
  prevCompletedAt: string | null
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
  clientName,
  isLaunched = false,
  program = 'educator_incubator',
  teamMembers = [],
  clientContactName = null,
  joinedDate = null,
  onLaunchedChange,
  onStage12ProgressChange,
}: SetupChecklistProps) {
  const supabase = useMemo(() => createClient(), [])

  const [rows, setRows] = useState<ClientTaskJoined[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({})
  const [openParents, setOpenParents] = useState<Record<string, boolean>>({})
  const [pendingLaunch, setPendingLaunch] = useState<PendingLaunch | null>(null)

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
            id, client_id, task_id, status, completed_at, assigned_to,
            due_date,
            task:tasks (
              id, parent_task_id, has_subtasks, title, description,
              training_url, doc_url, extra_links, order_index,
              default_specialty, client_facing_accelerator,
              accelerator_hide_docs,
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
          assigned_to: (r.assigned_to as string | null) ?? null,
          due_date: (r.due_date as string | null) ?? null,
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

  // Silent launch revert (when Launch Ads moves away from completed)
  const revertLaunchOnClient = useCallback(async () => {
    const { error } = await supabase
      .from('clients')
      .update({ launched_date: null, status: 'onboarding' })
      .eq('id', clientId)
    if (error) {
      setToast(`Couldn't revert launch: ${error.message}`)
      return
    }
    onLaunchedChange?.(null)
  }, [supabase, clientId, onLaunchedChange])

  // Status mutation (now takes an explicit target status)
  const updateTaskStatus = useCallback(
    async (clientTaskId: string, next: TaskStatus) => {
      const target = rows.find((r) => r.id === clientTaskId)
      if (!target || target.task?.has_subtasks) return
      if (target.status === next) return

      const isLaunchTask = target.task?.title === LAUNCH_TASK_TITLE
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
        return
      }

      // Fire-and-forget audit log — never block the UI on this, just warn
      // in the console if the insert fails (missing table, RLS, etc.).
      supabase
        .from('activity_log')
        .insert({
          client_id: clientId,
          client_task_id: clientTaskId,
          action: 'status_change',
          old_value: prevStatus,
          new_value: next,
          performed_by: currentUserId,
        })
        .then(({ error: logError }) => {
          if (logError) {
            console.warn(
              '[checklist] activity_log insert failed:',
              logError.message
            )
          }
        })

      // Fire-and-forget Discord notification on completion
      if (next === 'completed' && target.task?.title) {
        fetch('/api/notifications/task-completed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            taskTitle: target.task.title,
            completedByName: '',
          }),
        }).catch(() => {})
      }

      // Launch gate
      if (isLaunchTask) {
        if (next === 'completed' && !isLaunched) {
          setPendingLaunch({
            clientTaskId,
            prevStatus,
            prevCompletedAt,
          })
        } else if (
          prevStatus === 'completed' &&
          next !== 'completed' &&
          isLaunched
        ) {
          await revertLaunchOnClient()
        }
      }
    },
    [
      rows,
      supabase,
      currentUserId,
      clientId,
      isLaunched,
      revertLaunchOnClient,
    ]
  )

  // Confirm the pending launch (writes to clients table)
  const confirmLaunch = useCallback(async () => {
    if (!pendingLaunch) return
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('clients')
      .update({ launched_date: today, status: 'launched' })
      .eq('id', clientId)
    if (error) {
      setToast(`Couldn't launch client: ${error.message}`)
      return
    }
    onLaunchedChange?.(today)
    setPendingLaunch(null)
  }, [pendingLaunch, supabase, clientId, onLaunchedChange])

  // Update a task's due date (team view only — client view is read-only).
  const updateDueDate = useCallback(
    async (clientTaskId: string, nextDate: string | null) => {
      const prev = rows.find((r) => r.id === clientTaskId)
      if (!prev) return
      const prevDate = prev.due_date
      setRows((rs) =>
        rs.map((r) =>
          r.id === clientTaskId ? { ...r, due_date: nextDate } : r
        )
      )
      const { error } = await supabase
        .from('client_tasks')
        .update({ due_date: nextDate })
        .eq('id', clientTaskId)
      if (error) {
        setRows((rs) =>
          rs.map((r) =>
            r.id === clientTaskId ? { ...r, due_date: prevDate } : r
          )
        )
        setToast(`Couldn't update due date: ${error.message}`)
      }
    },
    [rows, supabase]
  )

  // Reassign a task to a different team member (or null for Unassigned)
  const reassignTask = useCallback(
    async (clientTaskId: string, nextAssigneeId: string | null) => {
      const prev = rows.find((r) => r.id === clientTaskId)
      if (!prev) return
      const prevAssignee = prev.assigned_to
      setRows((rs) =>
        rs.map((r) =>
          r.id === clientTaskId ? { ...r, assigned_to: nextAssigneeId } : r
        )
      )
      const { error } = await supabase
        .from('client_tasks')
        .update({ assigned_to: nextAssigneeId })
        .eq('id', clientTaskId)
      if (error) {
        setRows((rs) =>
          rs.map((r) =>
            r.id === clientTaskId
              ? { ...r, assigned_to: prevAssignee }
              : r
          )
        )
        setToast(`Couldn't reassign task: ${error.message}`)
      }
    },
    [rows, supabase]
  )

  // Lookup helper for assignee display
  const teamById = useMemo(() => {
    const m = new Map<string, ChecklistTeamMember>()
    for (const t of teamMembers) m.set(t.id, t)
    return m
  }, [teamMembers])

  // Cancel the pending launch — revert the task back to its previous status
  const cancelLaunch = useCallback(async () => {
    if (!pendingLaunch) return
    const { clientTaskId, prevStatus, prevCompletedAt } = pendingLaunch
    setRows((prev) =>
      prev.map((r) =>
        r.id === clientTaskId
          ? { ...r, status: prevStatus, completed_at: prevCompletedAt }
          : r
      )
    )
    const { error } = await supabase
      .from('client_tasks')
      .update({
        status: prevStatus,
        completed_at: prevCompletedAt,
        completed_by: null,
      })
      .eq('id', clientTaskId)
    if (error) {
      setToast(`Couldn't revert task: ${error.message}`)
    }
    setPendingLaunch(null)
  }, [pendingLaunch, supabase])

  // Emit Stage 1 + 2 progress to the parent whenever it changes
  useEffect(() => {
    if (!onStage12ProgressChange || stages.length === 0) return
    let total = 0
    let completed = 0
    for (let i = 0; i < Math.min(2, stages.length); i++) {
      const stage = stages[i]!
      for (const ct of stage.topLevel) {
        total += 1
        const eff = ct.task?.has_subtasks
          ? effectiveParentStatus(
              ct,
              subtasksByParent.get(ct.task!.id) ?? []
            )
          : ct.status
        if (eff === 'completed') completed += 1
      }
    }
    onStage12ProgressChange({ total, completed })
  }, [stages, subtasksByParent, onStage12ProgressChange])

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

      {/* Timeline (days since joined_date) */}
      {joinedDate && <TimelineIndicator joinedDate={joinedDate} />}

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
                      program={program}
                      teamMembers={teamMembers}
                      teamById={teamById}
                      clientContactName={clientContactName}
                      onSetStatus={updateTaskStatus}
                      onReassign={reassignTask}
                      onUpdateDueDate={updateDueDate}
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

      {pendingLaunch && (
        <LaunchConfirmModal
          companyName={clientName ?? 'this client'}
          onConfirm={confirmLaunch}
          onCancel={cancelLaunch}
        />
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Launch confirmation modal
// ───────────────────────────────────────────────────────────────────────────

function LaunchConfirmModal({
  companyName,
  onConfirm,
  onCancel,
}: {
  companyName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/70 backdrop-blur-[20px] backdrop-saturate-[1.2]"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div className="min-h-full flex items-start md:items-center justify-center p-4 py-8 md:py-16">
        <div
          className="glass-panel relative w-full max-w-[480px] p-7 kst-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-kst-gold/10 border border-kst-gold/40 flex items-center justify-center">
              <Rocket size={18} className="text-kst-gold" />
            </div>
            <h2 className="text-kst-white text-xl font-semibold">
              Launch {companyName}?
            </h2>
          </div>
          <p className="text-kst-muted text-sm leading-relaxed mb-6">
            Marking &lsquo;Launch Ads&rsquo; as complete will launch this
            client and enable Success Tracking. The launch date will be set
            to today.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 h-11 rounded-xl glass-panel-sm text-kst-muted hover:text-kst-white transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold hover:bg-kst-gold-light transition-colors text-sm shadow-[0_8px_32px_rgba(201,168,76,0.25)]"
            >
              <Rocket size={14} />
              Confirm Launch
            </button>
          </div>
        </div>
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
  program: Program
  teamMembers: ChecklistTeamMember[]
  teamById: Map<string, ChecklistTeamMember>
  clientContactName: string | null
  onSetStatus: (id: string, next: TaskStatus) => void
  onReassign: (id: string, next: string | null) => void
  onUpdateDueDate: (id: string, next: string | null) => void
  isParentExpanded: boolean
  toggleParent: () => void
}

function TopLevelTask({
  ct,
  subs,
  isTeamView,
  program,
  teamMembers,
  teamById,
  clientContactName,
  onSetStatus,
  onReassign,
  onUpdateDueDate,
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

  // Accelerator gating for client view: assigned-to-team tasks are read-only
  const isTeamOwnedForClient =
    !isTeamView &&
    program === 'accelerator' &&
    !hasSubs &&
    ct.assigned_to !== null

  // Training / Doc / extra links only show on client tasks (assigned_to is
  // null). Team-owned tasks hide them in every view, including the team
  // dashboard, since the links are meant to guide the client, not the team.
  const hideLinks = ct.assigned_to !== null

  return (
    <div>
      <div
        className={cn(
          'group grid items-start gap-x-3 gap-y-2 md:gap-y-0 px-2 md:px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors',
          'grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_70px_160px_160px]',
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
        {/* Col 1 — status circle */}
        <div
          className="mt-0.5"
          onClick={(e) => !hasSubs && e.stopPropagation()}
        >
          {hasSubs ? (
            <StatusGlyph status={effective} />
          ) : isTeamOwnedForClient ? (
            <StatusGlyph status={ct.status} />
          ) : (
            <StatusPicker
              status={ct.status}
              isTeamView={isTeamView}
              onChange={(next) => onSetStatus(ct.id, next)}
            />
          )}
        </div>

        {/* Col 2 — title + description (wrap freely, no truncation) */}
        <div className="min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span
              className={cn(
                'text-sm break-words',
                effective === 'completed'
                  ? 'text-kst-muted line-through'
                  : 'text-kst-white',
                hasSubs && 'group-hover:text-kst-gold transition-colors'
              )}
            >
              {ct.task?.title ?? 'Untitled task'}
            </span>
            {hasSubs && (
              <span className="text-kst-muted text-xs shrink-0 mt-0.5">
                ({subsDone}/{subs.length})
              </span>
            )}
            {hasSubs && (
              <ChevronDown
                size={14}
                className={cn(
                  'text-kst-muted transition-transform ml-auto shrink-0 mt-1',
                  isParentExpanded && 'rotate-180'
                )}
              />
            )}
          </div>
          {ct.task?.description && (
            <p className="text-kst-muted text-xs mt-0.5 break-words">
              {ct.task.description}
            </p>
          )}
        </div>

        {/* Row 2 on mobile, cols 3/4/5 on md+ via display: contents */}
        <div className="col-span-2 flex items-center gap-3 flex-wrap md:contents">
          {/* Col 3 — due date (right-aligned).  NO overflow-hidden here,
              otherwise the date picker popover gets clipped when it opens. */}
          <div
            className="md:flex md:justify-end min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {!hasSubs && (
              <DueDateBadge
                dueDate={ct.due_date}
                completed={ct.status === 'completed'}
                readOnly={!isTeamView}
                onChange={(next) => onUpdateDueDate(ct.id, next)}
              />
            )}
          </div>

          {/* Col 4 — links (left-aligned) */}
          <div
            className="min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {!hasSubs && !hideLinks && (
              <TaskLinks task={ct.task} program={program} />
            )}
          </div>

          {/* Col 5 — assignee (right-aligned). NO overflow-hidden — the
              reassign dropdown needs to render outside this box. */}
          <div
            className="md:flex md:justify-end min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {!hasSubs &&
              (isTeamView ? (
                <AssigneePicker
                  assigneeId={ct.assigned_to}
                  teamMembers={teamMembers}
                  teamById={teamById}
                  clientContactName={clientContactName}
                  onChange={(next) => onReassign(ct.id, next)}
                />
              ) : isTeamOwnedForClient ? (
                <TeamAssigneeTag
                  assignee={
                    ct.assigned_to
                      ? teamById.get(ct.assigned_to) ?? null
                      : null
                  }
                />
              ) : null)}
          </div>
        </div>
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
                    program={program}
                    teamMembers={teamMembers}
                    teamById={teamById}
                    clientContactName={clientContactName}
                    onSetStatus={onSetStatus}
                    onReassign={onReassign}
                    onUpdateDueDate={onUpdateDueDate}
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
  program,
  teamMembers,
  teamById,
  clientContactName,
  onSetStatus,
  onReassign,
  onUpdateDueDate,
}: {
  ct: ClientTaskJoined
  isTeamView: boolean
  program: Program
  teamMembers: ChecklistTeamMember[]
  teamById: Map<string, ChecklistTeamMember>
  clientContactName: string | null
  onSetStatus: (id: string, next: TaskStatus) => void
  onReassign: (id: string, next: string | null) => void
  onUpdateDueDate: (id: string, next: string | null) => void
}) {
  const isTeamOwnedForClient =
    !isTeamView && program === 'accelerator' && ct.assigned_to !== null
  // Links only render on client tasks (null assignee), regardless of view.
  const hideLinks = ct.assigned_to !== null

  return (
    <div
      className={cn(
        'group grid items-start gap-x-3 gap-y-1.5 md:gap-y-0 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors',
        'grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_70px_160px_160px]'
      )}
    >
      {/* Col 1 — status */}
      <div className="mt-0.5">
        {isTeamOwnedForClient ? (
          <StatusGlyph status={ct.status} />
        ) : (
          <StatusPicker
            status={ct.status}
            isTeamView={isTeamView}
            onChange={(next) => onSetStatus(ct.id, next)}
          />
        )}
      </div>

      {/* Col 2 — title (wrap freely) */}
      <div className="min-w-0">
        <p
          className={cn(
            'text-sm break-words',
            ct.status === 'completed'
              ? 'text-kst-muted line-through'
              : 'text-kst-white'
          )}
        >
          {displaySubtaskTitle(ct.task?.title ?? '')}
        </p>
      </div>

      {/* Row 2 on mobile, cols 3/4/5 on md+ */}
      <div className="col-span-2 flex items-center gap-3 flex-wrap md:contents">
        {/* Col 3 — due */}
        <div className="md:flex md:justify-end min-w-0">
          <DueDateBadge
            dueDate={ct.due_date}
            completed={ct.status === 'completed'}
            readOnly={!isTeamView}
            onChange={(next) => onUpdateDueDate(ct.id, next)}
            compact
          />
        </div>

        {/* Col 4 — links */}
        <div className="min-w-0">
          {!hideLinks && <TaskLinks task={ct.task} program={program} small />}
        </div>

        {/* Col 5 — assignee */}
        <div className="md:flex md:justify-end min-w-0">
          {isTeamView ? (
            <AssigneePicker
              assigneeId={ct.assigned_to}
              teamMembers={teamMembers}
              teamById={teamById}
              clientContactName={clientContactName}
              onChange={(next) => onReassign(ct.id, next)}
              compact
            />
          ) : isTeamOwnedForClient ? (
            <TeamAssigneeTag
              assignee={
                ct.assigned_to ? teamById.get(ct.assigned_to) ?? null : null
              }
              compact
            />
          ) : null}
        </div>
      </div>
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

// ───────────────────────────────────────────────────────────────────────────
// Date helpers (local time, YYYY-MM-DD strings)
// ───────────────────────────────────────────────────────────────────────────

function parseLocalYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function diffDaysStart(a: Date, b: Date): number {
  const ax = new Date(a)
  ax.setHours(0, 0, 0, 0)
  const bx = new Date(b)
  bx.setHours(0, 0, 0, 0)
  return Math.round((ax.getTime() - bx.getTime()) / 86400000)
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function formatShortDate(d: Date): string {
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return sameYear
    ? `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
    : `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

// ───────────────────────────────────────────────────────────────────────────
// Timeline indicator ("Day X of 16")
// ───────────────────────────────────────────────────────────────────────────

function TimelineIndicator({ joinedDate }: { joinedDate: string }) {
  const start = parseLocalYmd(joinedDate)
  const now = startOfToday()
  const rawDay = diffDaysStart(now, start) + 1
  const dayNumber = Math.max(1, rawDay)
  const extended = dayNumber > TIMELINE_TOTAL_DAYS
  const pct = Math.min(100, (dayNumber / TIMELINE_TOTAL_DAYS) * 100)

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-kst-muted text-xs uppercase tracking-wider">
          Timeline
        </span>
        <span
          className={cn(
            'text-xs',
            extended ? 'text-kst-muted' : 'text-kst-white'
          )}
        >
          Day {dayNumber}
          {extended ? ' (extended)' : ` of ${TIMELINE_TOTAL_DAYS}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-kst-surface overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-kst-gold to-kst-gold-light transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Due date badge (read-only + click-to-edit for team view)
// ───────────────────────────────────────────────────────────────────────────

function DueDateBadge({
  dueDate,
  completed,
  readOnly,
  onChange,
  compact,
}: {
  dueDate: string | null
  completed: boolean
  readOnly: boolean
  onChange: (next: string | null) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [flipUp, setFlipUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Click-outside / Escape to close without saving. No onBlur on the
  // input itself — the native calendar widget was fighting the blur
  // handler and closing the popup mid-interaction.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
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

  // Flip the popup above the trigger when we're close to the bottom edge
  useEffect(() => {
    if (!open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setFlipUp(spaceBelow < 220)
  }, [open])

  function openEditor() {
    setDraft(dueDate ?? '')
    setOpen(true)
  }

  function save() {
    onChange(draft || null)
    setOpen(false)
  }

  // Build the trigger content (pill or "+ Due" button, or read-only span)
  const date = dueDate ? parseLocalYmd(dueDate) : null
  const diff = date ? diffDaysStart(date, startOfToday()) : null

  type State = 'completed' | 'overdue' | 'today' | 'tomorrow' | 'future'
  const state: State | null = date
    ? completed
      ? 'completed'
      : diff! < 0
        ? 'overdue'
        : diff! === 0
          ? 'today'
          : diff! === 1
            ? 'tomorrow'
            : 'future'
    : null

  const label =
    state === 'overdue'
      ? 'Overdue'
      : state === 'today'
        ? 'Due today'
        : date
          ? formatShortDate(date)
          : '+ Due'

  const baseCls = cn(
    'inline-flex items-center gap-1 rounded-full font-medium border shrink-0 transition-colors',
    compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
  )

  const stateCls: Record<State, string> = {
    completed: 'border-white/10 text-kst-muted',
    future: 'border-white/10 text-kst-muted',
    tomorrow: 'border-kst-gold/60 text-kst-gold bg-kst-gold/10',
    today:
      'border-kst-gold/80 text-kst-gold bg-kst-gold/15 font-semibold kst-pulse-gold',
    overdue: '',
  }

  // Softer, muted red for overdue rather than alarm-bright red
  const overdueStyle =
    state === 'overdue'
      ? {
          color: 'rgba(248, 113, 113, 0.85)',
          borderColor: 'rgba(248, 113, 113, 0.3)',
          background: 'rgba(248, 113, 113, 0.06)',
          fontSize: compact ? '9px' : '10px',
        }
      : undefined

  // Read-only path — nothing clickable, no popup
  if (readOnly) {
    if (!state) return null
    return (
      <span className={cn(baseCls, stateCls[state])} style={overdueStyle}>
        {state === 'overdue' && (
          <AlertCircle size={compact ? 10 : 11} className="shrink-0" />
        )}
        {label}
      </span>
    )
  }

  // Team view — render trigger (pill or dashed "+ Due" button) + popup
  const trigger = state ? (
    <button
      type="button"
      onClick={openEditor}
      className={cn(baseCls, stateCls[state], 'hover:brightness-110')}
      style={overdueStyle}
    >
      {state === 'overdue' && (
        <AlertCircle size={compact ? 10 : 11} className="shrink-0" />
      )}
      {label}
    </button>
  ) : (
    <button
      type="button"
      onClick={openEditor}
      className={cn(
        'rounded-full border border-dashed border-white/15 text-kst-muted hover:text-kst-white hover:border-white/30 transition-colors shrink-0',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      )}
    >
      + Due
    </button>
  )

  return (
    <div ref={ref} className="relative shrink-0">
      {trigger}
      {open && (
        <div
          className={cn(
            'absolute z-50 right-0 w-[240px] kst-dropdown p-3 kst-fade-in',
            flipUp ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          <p className="text-[10px] uppercase tracking-wider text-kst-muted mb-2">
            Due Date
          </p>
          <input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-kst-dark border border-white/10 text-kst-white text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors"
          />
          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-kst-muted hover:text-kst-white transition-colors"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              {dueDate && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft('')
                  }}
                  className="text-xs text-kst-muted hover:text-kst-error transition-colors"
                  title="Clear date"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={save}
                className="px-3 h-8 rounded-full bg-kst-gold text-kst-black font-semibold text-xs hover:bg-kst-gold-light transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Team assignee tag (client view, read-only)
// ───────────────────────────────────────────────────────────────────────────

function TeamAssigneeTag({
  assignee,
  compact,
}: {
  assignee: ChecklistTeamMember | null
  compact?: boolean
}) {
  const first =
    (assignee?.full_name ?? '').trim().split(/\s+/)[0] ?? 'KST Team'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium border border-white/15 text-kst-muted shrink-0',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      )}
    >
      {assignee ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-kst-gold/70" />
          {first}
        </>
      ) : (
        'KST Team'
      )}
    </span>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Assignee picker (dropdown grouped by specialty)
// ───────────────────────────────────────────────────────────────────────────

function initialsOf(name: string | null): string {
  const t = (name ?? '').trim()
  if (!t) return '?'
  const parts = t.split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

const SPECIALTY_GROUP_ORDER: (Specialty | 'none')[] = [
  'ads',
  'systems',
  'organic',
  'sales',
  'none',
]

function AssigneePicker({
  assigneeId,
  teamMembers,
  teamById,
  clientContactName,
  onChange,
  compact,
}: {
  assigneeId: string | null
  teamMembers: ChecklistTeamMember[]
  teamById: Map<string, ChecklistTeamMember>
  clientContactName: string | null
  onChange: (next: string | null) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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

  useEffect(() => {
    if (!open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setFlipUp(spaceBelow < 260)
  }, [open])

  const assignee = assigneeId ? teamById.get(assigneeId) ?? null : null

  // Group members by specialty
  const grouped = useMemo(() => {
    const m = new Map<Specialty | 'none', ChecklistTeamMember[]>()
    for (const t of teamMembers) {
      const key = (t.specialty ?? 'none') as Specialty | 'none'
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(t)
    }
    return SPECIALTY_GROUP_ORDER.map(
      (k) => [k, m.get(k) ?? []] as const
    ).filter(([, arr]) => arr.length > 0)
  }, [teamMembers])

  const sizeCls = compact
    ? 'h-7 w-7 text-[10px]'
    : 'h-8 w-8 text-[10px]'

  const assigneeFirstName =
    (assignee?.full_name ?? '').trim().split(/\s+/)[0] ?? ''

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        aria-label="Assign task"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {assignee ? (
          <>
            <div
              className={cn(
                'rounded-full border border-kst-gold/60 text-kst-gold flex items-center justify-center bg-white/[0.02] font-semibold shrink-0',
                sizeCls
              )}
              title={assignee.full_name ?? 'Unnamed'}
            >
              {initialsOf(assignee.full_name)}
            </div>
            <span className="hidden sm:inline text-[11px] text-kst-white whitespace-nowrap max-w-[8rem] truncate">
              {assigneeFirstName || 'Unnamed'}
            </span>
            {assignee.specialty && (
              <span className="hidden md:inline">
                <SpecialtyBadge specialty={assignee.specialty} />
              </span>
            )}
          </>
        ) : clientContactName ? (
          <span className="text-[11px] text-kst-muted px-1 truncate max-w-[8rem]">
            {clientContactName}
          </span>
        ) : (
          <span className="text-[11px] text-kst-muted italic px-1">
            Unassigned
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 right-0 min-w-[220px] max-h-[280px] overflow-y-auto kst-dropdown p-1 kst-fade-in',
            flipUp ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            className={cn(
              'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-white/[0.06] transition-colors',
              assigneeId === null && 'bg-kst-gold/10'
            )}
          >
            <span className="text-kst-muted italic">
              {clientContactName
                ? `Client (${clientContactName})`
                : 'Unassigned'}
            </span>
            {assigneeId === null && <Check size={13} className="text-kst-gold" />}
          </button>
          {grouped.map(([groupKey, members]) => (
            <div key={groupKey}>
              <p className="text-[9px] uppercase tracking-wider text-kst-muted/70 px-3 pt-2 pb-1">
                {groupKey === 'none' ? 'Other' : SPECIALTY_LABELS[groupKey]}
              </p>
              {members.map((m) => {
                const active = m.id === assigneeId
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onChange(m.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-white/[0.06] transition-colors',
                      active && 'bg-kst-gold/10'
                    )}
                  >
                    <div className="w-7 h-7 rounded-full border border-kst-gold/60 text-kst-gold flex items-center justify-center text-[10px] font-semibold bg-white/[0.02] shrink-0">
                      {initialsOf(m.full_name)}
                    </div>
                    <span
                      className={cn(
                        'flex-1 truncate',
                        active ? 'text-kst-white' : 'text-kst-muted'
                      )}
                    >
                      {m.full_name ?? 'Unnamed'}
                    </span>
                    {active && (
                      <Check size={13} className="text-kst-gold shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
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

function matchesProgramTag(key: string, program: Program): boolean {
  const hasEi = /\(\s*EI\s*\)/i.test(key)
  const hasAcc = /\(\s*ACC\s*\)/i.test(key)
  if (hasEi && program !== 'educator_incubator') return false
  if (hasAcc && program !== 'accelerator') return false
  return true
}

function stripProgramTag(key: string): string {
  return key
    .replace(/\s*\(\s*(?:EI|ACC)\s*\)\s*/gi, '')
    .replace(/_+$/g, '')
    .replace(/\s+$/g, '')
    .trim()
}

function TaskLinks({
  task,
  small = false,
  program,
}: {
  task: TaskRow | null
  small?: boolean
  program: Program
}) {
  if (!task) return null

  const validExtras = task.extra_links
    ? Object.entries(task.extra_links)
        .filter(([key, url]) => hasUrl(url) && matchesProgramTag(key, program))
        .map(
          ([key, url]) => [stripProgramTag(key) || key, url] as [string, string]
        )
    : []

  const hasTraining = hasUrl(task.training_url)
  // Hide the Doc button for Accelerator clients when the task is flagged
  // to hide docs (training links still show regardless).
  const hideDocForAccelerator =
    program === 'accelerator' && task.accelerator_hide_docs === true
  const hasDoc = hasUrl(task.doc_url) && !hideDocForAccelerator

  if (!hasTraining && !hasDoc && validExtras.length === 0) return null

  const sizeCls = small ? 'text-[10px] px-2 py-1' : 'text-xs px-2.5 py-1'

  // Label the training button "Watch Loom" for Loom URLs, "Training"
  // otherwise.
  const trainingLabel =
    task.training_url && /loom\.com/i.test(task.training_url)
      ? 'Watch Loom'
      : 'Training'

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-start">
      {hasTraining && (
        <LinkButton href={task.training_url!} className={sizeCls}>
          <PlayCircle size={small ? 11 : 12} />
          {trainingLabel}
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
