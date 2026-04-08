import { requireTeamMember } from '@/lib/auth/require-team'
import { createClient } from '@/lib/supabase/server'
import { ClientsView } from '@/components/clients/clients-view'
import type {
  ClientWithCsm,
  ClientWithCsmAndStats,
  CsmOption,
} from '@/lib/types'

export default async function ClientsPage() {
  await requireTeamMember()
  const supabase = await createClient()

  const [clientsRes, tasksRes, csmsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('*, csm:profiles!assigned_csm(id, full_name)')
      .order('created_at', { ascending: false }),
    supabase.from('client_tasks').select('client_id, status'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin', 'csm'])
      .order('full_name'),
  ])

  const clients = (clientsRes.data ?? []) as ClientWithCsm[]
  const tasks = (tasksRes.data ?? []) as {
    client_id: string
    status: string
  }[]
  const csms = (csmsRes.data ?? []) as CsmOption[]

  const stats = new Map<string, { total: number; completed: number }>()
  for (const t of tasks) {
    const s = stats.get(t.client_id) ?? { total: 0, completed: 0 }
    s.total += 1
    if (t.status === 'completed') s.completed += 1
    stats.set(t.client_id, s)
  }

  const clientsWithStats: ClientWithCsmAndStats[] = clients.map((c) => {
    const s = stats.get(c.id) ?? { total: 0, completed: 0 }
    return { ...c, task_total: s.total, task_completed: s.completed }
  })

  return <ClientsView clients={clientsWithStats} csms={csms} />
}
