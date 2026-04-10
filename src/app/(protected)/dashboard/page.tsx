import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle,
  ClipboardList,
  Clock,
  Rocket,
  UserPlus,
  Users,
} from 'lucide-react'
import { requireTeamMember } from '@/lib/auth/require-team'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/clients/status-badge'
import { formatDate } from '@/lib/utils'
import {
  AnalyticsSection,
  type ClientMetricsRow,
  type ClientTimeToLaunchRow,
  type GlobalTotals,
  type TaskPerformanceRow,
  type TeamPerformanceRow,
} from '@/components/dashboard/analytics-section'
import type { WeeklyTrendPoint } from '@/components/dashboard/weekly-trend-chart'
import type { ClientStatus } from '@/lib/types'

interface RecentClient {
  id: string
  company_name: string
  contact_name: string
  status: ClientStatus
  joined_date: string | null
  created_at: string
}

interface LaunchedRow {
  id: string
  company_name: string
  launched_date: string
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

function currentWeekFor(launched: string): number {
  const launchedAt = parseLocalDate(launched)
  launchedAt.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.floor(
    (today.getTime() - launchedAt.getTime()) / 86400000
  )
  return Math.max(1, Math.floor(days / 7) + 1)
}

export default async function DashboardPage() {
  const { profile } = await requireTeamMember()
  const supabase = await createClient()

  const todayIso = new Date().toISOString().slice(0, 10)

  const in7 = new Date()
  in7.setDate(in7.getDate() + 7)
  const in7Iso = in7.toISOString().slice(0, 10)

  // Pre-fetch imported clients to exclude from metrics
  const { data: importedClients } = await supabase
    .from('clients')
    .select('id, company_name')
    .eq('is_imported', true)
  const importedRows_ = (importedClients ?? []) as { id: string; company_name: string }[]
  const importedIds = importedRows_.map((r) => r.id)
  const importedNames = new Set(importedRows_.map((r) => r.company_name))

  const [
    totalRes,
    onboardingRes,
    launchedRes,
    recentRes,
    launchedListRes,
    overdueRes,
    endingSoonRes,
    // Analytics views
    globalTotalsRes,
    weeklyTrendRes,
    clientMetricsRes,
    taskPerfRes,
    teamPerfRes,
    clientOverviewRes,
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
    supabase
      .from('clients')
      .select('id, company_name, contact_name, status, joined_date, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('clients')
      .select('id, company_name, launched_date')
      .not('launched_date', 'is', null)
      .order('launched_date', { ascending: false }),
    (() => {
      let q = supabase
        .from('client_tasks')
        .select('*', { count: 'exact', head: true })
        .lt('due_date', todayIso)
        .neq('status', 'completed')
      if (importedIds.length > 0) {
        q = q.not('client_id', 'in', `(${importedIds.join(',')})`)
      }
      return q
    })(),
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .gte('program_end_date', todayIso)
      .lte('program_end_date', in7Iso),
    supabase.from('analytics_global_totals').select('*').maybeSingle(),
    supabase
      .from('analytics_weekly_trend')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(12),
    supabase
      .from('analytics_weekly_metrics')
      .select('*')
      .gt('total_weeks_reported', 0)
      .order('overall_roas', { ascending: false, nullsFirst: false }),
    supabase
      .from('analytics_task_performance')
      .select('title, stage_name, times_overdue, overdue_rate_pct, avg_days_to_complete')
      .gt('times_overdue', 0)
      .order('overdue_rate_pct', { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from('analytics_team_performance')
      .select('*')
      .gt('total_assigned_tasks', 0)
      .order('completed_tasks', { ascending: false, nullsFirst: false }),
    supabase
      .from('analytics_client_overview')
      .select('company_name, days_to_launch, program, launched_date')
      .not('launched_date', 'is', null)
      .order('launched_date', { ascending: false }),
  ])

  const totalClients = totalRes.count ?? 0
  const onboardingCount = onboardingRes.count ?? 0
  const launchedCount = launchedRes.count ?? 0
  const overdueCount = overdueRes.count ?? 0
  const endingSoonCount = endingSoonRes.count ?? 0

  const recent = (recentRes.data ?? []) as RecentClient[]
  const launchedList = (launchedListRes.data ?? []) as LaunchedRow[]

  // Compute "Reports Due This Week"
  let reportsDue: { id: string; company_name: string; weekNum: number }[] = []
  if (launchedList.length > 0) {
    const ids = launchedList.map((c) => c.id)
    const { data: existingReports } = await supabase
      .from('weekly_reports')
      .select('client_id, week_number')
      .in('client_id', ids)

    const byClient = new Map<string, Set<number>>()
    for (const r of (existingReports ?? []) as {
      client_id: string
      week_number: number
    }[]) {
      if (!byClient.has(r.client_id)) byClient.set(r.client_id, new Set())
      byClient.get(r.client_id)!.add(r.week_number)
    }

    for (const c of launchedList) {
      const weekNum = currentWeekFor(c.launched_date)
      if (!byClient.get(c.id)?.has(weekNum)) {
        reportsDue.push({
          id: c.id,
          company_name: c.company_name,
          weekNum,
        })
      }
    }
  }

  // ── Analytics data (safe fallbacks so the section renders even
  //    if a view is missing or returns an error) ──
  const globalTotals = (globalTotalsRes.data ??
    null) as GlobalTotals | null
  const weeklyTrend = ((weeklyTrendRes.data ?? []) as WeeklyTrendPoint[])
    .slice()
    .reverse() // chronological order
  const clientMetrics = (clientMetricsRes.data ?? []) as ClientMetricsRow[]
  const taskBottlenecks = (taskPerfRes.data ?? []) as TaskPerformanceRow[]
  const teamPerformance = (teamPerfRes.data ?? []) as TeamPerformanceRow[]
  // Filter imported clients from time-to-launch analytics
  const timeToLaunch = ((clientOverviewRes.data ?? []) as ClientTimeToLaunchRow[]).filter(
    (r) => !importedNames.has(r.company_name ?? '')
  )

  const name = profile?.full_name ?? 'there'

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1
          className="text-5xl md:text-6xl text-kst-gold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Dashboard
        </h1>
        <p className="mt-3 text-kst-muted">Welcome back, {name}</p>
      </div>

      {/* ── Overview ─────────────────────────────────────────────── */}

      {/* 4 stat cards in one row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
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
          icon={<AlertCircle size={20} />}
          label="Overdue Tasks"
          value={overdueCount}
          tone={overdueCount > 0 ? 'danger' : 'default'}
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Ending Soon"
          value={endingSoonCount}
          tone={endingSoonCount > 0 ? 'gold' : 'default'}
        />
      </div>

      {/* Recent Clients + Reports Due side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-kst-white font-medium truncate">
                        {client.company_name}
                      </p>
                      <p className="text-kst-muted text-xs truncate">
                        {client.contact_name}
                      </p>
                    </div>
                    <StatusBadge status={client.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-panel p-6 md:p-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-kst-white text-xl font-semibold flex items-center gap-2">
              <ClipboardList size={18} className="text-kst-gold" />
              Reports Due This Week
            </h2>
          </div>

          {launchedList.length === 0 ? (
            <p className="text-kst-muted text-sm py-8 text-center">
              No launched clients yet.
            </p>
          ) : reportsDue.length === 0 ? (
            <div className="flex items-center gap-2 text-kst-success text-sm py-4">
              <CheckCircle size={16} />
              All caught up!
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {reportsDue.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/clients/${d.id}?tab=success`}
                    className="flex items-center justify-between py-3 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-kst-white font-medium truncate">
                        {d.company_name}
                      </p>
                      <p className="text-kst-muted text-xs">
                        Week {d.weekNum}
                      </p>
                    </div>
                    <span className="text-kst-gold text-xs font-medium shrink-0">
                      Fill Report →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Analytics ────────────────────────────────────────────── */}

      <AnalyticsSection
        globalTotals={globalTotals}
        weeklyTrend={weeklyTrend}
        clientMetrics={clientMetrics}
        taskBottlenecks={taskBottlenecks}
        teamPerformance={teamPerformance}
        timeToLaunch={timeToLaunch}
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  tone?: 'default' | 'danger' | 'gold'
}) {
  const isDanger = tone === 'danger'
  const isGold = tone === 'gold'
  return (
    <div
      className="glass-panel-sm p-5"
      style={
        isDanger
          ? {
              borderColor: 'rgba(248, 113, 113, 0.35)',
              background:
                'linear-gradient(135deg, rgba(248,113,113,0.10) 0%, rgba(248,113,113,0.02) 100%)',
            }
          : isGold
            ? {
                borderColor: 'rgba(201, 168, 76, 0.35)',
                background:
                  'linear-gradient(135deg, rgba(201,168,76,0.10) 0%, rgba(201,168,76,0.02) 100%)',
              }
            : undefined
      }
    >
      <div className="flex items-center justify-between mb-3">
        <span className={isDanger ? 'text-kst-error' : 'text-kst-gold'}>
          {icon}
        </span>
      </div>
      <p
        className={
          isDanger
            ? 'text-kst-error text-3xl font-bold tracking-tight'
            : isGold
              ? 'text-kst-gold text-3xl font-bold tracking-tight'
              : 'text-kst-white text-3xl font-bold tracking-tight'
        }
      >
        {value}
      </p>
      <p className="text-kst-muted text-xs mt-1">{label}</p>
    </div>
  )
}
