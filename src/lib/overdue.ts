import type { SupabaseClient } from '@supabase/supabase-js'

export interface Blocker {
  taskTitle: string
  dueDate: string | null
  assignedTo: string | null
  assignedName: string | null
  discordId: string | null
  csmId: string | null
  csmDiscordId: string | null
  stageName: string
}

export interface ClientBlockers {
  clientId: string
  companyName: string
  program: string | null
  blockers: Blocker[]
}

export interface BlockersResult {
  blockers: ClientBlockers[]
  totalClients: number
}

function todayLocalIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Walk every client's incomplete-and-overdue tasks and return the "first
 * actionable blocker" per stage. Later overdue tasks within the same
 * stage are ignored because they can't be started until the earlier one
 * is unblocked. Tasks with the same due_date within a stage are treated
 * as parallel blockers and all reported. Parent tasks (has_subtasks=true)
 * are skipped — we only report leaf work items.
 *
 * Pass `clientId` to scope the computation to a single client (used by
 * the real-time task-completed notification).
 */
export async function getClientBlockers(
  supabaseAdmin: SupabaseClient,
  options: { clientId?: string } = {}
): Promise<BlockersResult> {
  const today = todayLocalIso()

  // Fetch clients (all or one)
  let clientQuery = supabaseAdmin
    .from('clients')
    .select('id, company_name, program, client_team, assigned_csm')
  if (options.clientId) {
    clientQuery = clientQuery.eq('id', options.clientId)
  }
  const { data: clients, error: clientsErr } = await clientQuery
  if (clientsErr) {
    console.error('[overdue] clients fetch failed:', clientsErr)
    return { blockers: [], totalClients: 0 }
  }

  const clientRows = (clients ?? []) as Array<{
    id: string
    company_name: string
    program: string | null
    client_team: Record<string, string | null> | null
    assigned_csm: string | null
  }>

  // Fetch overdue incomplete tasks for those clients
  let taskQuery = supabaseAdmin
    .from('client_tasks')
    .select(
      `
      id, client_id, status, due_date, assigned_to,
      task:tasks (
        id, title, has_subtasks,
        stage:stages ( id, name, order_index )
      )
      `
    )
    .neq('status', 'completed')
    .not('due_date', 'is', null)
    .lt('due_date', today)
  if (options.clientId) {
    taskQuery = taskQuery.eq('client_id', options.clientId)
  }
  const { data: tasks, error: tasksErr } = await taskQuery
  if (tasksErr) {
    console.error('[overdue] tasks fetch failed:', tasksErr)
    return { blockers: [], totalClients: clientRows.length }
  }

  // Normalize nested embeds (supabase-js types them as arrays)
  type NormTask = {
    id: string
    client_id: string
    due_date: string | null
    assigned_to: string | null
    task_title: string
    has_subtasks: boolean
    stage_id: string
    stage_name: string
    stage_order: number
  }
  const normTasks: NormTask[] = []
  for (const r of (tasks ?? []) as unknown[]) {
    const obj = r as Record<string, unknown>
    const task = Array.isArray(obj.task) ? obj.task[0] : obj.task
    if (!task) continue
    const taskObj = task as Record<string, unknown>
    const stage = Array.isArray(taskObj.stage)
      ? taskObj.stage[0]
      : taskObj.stage
    const stageObj = (stage ?? {}) as Record<string, unknown>
    if ((taskObj.has_subtasks as boolean) === true) continue
    normTasks.push({
      id: obj.id as string,
      client_id: obj.client_id as string,
      due_date: (obj.due_date as string | null) ?? null,
      assigned_to: (obj.assigned_to as string | null) ?? null,
      task_title: (taskObj.title as string) ?? 'Untitled task',
      has_subtasks: (taskObj.has_subtasks as boolean) ?? false,
      stage_id: (stageObj.id as string) ?? 'unknown',
      stage_name: (stageObj.name as string) ?? '—',
      stage_order: (stageObj.order_index as number) ?? 0,
    })
  }

  // Collect profile IDs to resolve in one batch (assignees + CSMs)
  const profileIds = new Set<string>()
  for (const t of normTasks) {
    if (t.assigned_to) profileIds.add(t.assigned_to)
  }
  for (const c of clientRows) {
    const teamCsm = c.client_team?.csm
    if (teamCsm) profileIds.add(teamCsm)
    if (c.assigned_csm) profileIds.add(c.assigned_csm)
  }

  const profileMap = new Map<
    string,
    { id: string; full_name: string | null; discord_id: string | null }
  >()
  if (profileIds.size > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, discord_id')
      .in('id', [...profileIds])
    for (const p of (profiles ?? []) as Array<{
      id: string
      full_name: string | null
      discord_id: string | null
    }>) {
      profileMap.set(p.id, p)
    }
  }

  // Group tasks by client
  const tasksByClient = new Map<string, NormTask[]>()
  for (const t of normTasks) {
    if (!tasksByClient.has(t.client_id)) tasksByClient.set(t.client_id, [])
    tasksByClient.get(t.client_id)!.push(t)
  }

  const result: ClientBlockers[] = []

  for (const client of clientRows) {
    const clientTasks = tasksByClient.get(client.id) ?? []
    if (clientTasks.length === 0) continue

    const csmId =
      (client.client_team?.csm as string | null) ??
      client.assigned_csm ??
      null
    const csmProfile = csmId ? profileMap.get(csmId) ?? null : null

    // Group by stage
    const byStage = new Map<string, NormTask[]>()
    for (const t of clientTasks) {
      if (!byStage.has(t.stage_id)) byStage.set(t.stage_id, [])
      byStage.get(t.stage_id)!.push(t)
    }

    const blockers: Blocker[] = []

    // Sort stages by order_index so the message reads in program order
    const orderedStages = Array.from(byStage.entries()).sort((a, b) => {
      const oa = a[1][0]?.stage_order ?? 0
      const ob = b[1][0]?.stage_order ?? 0
      return oa - ob
    })

    for (const [, stageTasks] of orderedStages) {
      // Sort by due_date ascending within the stage
      stageTasks.sort(
        (a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')
      )
      const earliestDueDate = stageTasks[0]!.due_date
      const parallelBlockers = stageTasks.filter(
        (t) => t.due_date === earliestDueDate
      )

      for (const b of parallelBlockers) {
        const assignee = b.assigned_to
          ? profileMap.get(b.assigned_to) ?? null
          : null
        blockers.push({
          taskTitle: b.task_title,
          dueDate: b.due_date,
          assignedTo: b.assigned_to,
          assignedName: assignee?.full_name ?? null,
          discordId: assignee?.discord_id ?? null,
          csmId,
          csmDiscordId: csmProfile?.discord_id ?? null,
          stageName: b.stage_name,
        })
      }
    }

    if (blockers.length > 0) {
      result.push({
        clientId: client.id,
        companyName: client.company_name,
        program: client.program,
        blockers,
      })
    }
  }

  return {
    blockers: result,
    totalClients: clientRows.length,
  }
}

// ─── Small format helpers for the message builders ─────────────────────────

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

export function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return '—'
  return `${MONTH_SHORT[m - 1]} ${d}`
}

export function formatTodayLong(): string {
  const d = new Date()
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatProgramLabel(program: string | null): string {
  if (program === 'accelerator') return 'Accelerator'
  if (program === 'educator_incubator') return 'Educator Incubator'
  return program ?? '—'
}

export function mentionFor(
  discordId: string | null | undefined,
  fallback: string
): string {
  return discordId ? `<@${discordId}>` : fallback
}
