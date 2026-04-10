import 'server-only'
import { createClient } from '@/lib/supabase/server'

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Lightweight server helper that computes the My Tasks badge counts
 * for a given user. Runs in the layout so it refreshes on every
 * navigation.
 */
export async function getMyTaskCounts(
  userId: string
): Promise<{ overdue: number; total: number }> {
  const supabase = await createClient()
  const today = todayIso()

  const { data: rawTasks } = await supabase
    .from('client_tasks')
    .select(
      `
      id, client_id, status, due_date, assigned_to,
      task:tasks ( id, parent_task_id, has_subtasks, order_index,
        stage:stages ( id, order_index )
      ),
      client:clients ( id, client_team, assigned_csm, is_imported )
      `
    )
    .neq('status', 'completed')
    .not('due_date', 'is', null)

  interface Norm {
    id: string
    clientId: string
    stageId: string
    stageOrder: number
    taskOrder: number
    assignedTo: string | null
    csmId: string | null
    dueDate: string | null
    isImported: boolean
  }

  const norms: Norm[] = []
  for (const r of (rawTasks ?? []) as unknown[]) {
    const obj = r as Record<string, unknown>
    const task = Array.isArray(obj.task) ? obj.task[0] : obj.task
    if (!task) continue
    const taskObj = task as Record<string, unknown>
    if (taskObj.parent_task_id) continue
    if (taskObj.has_subtasks) continue
    const stage = Array.isArray(taskObj.stage) ? taskObj.stage[0] : taskObj.stage
    const stageObj = (stage ?? {}) as Record<string, unknown>
    const client = Array.isArray(obj.client) ? obj.client[0] : obj.client
    const clientObj = (client ?? {}) as Record<string, unknown>
    const clientTeam = (clientObj.client_team ?? {}) as Record<string, string | null>
    const csmId = clientTeam?.csm ?? (clientObj.assigned_csm as string | null) ?? null

    norms.push({
      id: obj.id as string,
      clientId: obj.client_id as string,
      stageId: (stageObj.id as string) ?? 'unknown',
      stageOrder: (stageObj.order_index as number) ?? 0,
      taskOrder: (taskObj.order_index as number) ?? 0,
      assignedTo: (obj.assigned_to as string | null) ?? null,
      csmId,
      dueDate: (obj.due_date as string | null) ?? null,
      isImported: (clientObj.is_imported as boolean) ?? false,
    })
  }

  // Group by client+stage, find first incomplete per stage
  const byClientStage = new Map<string, Norm[]>()
  for (const t of norms) {
    const key = `${t.clientId}|${t.stageId}`
    if (!byClientStage.has(key)) byClientStage.set(key, [])
    byClientStage.get(key)!.push(t)
  }

  let overdue = 0
  let total = 0

  for (const [, tasks] of byClientStage) {
    tasks.sort((a, b) => a.taskOrder - b.taskOrder)
    const first = tasks[0]!
    const ownerId = first.assignedTo ?? first.csmId
    if (ownerId !== userId) continue
    total++
    if (!first.isImported && first.dueDate && first.dueDate < today) overdue++
  }

  return { overdue, total }
}
