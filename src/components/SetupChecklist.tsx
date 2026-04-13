'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TaskCommentsModal } from '@/components/TaskCommentsModal'
import { cn } from '@/lib/utils'

import {
  type TaskStatus,
  type StageRow,
  type TaskRow,
  type ClientTaskJoined,
  type OrganizedStage,
  type PendingLaunch,
  LAUNCH_TASK_TITLE,
  effectiveParentStatus,
} from './checklist/types'
import { TopLevelTask } from './checklist/TaskRow'
import { LaunchConfirmModal } from './checklist/LaunchGate'
import { TimelineIndicator } from './checklist/TimelineIndicator'
import { ChecklistSkeleton } from './checklist/ChecklistSkeleton'

// Re-export types used by other files
export type { TaskStatus } from './checklist/types'
export type { ChecklistTeamMember } from './checklist/types'

// Re-import for local use
import type { ChecklistTeamMember, SetupChecklistProps } from './checklist/types'

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

  // Realtime: sync task changes from other users
  useEffect(() => {
    const channel = supabase
      .channel(`tasks-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'client_tasks',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const updated = payload.new as {
            id: string
            status: string
            completed_at: string | null
            assigned_to: string | null
            due_date: string | null
          }
          setRows((prev) =>
            prev.map((r) =>
              r.id === updated.id
                ? {
                    ...r,
                    status: updated.status as TaskStatus,
                    completed_at: updated.completed_at,
                    assigned_to: updated.assigned_to,
                    due_date: updated.due_date,
                  }
                : r
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, clientId])

  // Comment counts
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map())
  const [commentsModal, setCommentsModal] = useState<{ clientTaskId: string; taskTitle: string } | null>(null)

  useEffect(() => {
    if (rows.length === 0) return
    const ids = rows.map((r) => r.id)
    supabase
      .from('task_comments')
      .select('client_task_id')
      .in('client_task_id', ids)
      .then(({ data }) => {
        const counts = new Map<string, number>()
        for (const r of (data ?? []) as { client_task_id: string }[]) {
          counts.set(r.client_task_id, (counts.get(r.client_task_id) ?? 0) + 1)
        }
        setCommentCounts(counts)
      })
  }, [supabase, rows.length])

  // Realtime comment count updates
  useEffect(() => {
    const channel = supabase
      .channel(`comment-counts-${clientId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_comments' },
        (payload) => {
          const taskId = (payload.new as { client_task_id: string }).client_task_id
          setCommentCounts((prev) => {
            const next = new Map(prev)
            next.set(taskId, (next.get(taskId) ?? 0) + 1)
            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, clientId])

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

  // Silent launch revert
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

  // Status mutation
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
            console.warn('[checklist] activity_log insert failed:', logError.message)
          }
        })

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

      if (isLaunchTask) {
        if (next === 'completed' && !isLaunched) {
          setPendingLaunch({ clientTaskId, prevStatus, prevCompletedAt })
        } else if (
          prevStatus === 'completed' &&
          next !== 'completed' &&
          isLaunched
        ) {
          await revertLaunchOnClient()
        }
      }
    },
    [rows, supabase, currentUserId, clientId, isLaunched, revertLaunchOnClient]
  )

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
            r.id === clientTaskId ? { ...r, assigned_to: prevAssignee } : r
          )
        )
        setToast(`Couldn't reassign task: ${error.message}`)
      }
    },
    [rows, supabase]
  )

  const teamById = useMemo(() => {
    const m = new Map<string, ChecklistTeamMember>()
    for (const t of teamMembers) m.set(t.id, t)
    return m
  }, [teamMembers])

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

  // Emit Stage 1 + 2 progress
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

      {joinedDate && <TimelineIndicator joinedDate={joinedDate} />}

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
                      commentCounts={commentCounts}
                      onOpenComments={(id, title) => setCommentsModal({ clientTaskId: id, taskTitle: title })}
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

      {commentsModal && (
        <TaskCommentsModal
          open={!!commentsModal}
          onClose={() => setCommentsModal(null)}
          clientTaskId={commentsModal.clientTaskId}
          taskTitle={commentsModal.taskTitle}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}
