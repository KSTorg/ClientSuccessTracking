import { requireTeamMember } from '@/lib/auth/require-team'
import { createClient } from '@/lib/supabase/server'
import { ClientsView } from '@/components/clients/clients-view'
import type {
  Client,
  ClientWithCsmAndStats,
  CsmOption,
} from '@/lib/types'

export default async function ClientsPage() {
  await requireTeamMember()
  const supabase = await createClient()

  // Plain select on clients (no PostgREST embed). The previous version used
  // `csm:profiles!assigned_csm(id, full_name)` which silently returned an
  // empty list whenever PostgREST couldn't resolve the FK hint. We now join
  // CSM names client-side using the separate csms query below.
  const [clientsRes, tasksRes, csmsRes, subsRes] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.from('client_tasks').select('client_id, status'),
    supabase
      .from('profiles')
      .select('id, full_name, specialty')
      .in('role', ['admin', 'csm'])
      .order('full_name'),
    supabase
      .from('client_subscriptions')
      .select('client_id, end_date')
      .eq('status', 'active'),
  ])

  const clients = (clientsRes.data ?? []) as Client[]
  const tasks = (tasksRes.data ?? []) as {
    client_id: string
    status: string
  }[]
  const csms = (csmsRes.data ?? []) as CsmOption[]

  // CSM lookup by id (for joining client.assigned_csm → name)
  const csmById = new Map(csms.map((c) => [c.id, c]))

  const stats = new Map<string, { total: number; completed: number }>()
  for (const t of tasks) {
    const s = stats.get(t.client_id) ?? { total: 0, completed: 0 }
    s.total += 1
    if (t.status === 'completed') s.completed += 1
    stats.set(t.client_id, s)
  }

  const clientsWithStats: ClientWithCsmAndStats[] = clients.map((c) => {
    const s = stats.get(c.id) ?? { total: 0, completed: 0 }
    // Prefer the new client_team.csm; fall back to the legacy assigned_csm
    const csmId = c.client_team?.csm ?? c.assigned_csm ?? null
    const csm = csmId ? csmById.get(csmId) ?? null : null
    return {
      ...c,
      csm,
      task_total: s.total,
      task_completed: s.completed,
    }
  })

  // Build subscription info per client: has active subs + max end_date
  const subRows = (subsRes.data ?? []) as { client_id: string; end_date: string | null }[]
  const clientSubInfo = new Map<string, { hasActiveSubs: boolean; maxEndDate: string | null; hasOngoing: boolean }>()
  for (const r of subRows) {
    const info = clientSubInfo.get(r.client_id) ?? { hasActiveSubs: false, maxEndDate: null, hasOngoing: false }
    info.hasActiveSubs = true
    if (r.end_date == null) {
      info.hasOngoing = true
    } else if (!info.maxEndDate || r.end_date > info.maxEndDate) {
      info.maxEndDate = r.end_date
    }
    clientSubInfo.set(r.client_id, info)
  }

  // Serialize for client component
  const subInfoSerialized: Record<string, { hasActiveSubs: boolean; maxEndDate: string | null; hasOngoing: boolean }> = {}
  for (const [id, info] of clientSubInfo) {
    subInfoSerialized[id] = info
  }

  return <ClientsView clients={clientsWithStats} csms={csms} clientSubInfo={subInfoSerialized} />
}
