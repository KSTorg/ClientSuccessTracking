import Link from 'next/link'
import {
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Rocket,
  Users,
  Zap,
} from 'lucide-react'
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
  formatRoas,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { ProgramBadge } from '@/components/clients/program-badge'
import { SpecialtyBadge } from '@/components/team/specialty-badge'
import {
  WeeklyTrendChart,
  type WeeklyTrendPoint,
} from '@/components/dashboard/weekly-trend-chart'
import type { Program, Specialty } from '@/lib/types'

// ───────────────────────────────────────────────────────────────────────────
// Types (columns are best-effort; Supabase returns whatever the view has)
// ───────────────────────────────────────────────────────────────────────────

export interface GlobalTotals {
  total_revenue: number | null
  total_ad_spend: number | null
  global_roas: number | null
  global_cpl: number | null
  total_leads: number | null
  total_students_enrolled: number | null
}

export interface ClientMetricsRow {
  client_id: string | null
  company_name: string | null
  total_weeks_reported: number | null
  total_ad_spend: number | null
  total_revenue: number | null
  overall_roas: number | null
  overall_cpl: number | null
  total_leads: number | null
  total_enrolled: number | null
  close_rate: number | null
}

export interface TaskPerformanceRow {
  title: string | null
  stage_name: string | null
  times_ever_overdue: number | null
  times_currently_overdue: number | null
  times_completed_late: number | null
  overdue_rate_pct: number | null
  avg_days_to_complete: number | null
}

export interface TeamPerformanceRow {
  user_id: string | null
  full_name: string | null
  specialty: Specialty | null
  total_assigned_tasks: number | null
  completed_tasks: number | null
  overdue_tasks: number | null
  avg_days_to_complete: number | null
}

export interface ClientTimeToLaunchRow {
  company_name: string | null
  days_to_launch: number | null
  program: Program | null
}

export interface RetentionData {
  total_ended_programs: number | null
  total_ever_renewed: number | null
  total_churned: number | null
  total_renewals: number | null
  ended_no_action: number | null
  renewal_rate_pct: number | null
  churn_rate_pct: number | null
  avg_renewals_before_churn: number | null
  avg_days_to_churn: number | null
  churned_after_renewal_pct: number | null
  ei_renewed: number | null
  ei_churned: number | null
  acc_renewed: number | null
  acc_churned: number | null
}

export interface MrrData {
  total_mrr: number | null
  active_subscriptions: number | null
  clients_with_subs: number | null
  avg_mrr_per_client: number | null
}

export interface ServicePopularityRow {
  service_name: string | null
  category: string | null
  active_count: number | null
  mrr_contribution: number | null
}

interface AnalyticsSectionProps {
  globalTotals: GlobalTotals | null
  weeklyTrend: WeeklyTrendPoint[]
  clientMetrics: ClientMetricsRow[]
  taskBottlenecks: TaskPerformanceRow[]
  teamPerformance: TeamPerformanceRow[]
  timeToLaunch: ClientTimeToLaunchRow[]
  retention: RetentionData | null
  mrr: MrrData | null
  servicePopularity: ServicePopularityRow[]
}

// ───────────────────────────────────────────────────────────────────────────
// Section
// ───────────────────────────────────────────────────────────────────────────

export function AnalyticsSection({
  globalTotals,
  weeklyTrend,
  clientMetrics,
  taskBottlenecks,
  teamPerformance,
  timeToLaunch,
  retention,
  mrr,
  servicePopularity,
}: AnalyticsSectionProps) {
  const hasAnyData =
    !!globalTotals ||
    weeklyTrend.length > 0 ||
    clientMetrics.length > 0 ||
    taskBottlenecks.length > 0 ||
    teamPerformance.length > 0 ||
    timeToLaunch.length > 0 ||
    !!retention

  return (
    <section className="mt-12">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl text-kst-white font-semibold flex items-center gap-2">
          <BarChart3 size={20} className="text-kst-gold" />
          Analytics
        </h2>
        <p className="text-kst-muted text-sm mt-1">
          {hasAnyData
            ? 'Live performance across every launched client.'
            : 'Analytics will populate as you fill in weekly reports.'}
        </p>
      </div>

      {/* A) Global metrics */}
      <GlobalMetricsBar totals={globalTotals} />

      {/* B) Weekly trend chart */}
      <div className="mt-6">
        <WeeklyTrendChart data={weeklyTrend} />
      </div>

      {/* C) Client performance table */}
      <div className="mt-6">
        <ClientPerformanceTable rows={clientMetrics} />
      </div>

      {/* D + E) Two-column grid: bottlenecks + team performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <TaskBottlenecks rows={taskBottlenecks} />
        <TeamPerformancePanel rows={teamPerformance} />
      </div>

      {/* F) Time to launch + Retention side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <TimeToLaunchPanel rows={timeToLaunch} />
        <RetentionPanel data={retention} />
      </div>

      {/* G) MRR + Service Popularity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <MrrPanel data={mrr} />
        <ServicePopularityPanel rows={servicePopularity} />
      </div>
    </section>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// A) Global metrics bar
// ───────────────────────────────────────────────────────────────────────────

function GlobalMetricsBar({ totals }: { totals: GlobalTotals | null }) {
  const items: {
    label: string
    value: string
    accent?: boolean
    icon: React.ReactNode
  }[] = [
    {
      label: 'Total Revenue',
      value: formatCurrency(totals?.total_revenue),
      accent: true,
      icon: <Zap size={16} />,
    },
    {
      label: 'Total Ad Spend',
      value: formatCurrency(totals?.total_ad_spend),
      icon: <BarChart3 size={16} />,
    },
    {
      label: 'Global ROAS',
      value: formatRoas(totals?.global_roas),
      accent: true,
      icon: <Rocket size={16} />,
    },
    {
      label: 'Global CPL',
      value: formatCurrency(totals?.global_cpl),
      icon: <BarChart3 size={16} />,
    },
    {
      label: 'Total Leads',
      value: formatNumber(totals?.total_leads),
      icon: <Users size={16} />,
    },
    {
      label: 'Students Enrolled',
      value: formatNumber(totals?.total_students_enrolled),
      icon: <Users size={16} />,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
      {items.map((item) => (
        <div key={item.label} className="glass-panel-sm p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-kst-gold/80">{item.icon}</span>
          </div>
          <p
            className={cn(
              'text-2xl md:text-3xl font-bold tracking-tight',
              item.accent ? 'text-kst-gold' : 'text-kst-white'
            )}
          >
            {item.value}
          </p>
          <p className="text-kst-muted text-[11px] uppercase tracking-wider mt-1">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// C) Client performance table
// ───────────────────────────────────────────────────────────────────────────

function ClientPerformanceTable({ rows }: { rows: ClientMetricsRow[] }) {
  return (
    <div className="glass-panel overflow-hidden">
      <div className="flex items-center justify-between px-6 md:px-8 py-5">
        <div>
          <h3 className="text-kst-white font-semibold">Client Performance</h3>
          <p className="text-kst-muted text-xs mt-0.5">
            Sorted by ROAS, descending
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-kst-muted text-sm px-6 md:px-8 pb-8">
          No client weekly reports yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm"
            style={{ tableLayout: 'fixed' }}
          >
            <colgroup>
              <col style={{ width: '24%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr className="text-left text-kst-muted text-[11px] uppercase tracking-wider border-t border-white/[0.06]">
                <th className="px-3 py-3 font-medium">
                  <div className="truncate">Client</div>
                </th>
                <th className="px-3 py-3 font-medium">
                  <div className="truncate">Weeks</div>
                </th>
                <th className="px-3 py-3 font-medium">
                  <div className="truncate">Ad Spend</div>
                </th>
                <th className="px-3 py-3 font-medium">
                  <div className="truncate">Revenue</div>
                </th>
                <th className="px-3 py-3 font-medium">
                  <div className="truncate">ROAS</div>
                </th>
                <th className="px-3 py-3 font-medium">
                  <div className="truncate">CPL</div>
                </th>
                <th className="px-3 py-3 font-medium">
                  <div className="truncate">Leads</div>
                </th>
                <th className="px-3 py-3 font-medium">
                  <div className="truncate">Enrolled</div>
                </th>
                <th className="px-3 py-3 font-medium">
                  <div className="truncate">Close %</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const roas = r.overall_roas
                const roasCls =
                  roas == null
                    ? 'text-kst-muted'
                    : roas >= 5
                      ? 'text-kst-success font-semibold'
                      : roas >= 3
                        ? 'text-kst-gold font-semibold'
                        : roas < 1
                          ? 'text-kst-error font-semibold'
                          : 'text-kst-white'

                return (
                  <tr
                    key={r.client_id ?? i}
                    className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-3 py-4">
                      <div className="truncate font-medium">
                        {r.client_id ? (
                          <Link
                            href={`/clients/${r.client_id}`}
                            className="text-kst-white hover:text-kst-gold transition-colors"
                          >
                            {r.company_name ?? '—'}
                          </Link>
                        ) : (
                          <span className="text-kst-white">
                            {r.company_name ?? '—'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="truncate text-kst-muted">
                        {formatNumber(r.total_weeks_reported)}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="truncate text-kst-white">
                        {formatCurrencyCompact(r.total_ad_spend)}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="truncate text-kst-white">
                        {formatCurrencyCompact(r.total_revenue)}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className={cn('truncate', roasCls)}>
                        {formatRoas(roas)}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="truncate text-kst-white">
                        {formatCurrencyCompact(r.overall_cpl)}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="truncate text-kst-white">
                        {formatNumber(r.total_leads)}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="truncate text-kst-white">
                        {formatNumber(r.total_enrolled)}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="truncate text-kst-muted">
                        {formatPercent(r.close_rate)}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// D) Task bottlenecks
// ───────────────────────────────────────────────────────────────────────────

function TaskBottlenecks({ rows }: { rows: TaskPerformanceRow[] }) {
  return (
    <div className="glass-panel p-6 md:p-8">
      <div className="flex items-center gap-2 mb-5">
        <AlertTriangle size={16} className="text-kst-error" />
        <h3 className="text-kst-white font-semibold">
          Most Frequently Overdue Tasks
        </h3>
      </div>

      {rows.length === 0 ? (
        <p className="text-kst-muted text-sm py-6 text-center">
          No overdue tasks yet — everything is on schedule.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((r, i) => {
            const pct = Math.min(100, Math.max(0, Number(r.overdue_rate_pct ?? 0)))
            return (
              <li key={i}>
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-kst-white text-sm truncate">
                      {r.title ?? 'Untitled task'}
                    </p>
                    <p className="text-kst-muted text-xs truncate">
                      {r.stage_name ?? '—'}
                      {r.avg_days_to_complete != null &&
                        ` · avg ${Number(r.avg_days_to_complete).toFixed(1)}d`}
                    </p>
                  </div>
                  <span className="text-kst-error text-xs font-semibold shrink-0">
                    {formatPercent(r.overdue_rate_pct)}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background:
                        'linear-gradient(90deg, rgba(248,113,113,0.7), rgba(248,113,113,0.35))',
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// E) Team performance
// ───────────────────────────────────────────────────────────────────────────

function TeamPerformancePanel({ rows }: { rows: TeamPerformanceRow[] }) {
  return (
    <div className="glass-panel p-6 md:p-8">
      <div className="flex items-center gap-2 mb-5">
        <Users size={16} className="text-kst-gold" />
        <h3 className="text-kst-white font-semibold">Team Performance</h3>
      </div>

      {rows.length === 0 ? (
        <p className="text-kst-muted text-sm py-6 text-center">
          No team assignments yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {rows.map((r) => {
            const assigned = Number(r.total_assigned_tasks ?? 0)
            const completed = Number(r.completed_tasks ?? 0)
            const overdue = Number(r.overdue_tasks ?? 0)
            const completionPct =
              assigned > 0 ? Math.round((completed / assigned) * 100) : 0

            return (
              <li key={r.user_id ?? r.full_name ?? Math.random()}>
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <span className="text-kst-white font-medium truncate">
                    {r.full_name ?? 'Unnamed'}
                  </span>
                  {r.specialty && <SpecialtyBadge specialty={r.specialty} />}
                  <span className="ml-auto text-[11px] text-kst-muted shrink-0">
                    {completed}/{assigned} done
                    {overdue > 0 && (
                      <span className="ml-2 text-kst-error">
                        · {overdue} overdue
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-kst-gold to-kst-gold-light rounded-full transition-all"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// F) Time to launch
// ───────────────────────────────────────────────────────────────────────────

function TimeToLaunchPanel({ rows }: { rows: ClientTimeToLaunchRow[] }) {
  const valid = rows.filter(
    (r) => r.days_to_launch != null && Number.isFinite(Number(r.days_to_launch))
  )
  const avg =
    valid.length > 0
      ? valid.reduce((sum, r) => sum + Number(r.days_to_launch), 0) /
        valid.length
      : null

  return (
    <div className="glass-panel p-6 md:p-8">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Rocket size={16} className="text-kst-gold" />
          <h3 className="text-kst-white font-semibold">Time to Launch</h3>
        </div>
        {avg != null && (
          <span className="text-kst-muted text-xs">
            Average:{' '}
            <span className="text-kst-white font-semibold">
              {avg.toFixed(1)} days
            </span>
          </span>
        )}
      </div>

      {valid.length === 0 ? (
        <p className="text-kst-muted text-sm py-6 text-center">
          No launches yet.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {valid.map((r, i) => {
            const days = Number(r.days_to_launch)
            const isFaster = avg != null && days < avg
            return (
              <li
                key={i}
                className="flex items-center gap-3 py-3 flex-wrap"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-kst-white font-medium truncate">
                    {r.company_name ?? '—'}
                  </span>
                </div>
                {r.program && <ProgramBadge program={r.program} />}
                <span
                  className={cn(
                    'text-sm shrink-0 w-24 text-right',
                    isFaster ? 'text-kst-gold font-semibold' : 'text-kst-white'
                  )}
                >
                  {days.toFixed(0)} days
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// G) Retention
// ───────────────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): string {
  return v != null && Number.isFinite(Number(v)) ? String(Number(v)) : '—'
}

function fmtPct(v: number | null | undefined): string {
  return v != null && Number.isFinite(Number(v)) ? `${Number(v).toFixed(0)}%` : '—'
}

function RetentionPanel({ data }: { data: RetentionData | null }) {
  const total = Number(data?.total_ended_programs ?? 0)
  const renewed = Number(data?.total_ever_renewed ?? 0)
  const churned = Number(data?.total_churned ?? 0)
  const renewalPct = Number(data?.renewal_rate_pct ?? 0)

  const renewalColor =
    renewalPct >= 70
      ? 'text-kst-success'
      : renewalPct >= 50
        ? 'text-kst-gold'
        : 'text-kst-error'

  return (
    <div className="glass-panel p-6 md:p-8">
      <div className="flex items-center gap-2 mb-5">
        <RefreshCw size={16} className="text-kst-gold" />
        <h3 className="text-kst-white font-semibold">Retention</h3>
      </div>

      {total === 0 ? (
        <p className="text-kst-muted text-sm py-6 text-center">
          No programs completed yet — retention data will appear once programs
          reach their end date.
        </p>
      ) : (
        <>
          {/* Ratio bar */}
          <div className="h-3 rounded-full overflow-hidden flex bg-white/[0.06] mb-5">
            {renewed > 0 && (
              <div
                className="bg-kst-success transition-all"
                style={{ width: `${(renewed / total) * 100}%` }}
              />
            )}
            {churned > 0 && (
              <div
                className="bg-kst-error transition-all"
                style={{ width: `${(churned / total) * 100}%` }}
              />
            )}
          </div>

          {/* Row 1: Rates */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-kst-muted text-xs mb-1">Renewal Rate</p>
              <p className={cn('text-2xl font-bold', renewalColor)}>
                {fmtPct(data?.renewal_rate_pct)}
              </p>
            </div>
            <div>
              <p className="text-kst-muted text-xs mb-1">Churn Rate</p>
              <p className="text-2xl font-bold text-kst-error">
                {fmtPct(data?.churn_rate_pct)}
              </p>
            </div>
          </div>

          {/* Row 2: Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-kst-muted text-xs mb-1">Renewed</p>
              <p className="text-kst-white text-lg font-semibold">{fmt(data?.total_ever_renewed)}</p>
            </div>
            <div>
              <p className="text-kst-muted text-xs mb-1">Churned</p>
              <p className="text-kst-white text-lg font-semibold">{fmt(data?.total_churned)}</p>
            </div>
            <div>
              <p className="text-kst-muted text-xs mb-1">Total Renewals</p>
              <p className="text-kst-white text-lg font-semibold">{fmt(data?.total_renewals)}</p>
            </div>
            <div>
              <p className="text-kst-muted text-xs mb-1">No Action</p>
              <p className={cn(
                'text-lg font-semibold',
                Number(data?.ended_no_action ?? 0) > 0 ? 'text-kst-gold' : 'text-kst-white'
              )}>
                {fmt(data?.ended_no_action)}
              </p>
            </div>
          </div>

          {/* Row 3: Insights (only if any data) */}
          {(data?.avg_renewals_before_churn != null ||
            data?.avg_days_to_churn != null ||
            data?.churned_after_renewal_pct != null) && (
            <div className="border-t border-white/[0.06] pt-4 mb-4">
              <p className="text-kst-muted text-xs uppercase tracking-wider mb-3">Insights</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-kst-muted text-xs mb-1">Avg Renewals Before Churn</p>
                  <p className="text-kst-white text-sm font-semibold">
                    {data?.avg_renewals_before_churn != null
                      ? Number(data.avg_renewals_before_churn).toFixed(1)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-kst-muted text-xs mb-1">Avg Days to Churn</p>
                  <p className="text-kst-white text-sm font-semibold">
                    {data?.avg_days_to_churn != null
                      ? `${Number(data.avg_days_to_churn).toFixed(0)} days`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-kst-muted text-xs mb-1">Churned After Renewal</p>
                  <p className="text-kst-white text-sm font-semibold">
                    {fmtPct(data?.churned_after_renewal_pct)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Row 4: By Program */}
          <div className="border-t border-white/[0.06] pt-4 space-y-2">
            <p className="text-kst-muted text-xs uppercase tracking-wider mb-2">
              By Program
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-kst-muted">Educator Incubator</span>
              <span>
                <span className="text-kst-success">{fmt(data?.ei_renewed)} renewed</span>
                {' / '}
                <span className="text-kst-error">{fmt(data?.ei_churned)} churned</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-kst-muted">Accelerator</span>
              <span>
                <span className="text-kst-success">{fmt(data?.acc_renewed)} renewed</span>
                {' / '}
                <span className="text-kst-error">{fmt(data?.acc_churned)} churned</span>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// H) MRR
// ───────────────────────────────────────────────────────────────────────────

function MrrPanel({ data }: { data: MrrData | null }) {
  const totalMrr = Number(data?.total_mrr ?? 0)
  const activeSubs = Number(data?.active_subscriptions ?? 0)
  const clientsWithSubs = Number(data?.clients_with_subs ?? 0)
  const avgMrr = Number(data?.avg_mrr_per_client ?? 0)

  return (
    <div
      className="glass-panel p-6 md:p-8"
      style={
        totalMrr > 0
          ? {
              borderColor: 'rgba(201, 168, 76, 0.25)',
              background:
                'linear-gradient(135deg, rgba(201,168,76,0.06) 0%, rgba(255,255,255,0.03) 50%, rgba(201,168,76,0.03) 100%)',
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2 mb-5">
        <Zap size={16} className="text-kst-gold" />
        <h3 className="text-kst-white font-semibold">MRR</h3>
      </div>

      {activeSubs === 0 ? (
        <p className="text-kst-muted text-sm py-6 text-center">
          No active subscriptions yet.
        </p>
      ) : (
        <>
          <p className="text-kst-gold text-4xl font-bold tracking-tight mb-4">
            ${Math.round(totalMrr).toLocaleString()}
            <span className="text-lg font-normal text-kst-muted">/mo</span>
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-kst-muted text-xs mb-1">Active Subs</p>
              <p className="text-kst-white text-lg font-semibold">{activeSubs}</p>
            </div>
            <div>
              <p className="text-kst-muted text-xs mb-1">Clients</p>
              <p className="text-kst-white text-lg font-semibold">{clientsWithSubs}</p>
            </div>
            <div>
              <p className="text-kst-muted text-xs mb-1">Avg/Client</p>
              <p className="text-kst-white text-lg font-semibold">
                ${Math.round(avgMrr).toLocaleString()}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// I) Service Popularity
// ───────────────────────────────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  combo: 'Combo',
  one_time: 'One-time',
  standalone: 'Standalone',
}

function ServicePopularityPanel({ rows }: { rows: ServicePopularityRow[] }) {
  return (
    <div className="glass-panel p-6 md:p-8">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 size={16} className="text-kst-gold" />
        <h3 className="text-kst-white font-semibold">Service Popularity</h3>
      </div>

      {rows.length === 0 ? (
        <p className="text-kst-muted text-sm py-6 text-center">
          No subscriptions yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-kst-muted text-xs uppercase tracking-wider border-b border-white/[0.06]">
                <th className="pb-2 font-medium">Service</th>
                <th className="pb-2 font-medium text-right">Active</th>
                <th className="pb-2 font-medium text-right">MRR</th>
                <th className="pb-2 font-medium text-right">Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-white/[0.04] last:border-b-0">
                  <td className="py-2.5 text-kst-white truncate max-w-[160px]">
                    {r.service_name ?? '—'}
                  </td>
                  <td className="py-2.5 text-kst-white text-right">
                    {Number(r.active_count ?? 0)}
                  </td>
                  <td className="py-2.5 text-kst-gold text-right font-medium">
                    ${Math.round(Number(r.mrr_contribution ?? 0)).toLocaleString()}
                  </td>
                  <td className="py-2.5 text-kst-muted text-right text-xs">
                    {CAT_LABELS[r.category ?? ''] ?? r.category ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
