import Link from 'next/link'
import { Users, UserPlus, Rocket, TrendingUp } from 'lucide-react'
import { requireTeamMember } from '@/lib/auth/require-team'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/clients/status-badge'
import { formatDate } from '@/lib/utils'
import type { ClientStatus } from '@/lib/types'

interface RecentClient {
  id: string
  company_name: string
  contact_name: string
  status: ClientStatus
  joined_date: string | null
  created_at: string
}

export default async function DashboardPage() {
  const { profile } = await requireTeamMember()
  const supabase = await createClient()

  const [
    totalRes,
    onboardingRes,
    launchedRes,
    tasksRes,
    recentRes,
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'onboarding'),
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'launched'),
    supabase.from('client_tasks').select('status'),
    supabase
      .from('clients')
      .select('id, company_name, contact_name, status, joined_date, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const totalClients = totalRes.count ?? 0
  const onboardingCount = onboardingRes.count ?? 0
  const launchedCount = launchedRes.count ?? 0

  const allTasks = (tasksRes.data ?? []) as { status: string }[]
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter((t) => t.status === 'completed').length
  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const recent = (recentRes.data ?? []) as RecentClient[]
  const name = profile?.full_name ?? 'there'

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1
          className="text-5xl md:text-6xl text-kst-gold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Dashboard
        </h1>
        <p className="mt-3 text-kst-muted">Welcome back, {name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          icon={<Users size={20} />}
          label="Total Clients"
          value={totalClients}
        />
        <StatCard
          icon={<UserPlus size={20} />}
          label="Onboarding"
          value={onboardingCount}
        />
        <StatCard
          icon={<Rocket size={20} />}
          label="Launched"
          value={launchedCount}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Completion Rate"
          value={`${completionRate}%`}
        />
      </div>

      {/* Recent clients */}
      <div className="glass-panel p-6 md:p-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-kst-white text-xl font-semibold">
            Recent Clients
          </h2>
          <Link
            href="/clients"
            className="text-xs text-kst-muted hover:text-kst-gold transition-colors"
          >
            View all →
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="text-kst-muted text-sm py-8 text-center">
            No clients yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {recent.map((client) => (
              <li key={client.id}>
                <Link
                  href={`/clients/${client.id}`}
                  className="grid grid-cols-12 gap-3 items-center py-4 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <p className="text-kst-white font-medium truncate">
                      {client.company_name}
                    </p>
                    <p className="text-kst-muted text-xs truncate">
                      {client.contact_name}
                    </p>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <StatusBadge status={client.status} />
                  </div>
                  <div className="col-span-6 sm:col-span-4 text-kst-muted text-xs sm:text-right">
                    Joined {formatDate(client.joined_date ?? client.created_at)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
}) {
  return (
    <div className="glass-panel-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-kst-gold">{icon}</span>
      </div>
      <p className="text-kst-white text-3xl font-bold tracking-tight">
        {value}
      </p>
      <p className="text-kst-muted text-xs mt-1">{label}</p>
    </div>
  )
}
