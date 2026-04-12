'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Target,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

interface SuccessTrackingProps {
  clientId: string
  clientName?: string
  launchedDate: string
}

type MetricKey =
  | 'ad_spend'
  | 'leads_generated'
  | 'calls_booked'
  | 'calls_showed_up'
  | 'students_enrolled'
  | 'revenue_collected'
  | 'cash_collected'

interface InputMetricDef {
  key: MetricKey
  label: string
  prefix?: string
}

interface CalcMetricDef {
  key: string
  label: string
  compute: (m: Partial<Record<MetricKey, number>>) => number | null
  format: (v: number) => string
}

interface WeeklyReportRow {
  id: string
  client_id: string
  week_number: number
  week_start: string
  week_end: string
  metrics: Record<string, number> | null
  bottlenecks: string | null
  next_steps: string | null
  current_priorities: string | null
}

type SaveStatus = 'idle' | 'editing' | 'saving' | 'saved'

// ───────────────────────────────────────────────────────────────────────────
// Metric definitions
// ───────────────────────────────────────────────────────────────────────────

const INPUT_METRICS: InputMetricDef[] = [
  { key: 'ad_spend', label: 'Ad Spend', prefix: '$' },
  { key: 'leads_generated', label: 'Leads Generated' },
  { key: 'calls_booked', label: 'Calls Booked' },
  { key: 'calls_showed_up', label: 'Calls Showed Up' },
  { key: 'students_enrolled', label: 'Students Enrolled' },
  { key: 'revenue_collected', label: 'Revenue Collected', prefix: '$' },
  { key: 'cash_collected', label: 'Cash Collected', prefix: '$' },
]

const CALC_METRICS: CalcMetricDef[] = [
  {
    key: 'roas',
    label: 'ROAS',
    compute: (m) =>
      m.ad_spend && m.revenue_collected != null
        ? m.revenue_collected / m.ad_spend
        : null,
    format: (v) => `${v.toFixed(1)}x`,
  },
  {
    key: 'cost_per_lead',
    label: 'Cost Per Lead',
    compute: (m) =>
      m.leads_generated && m.ad_spend != null
        ? m.ad_spend / m.leads_generated
        : null,
    format: (v) => `$${v.toFixed(2)}`,
  },
  {
    key: 'booking_rate',
    label: 'Booking Rate',
    compute: (m) =>
      m.leads_generated && m.calls_booked != null
        ? (m.calls_booked / m.leads_generated) * 100
        : null,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'close_rate',
    label: 'Close Rate',
    compute: (m) =>
      m.calls_showed_up && m.students_enrolled != null
        ? (m.students_enrolled / m.calls_showed_up) * 100
        : null,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'cost_per_call',
    label: 'Cost Per Call',
    compute: (m) =>
      m.calls_booked && m.ad_spend != null
        ? m.ad_spend / m.calls_booked
        : null,
    format: (v) => `$${v.toFixed(2)}`,
  },
  {
    key: 'cost_per_sale',
    label: 'Cost Per Sale',
    compute: (m) =>
      m.students_enrolled && m.ad_spend != null
        ? m.ad_spend / m.students_enrolled
        : null,
    format: (v) => `$${v.toFixed(2)}`,
  },
  {
    key: 'show_rate',
    label: 'Show Rate',
    compute: (m) =>
      m.calls_booked && m.calls_showed_up != null
        ? (m.calls_showed_up / m.calls_booked) * 100
        : null,
    format: (v) => `${v.toFixed(1)}%`,
  },
]

// ───────────────────────────────────────────────────────────────────────────
// Date helpers (Monday-Sunday weeks)
// ───────────────────────────────────────────────────────────────────────────

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

function addDays(date: Date, n: number): Date {
  const r = new Date(date)
  r.setDate(r.getDate() + n)
  return r
}

function toIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Start of the Monday-anchored week containing `d` (local midnight). */
function startOfWeekMonday(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const day = r.getDay() // 0 = Sunday … 6 = Saturday
  const offset = day === 0 ? 6 : day - 1
  r.setDate(r.getDate() - offset)
  return r
}

function weekRange(
  launchedAt: Date,
  weekNum: number
): { start: Date; end: Date } {
  const week1 = startOfWeekMonday(launchedAt)
  const start = addDays(week1, (weekNum - 1) * 7)
  const end = addDays(start, 6)
  return { start, end }
}

function computeCurrentWeek(launchedAt: Date, today: Date): number {
  const week1 = startOfWeekMonday(launchedAt)
  const todayMonday = startOfWeekMonday(today)
  const diffWeeks = Math.round(
    (todayMonday.getTime() - week1.getTime()) / (86400000 * 7)
  )
  return Math.max(1, diffWeeks + 1)
}

const MONTH_LABELS = [
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

function formatRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()
  const startStr = `${MONTH_LABELS[start.getMonth()]} ${start.getDate()}`
  const endStr = sameMonth
    ? `${end.getDate()}, ${end.getFullYear()}`
    : `${MONTH_LABELS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`
  return `${startStr} – ${endStr}`
}

function parseNum(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

// ───────────────────────────────────────────────────────────────────────────
// Top-level component
// ───────────────────────────────────────────────────────────────────────────

export function SuccessTracking({
  clientId,
  clientName,
  launchedDate,
}: SuccessTrackingProps) {
  const supabase = useMemo(() => createClient(), [])
  const launchedAt = useMemo(() => parseLocalDate(launchedDate), [launchedDate])
  const thisWeekNum = useMemo(
    () => computeCurrentWeek(launchedAt, new Date()),
    [launchedAt]
  )

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [reportsByWeek, setReportsByWeek] = useState<
    Map<number, WeeklyReportRow>
  >(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      setLoading(true)
      setLoadError(null)
      const [{ data: userData }, { data, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('weekly_reports').select('*').eq('client_id', clientId),
      ])
      if (cancelled) return
      if (error) {
        setLoadError(error.message)
      } else {
        const m = new Map<number, WeeklyReportRow>()
        for (const r of (data ?? []) as WeeklyReportRow[]) {
          m.set(r.week_number, r)
        }
        setReportsByWeek(m)
      }
      setCurrentUserId(userData.user?.id ?? null)
      setLoading(false)
    }
    init()
    return () => {
      cancelled = true
    }
  }, [clientId, supabase])

  if (loading) {
    return (
      <div className="glass-panel p-6">
        <p className="text-kst-muted text-sm">Loading reports…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="glass-panel p-6">
        <p className="text-kst-error text-sm">
          Could not load reports: {loadError}
        </p>
      </div>
    )
  }

  const weeks: number[] = []
  for (let w = thisWeekNum; w >= 1; w--) weeks.push(w)

  return (
    <div className="space-y-4">
      {weeks.map((w) => {
        const { start, end } = weekRange(launchedAt, w)
        return (
          <WeekCard
            key={w}
            clientId={clientId}
            clientName={clientName}
            currentUserId={currentUserId}
            weekNum={w}
            weekStart={start}
            weekEnd={end}
            initialReport={reportsByWeek.get(w) ?? null}
            defaultExpanded={w === thisWeekNum}
          />
        )
      })}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Week card (one row per week, owns its own form state and auto-save)
// ───────────────────────────────────────────────────────────────────────────

interface WeekCardProps {
  clientId: string
  clientName?: string
  currentUserId: string | null
  weekNum: number
  weekStart: Date
  weekEnd: Date
  initialReport: WeeklyReportRow | null
  defaultExpanded: boolean
}

function WeekCard({
  clientId,
  clientName,
  currentUserId,
  weekNum,
  weekStart,
  weekEnd,
  initialReport,
  defaultExpanded,
}: WeekCardProps) {
  const supabase = useMemo(() => createClient(), [])

  const [expanded, setExpanded] = useState(defaultExpanded)
  const [reportExists, setReportExists] = useState(!!initialReport)

  const [metricInputs, setMetricInputs] = useState<Record<string, string>>(
    () => {
      const out: Record<string, string> = {}
      if (initialReport?.metrics) {
        for (const m of INPUT_METRICS) {
          const v = initialReport.metrics[m.key]
          if (v !== null && v !== undefined) out[m.key] = String(v)
        }
      }
      return out
    }
  )
  const [bottlenecks, setBottlenecks] = useState(
    initialReport?.bottlenecks ?? ''
  )
  const [nextSteps, setNextSteps] = useState(initialReport?.next_steps ?? '')
  const [priorities, setPriorities] = useState(
    initialReport?.current_priorities ?? ''
  )

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const dirtyRef = useRef(false)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Numeric metrics for live calculations
  const metricNums = useMemo(() => {
    const out: Partial<Record<MetricKey, number>> = {}
    for (const m of INPUT_METRICS) {
      const v = parseNum(metricInputs[m.key] ?? '')
      if (v !== undefined) out[m.key] = v
    }
    return out
  }, [metricInputs])

  // Realtime: sync changes from other users
  useEffect(() => {
    const channel = supabase
      .channel(`report-${clientId}-${weekNum}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_reports',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const row = payload.new as WeeklyReportRow | undefined
          if (!row || row.week_number !== weekNum) return
          if (dirtyRef.current) return

          if (row.metrics) {
            const updated: Record<string, string> = {}
            for (const m of INPUT_METRICS) {
              const v = row.metrics[m.key]
              if (v !== null && v !== undefined) updated[m.key] = String(v)
            }
            setMetricInputs(updated)
          }
          setBottlenecks(row.bottlenecks ?? '')
          setNextSteps(row.next_steps ?? '')
          setPriorities(row.current_priorities ?? '')
          setReportExists(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, clientId, weekNum])

  const doSave = useCallback(async () => {
    setSaveStatus('saving')
    setSaveError(null)

    const metricsPayload: Record<string, number> = {}
    for (const m of INPUT_METRICS) {
      const v = parseNum(metricInputs[m.key] ?? '')
      if (v !== undefined) metricsPayload[m.key] = v
    }

    const { error } = await supabase.from('weekly_reports').upsert(
      {
        client_id: clientId,
        week_number: weekNum,
        week_start: toIso(weekStart),
        week_end: toIso(weekEnd),
        metrics: metricsPayload,
        bottlenecks: bottlenecks.trim() || null,
        next_steps: nextSteps.trim() || null,
        current_priorities: priorities.trim() || null,
        created_by: currentUserId,
      },
      { onConflict: 'client_id,week_number' }
    )

    if (error) {
      setSaveError(error.message)
      setSaveStatus('idle')
      return
    }

    dirtyRef.current = false
    setReportExists(true)
    setSaveStatus('saved')
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    fadeTimerRef.current = setTimeout(() => {
      setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
    }, 2000)
  }, [
    bottlenecks,
    clientId,
    currentUserId,
    metricInputs,
    nextSteps,
    priorities,
    supabase,
    weekEnd,
    weekNum,
    weekStart,
  ])

  // Debounced auto-save (1.5s after last edit)
  useEffect(() => {
    if (!dirtyRef.current) return
    setSaveStatus('editing')
    const t = setTimeout(() => {
      doSave()
    }, 1500)
    return () => clearTimeout(t)
  }, [metricInputs, bottlenecks, nextSteps, priorities, doSave])

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [])

  function markDirty() {
    dirtyRef.current = true
  }

  function handleMetricChange(key: MetricKey, value: string) {
    markDirty()
    setMetricInputs((prev) => ({ ...prev, [key]: value }))
  }
  function handleBottlenecks(e: ChangeEvent<HTMLTextAreaElement>) {
    markDirty()
    setBottlenecks(e.target.value)
  }
  function handleNextSteps(e: ChangeEvent<HTMLTextAreaElement>) {
    markDirty()
    setNextSteps(e.target.value)
  }
  function handlePriorities(e: ChangeEvent<HTMLTextAreaElement>) {
    markDirty()
    setPriorities(e.target.value)
  }

  // Collapsed-state summary
  const summary = useMemo(() => {
    if (!reportExists) return null
    const parts: string[] = []
    const revenue = metricNums.revenue_collected
    if (revenue != null)
      parts.push(`Revenue: $${revenue.toLocaleString('en-US')}`)
    if (
      metricNums.ad_spend &&
      metricNums.revenue_collected != null
    ) {
      const roas = metricNums.revenue_collected / metricNums.ad_spend
      parts.push(`ROAS: ${roas.toFixed(1)}x`)
    }
    return parts.length > 0 ? parts.join(' • ') : 'Report started'
  }, [metricNums, reportExists])

  return (
    <div className="glass-panel overflow-hidden">
      {/* Header (always visible, click to expand) */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p
            className="text-kst-gold text-lg font-semibold"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Week {weekNum} — {formatRange(weekStart, weekEnd)}
          </p>
          {clientName && (
            <p className="text-kst-muted text-xs mt-0.5">
              {clientName}
            </p>
          )}
          {!expanded && (
            <p
              className={cn(
                'text-xs mt-1.5 truncate',
                summary ? 'text-kst-muted' : 'text-kst-muted/60 italic'
              )}
            >
              {summary ?? 'No report'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 mt-1">
          <SaveIndicator status={saveStatus} />
          <ChevronDown
            size={16}
            className={cn(
              'text-kst-muted transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Body (when expanded) */}
      {expanded && (
        <div className="px-6 pb-6 border-t border-white/[0.05] pt-6 space-y-8">
          {!reportExists && (
            <p className="text-kst-muted text-xs">
              No report for this week yet. Start filling in the fields to
              create one.
            </p>
          )}

          <Section title="Metrics" icon={<BarChart3 size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {INPUT_METRICS.map((m) => (
                <MetricInput
                  key={m.key}
                  label={m.label}
                  prefix={m.prefix}
                  value={metricInputs[m.key] ?? ''}
                  onChange={(v) => handleMetricChange(m.key, v)}
                />
              ))}
              {CALC_METRICS.map((c) => {
                const v = c.compute(metricNums)
                return (
                  <CalcMetric
                    key={c.key}
                    label={c.label}
                    value={v == null ? '—' : c.format(v)}
                  />
                )
              })}
            </div>
          </Section>

          <Section title="Bottlenecks" icon={<AlertTriangle size={16} />}>
            <ReportTextarea
              value={bottlenecks}
              onChange={handleBottlenecks}
              placeholder="What's blocking progress this week?"
            />
          </Section>

          <Section title="Next Steps" icon={<ArrowRight size={16} />}>
            <ReportTextarea
              value={nextSteps}
              onChange={handleNextSteps}
              placeholder="Action items for the coming week..."
            />
          </Section>

          <Section title="Current Priorities" icon={<Target size={16} />}>
            <ReportTextarea
              value={priorities}
              onChange={handlePriorities}
              placeholder="What should we focus on?"
            />
          </Section>

          {saveError && (
            <p className="text-kst-error text-xs">Save error: {saveError}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-kst-white font-semibold mb-3">
        <span className="text-kst-gold">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  )
}

function MetricInput({
  label,
  prefix,
  value,
  onChange,
}: {
  label: string
  prefix?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-kst-gold/80">
        {label}
      </span>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kst-muted text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className={cn(
            'w-full h-11 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors',
            prefix ? 'pl-7 pr-3' : 'px-3'
          )}
        />
      </div>
    </label>
  )
}

function CalcMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-kst-gold/80">
          {label}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-kst-muted/70 px-1.5 py-0.5 rounded border border-white/10">
          auto
        </span>
      </div>
      <div
        className="h-11 px-3 rounded-xl border border-white/10 text-kst-white text-sm flex items-center"
        style={{ background: 'rgba(201,168,76,0.05)' }}
      >
        {value}
      </div>
    </div>
  )
}

function ReportTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  placeholder: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 80)}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={3}
      className="w-full min-h-[80px] px-4 py-3 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors resize-none overflow-hidden"
    />
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  if (status === 'editing')
    return <span className="text-[11px] text-kst-muted">editing…</span>
  if (status === 'saving')
    return (
      <span className="text-[11px] text-kst-muted inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full border-2 border-kst-gold/40 border-t-kst-gold animate-spin" />
        Saving…
      </span>
    )
  return (
    <span className="text-[11px] text-kst-success inline-flex items-center gap-1 kst-fade-in">
      <Check size={11} />
      Saved
    </span>
  )
}
