import { requireTeamMember } from '@/lib/auth/require-team'
import { createClient } from '@/lib/supabase/server'
import { MyTasksView, type ActionableTask, type TeamMemberGroup } from '@/components/my-tasks/my-tasks-view'

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default async function MyTasksPage() {
  const { user, profile } = await requireTeamMember()
  const supabase = await createClient()
  const today = todayIso()

  // Fetch all incomplete client_tasks with task + stage + client data
  const { data: rawTasks } = await supabase
    .from('client_tasks')
    .select(
      `
      id, client_id, status, due_date, assigned_to,
      task:tasks (
        id, parent_task_id, has_subtasks, title, order_index,
        stage:stages ( id, name, order_index )
      ),
      client:clients ( id, company_name, program, client_team, assigned_csm, is_imported )
      `
    )
    .neq('status', 'completed')
    .not('due_date', 'is', null)

  // Fetch action items (incomplete, with due dates)
  const { data: actionItemsData } = await supabase
    .from('action_items')
    .select('id, title, assigned_to, due_date, status, client_id, client:clients ( company_name, program, is_imported )')
    .neq('status', 'completed')
    .not('due_date', 'is', null)

  // Fetch all team profiles for admin "All Team" view
  const { data: teamProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, specialty')
    .in('role', ['admin', 'csm'])
    .order('full_name')

  // Normalize the raw data
  interface NormTask {
    id: string
    clientId: string
    companyName: string
    program: string | null
    clientCsmId: string | null
    isImported: boolean
    assignedTo: string | null
    status: string
    dueDate: string | null
    taskTitle: string
    hasSubtasks: boolean
    parentTaskId: string | null
    taskOrder: number
    stageId: string
    stageName: string
    stageOrder: number
  }

  const normTasks: NormTask[] = []
  for (const r of (rawTasks ?? []) as unknown[]) {
    const obj = r as Record<string, unknown>
    const task = Array.isArray(obj.task) ? obj.task[0] : obj.task
    if (!task) continue
    const taskObj = task as Record<string, unknown>
    const stage = Array.isArray(taskObj.stage) ? taskObj.stage[0] : taskObj.stage
    const stageObj = (stage ?? {}) as Record<string, unknown>
    const client = Array.isArray(obj.client) ? obj.client[0] : obj.client
    const clientObj = (client ?? {}) as Record<string, unknown>

    // Skip subtasks — only top-level tasks
    if (taskObj.parent_task_id) continue
    // Skip parent tasks that have subtasks
    if (taskObj.has_subtasks) continue

    const clientTeam = (clientObj.client_team ?? {}) as Record<string, string | null>
    const csmId = clientTeam?.csm ?? (clientObj.assigned_csm as string | null) ?? null

    normTasks.push({
      id: obj.id as string,
      clientId: obj.client_id as string,
      companyName: (clientObj.company_name as string) ?? 'Unknown',
      program: (clientObj.program as string | null) ?? null,
      clientCsmId: csmId,
      isImported: (clientObj.is_imported as boolean) ?? false,
      assignedTo: (obj.assigned_to as string | null) ?? null,
      status: (obj.status as string) ?? '',
      dueDate: (obj.due_date as string | null) ?? null,
      taskTitle: (taskObj.title as string) ?? 'Untitled',
      hasSubtasks: (taskObj.has_subtasks as boolean) ?? false,
      parentTaskId: (taskObj.parent_task_id as string | null) ?? null,
      taskOrder: (taskObj.order_index as number) ?? 0,
      stageId: (stageObj.id as string) ?? 'unknown',
      stageName: (stageObj.name as string) ?? '—',
      stageOrder: (stageObj.order_index as number) ?? 0,
    })
  }

  // Group by client, find single first incomplete task per client
  const byClient = new Map<string, NormTask[]>()
  for (const t of normTasks) {
    if (!byClient.has(t.clientId)) byClient.set(t.clientId, [])
    byClient.get(t.clientId)!.push(t)
  }

  const allActionable: ActionableTask[] = []
  const allUpcoming: ActionableTask[] = []

  function toActionable(t: NormTask): ActionableTask {
    const ownerId = t.assignedTo ?? t.clientCsmId
    const isOverdue = !t.isImported && t.dueDate != null && t.dueDate < today
    let overdueDays = 0
    if (isOverdue && t.dueDate) {
      const due = new Date(t.dueDate + 'T00:00:00')
      const now = new Date(today + 'T00:00:00')
      overdueDays = Math.round((now.getTime() - due.getTime()) / 86400000)
    }
    return {
      id: t.id,
      clientId: t.clientId,
      companyName: t.companyName,
      program: t.program,
      taskTitle: t.taskTitle,
      stageName: t.stageName,
      stageOrder: t.stageOrder,
      dueDate: t.dueDate,
      isOverdue,
      overdueDays,
      assignedTo: t.assignedTo,
      ownerId: ownerId ?? null,
      isClientTask: t.assignedTo === null,
      isImported: t.isImported,
    }
  }

  for (const [, clientTasks] of byClient) {
    clientTasks.sort(
      (a, b) =>
        (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
        a.stageOrder - b.stageOrder ||
        a.taskOrder - b.taskOrder
    )

    if (clientTasks[0]) allActionable.push(toActionable(clientTasks[0]))
    if (clientTasks[1]) allUpcoming.push(toActionable(clientTasks[1]))
  }

  // Add action items as actionable tasks
  for (const r of (actionItemsData ?? []) as unknown[]) {
    const obj = r as Record<string, unknown>
    const client = Array.isArray(obj.client) ? obj.client[0] : obj.client
    const clientObj = (client ?? {}) as Record<string, unknown>
    const dueDate = (obj.due_date as string | null) ?? null
    const isImported = (clientObj.is_imported as boolean) ?? false
    const isOverdue = !isImported && dueDate != null && dueDate < today
    let overdueDays = 0
    if (isOverdue && dueDate) {
      const due = new Date(dueDate + 'T00:00:00')
      const now = new Date(today + 'T00:00:00')
      overdueDays = Math.round((now.getTime() - due.getTime()) / 86400000)
    }
    allActionable.push({
      id: obj.id as string,
      clientId: obj.client_id as string,
      companyName: (clientObj.company_name as string) ?? 'Unknown',
      program: (clientObj.program as string | null) ?? null,
      taskTitle: (obj.title as string) ?? 'Action item',
      stageName: 'Action Item',
      stageOrder: 999,
      dueDate,
      isOverdue,
      overdueDays,
      assignedTo: (obj.assigned_to as string | null) ?? null,
      ownerId: (obj.assigned_to as string | null) ?? null,
      isClientTask: false,
      isImported,
      isActionItem: true,
    })
  }

  // Build team member map for admin "All Team" view
  const profileMap = new Map<string, { fullName: string; specialty: string | null }>()
  for (const p of (teamProfiles ?? []) as Array<{
    id: string
    full_name: string | null
    specialty: string | null
  }>) {
    profileMap.set(p.id, { fullName: p.full_name ?? 'Unknown', specialty: p.specialty })
  }

  // Current user's tasks
  const myTasks = allActionable.filter((t) => t.ownerId === user.id)
  const myUpcoming = allUpcoming.filter((t) => t.ownerId === user.id)

  // All team grouped by member (for admin)
  const teamGrouped: TeamMemberGroup[] = []
  if (profile!.role === 'admin') {
    const byOwner = new Map<string, { tasks: ActionableTask[]; upcoming: ActionableTask[] }>()
    for (const t of allActionable) {
      if (!t.ownerId) continue
      if (!byOwner.has(t.ownerId)) byOwner.set(t.ownerId, { tasks: [], upcoming: [] })
      byOwner.get(t.ownerId)!.tasks.push(t)
    }
    for (const t of allUpcoming) {
      if (!t.ownerId) continue
      if (!byOwner.has(t.ownerId)) byOwner.set(t.ownerId, { tasks: [], upcoming: [] })
      byOwner.get(t.ownerId)!.upcoming.push(t)
    }
    for (const [ownerId, { tasks, upcoming }] of byOwner) {
      const p = profileMap.get(ownerId)
      teamGrouped.push({
        userId: ownerId,
        fullName: p?.fullName ?? 'Unknown',
        specialty: p?.specialty ?? null,
        tasks,
        upcoming,
      })
    }
    teamGrouped.sort((a, b) => a.fullName.localeCompare(b.fullName))
  }

  // Count for sidebar badge
  const myOverdueCount = myTasks.filter((t) => t.isOverdue).length
  const myTotalCount = myTasks.length

  return (
    <MyTasksView
      myTasks={myTasks}
      myUpcoming={myUpcoming}
      teamGroups={teamGrouped}
      isAdmin={profile!.role === 'admin'}
      overdueCount={myOverdueCount}
      totalCount={myTotalCount}
    />
  )
}
