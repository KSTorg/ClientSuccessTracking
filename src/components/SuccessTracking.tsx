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
  ChevronLeft,
  ChevronRight,
  Save,
  Target,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

interface SuccessTrackingProps {
  clientId: string
  launchedDate: string
}

type MetricKey =
  | 'ad_spend'
  | 'leads_generated'
  | 'calls_booked'
  | 'calls_completed'
  | 'students_enrolled'
  | 'revenue_collected'

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
  { key: 'calls_completed', label: 'Calls Completed' },
  { key: 'students_enrolled', label: 'Students Enrolled' },
  { key: 'revenue_collected', label: 'Revenue Collected', prefix: '$' },
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
      m.calls_completed && m.students_enrolled != null
        ? (m.students_enrolled / m.calls_completed) * 100
        : null,
    format: (v) => `${v.toFixed(1)}%`,
  },
]

// ───────────────────────────────────────────────────────────────────────────
// Date helpers
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

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function diffDays(a: Date, b: Date): number {
  return Math.floor(
    (startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000
  )
}

function computeCurrentWeek(launched: Date, today: Date): number {
  return Math.max(1, Math.floor(diffDays(today, launched) / 7) + 1)
}

function weekRange(launched: Date, weekNum: number): { start: Date; end: Date } {
  const start = addDays(launched, (weekNum - 1) * 7)
  const end = addDays(start, 6)
  return { start, end }
}

function formatRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()
  const startOpts: Intl.DateTimeFormatOptions = sameMonth
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric' }
  const endOpts: Intl.DateTimeFormatOptions = sameMonth
    ? { day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' }
  return `${start.toLocaleDateString('en-US', startOpts)} – ${end.toLocaleDateString(
    'en-US',
    endOpts
  )}`
}

function parseNum(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────

export function SuccessTracking({
  clientId,
  launchedDate,
}: SuccessTrackingProps) {
  const supabase = useMemo(() => createClient(), [])
  const launchedAt = useMemo(() => parseLocalDate(launchedDate), [launchedDate])
  const thisWeekNum = useMemo(
    () => computeCurrentWeek(launchedAt, new Date()),
    [launchedAt]
  )

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentWeek, setCurrentWeek] = useState(thisWeekNum)
  const [existingWeeks, setExistingWeeks] = useState<Set<number>>(new Set())

  const [loading, setLoading] = useState(true)
  const [reportExists, setReportExists] = useState(false)
  const [metricInputs, setMetricInputs] = useState<Record<string, string>>({})
  const [bottlenecks, setBottlenecks] = useState('')
  const [nextSteps, setNextSteps] = useState('')
  const [priorities, setPriorities] = useState('')

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const dirtyRef = useRef(false)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Initial data fetch (user + which weeks have reports)
  useEffect(() => {
    let cancelled = false
    async function init() {
      const [{ data: userData }, { data: weeks }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('weekly_reports')
          .select('week_number')
          .eq('client_id', clientId),
      ])
      if (cancelled) return
      setCurrentUserId(userData.user?.id ?? null)
      setExistingWeeks(
        new Set((weeks ?? []).map((w) => (w as { week_number: number }).week_number))
      )
    }
    init()
    return () => {
      cancelled = true
    }
  }, [clientId, supabase])

  // ── Load the active week whenever currentWeek changes
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('weekly_reports')
        .select('*')
        .eq('client_id', clientId)
        .eq('week_number', currentWeek)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        setSaveError(error.message)
      } else {
        const row = data as WeeklyReportRow | null
        if (row) {
          const inputs: Record<string, string> = {}
          if (row.metrics) {
            for (const m of INPUT_METRICS) {
              const v = row.metrics[m.key]
              if (v !== null && v !== undefined) inputs[m.key] = String(v)
            }
          }
          setMetricInputs(inputs)
          setBottlenecks(row.bottlenecks ?? '')
          setNextSteps(row.next_steps ?? '')
          setPriorities(row.current_priorities ?? '')
          setReportExists(true)
        } else {
          setMetricInputs({})
          setBottlenecks('')
          setNextSteps('')
          setPriorities('')
          setReportExists(false)
        }
      }
      dirtyRef.current = false
      setSaveStatus('idle')
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [clientId, currentWeek, supabase])

  // ── Build metric numbers for calculated fields
  const metricNums = useMemo(() => {
    const out: Partial<Record<MetricKey, number>> = {}
    for (const m of INPUT_METRICS) {
      const v = parseNum(metricInputs[m.key] ?? '')
      if (v !== undefined) out[m.key] = v
    }
    return out
  }, [metricInputs])

  // ── Save (manual + debounced auto-save)
  const doSave = useCallback(async (): Promise<boolean> => {
    setSaveStatus('saving')
    setSaveError(null)

    const { start, end } = weekRange(launchedAt, currentWeek)
    const metricsPayload: Record<string, number> = {}
    for (const m of INPUT_METRICS) {
      const v = parseNum(metricInputs[m.key] ?? '')
      if (v !== undefined) metricsPayload[m.key] = v
    }

    const { error } = await supabase.from('weekly_reports').upsert(
      {
        client_id: clientId,
        week_number: currentWeek,
        week_start: toIso(start),
        week_end: toIso(end),
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
      return false
    }

    dirtyRef.current = false
    setReportExists(true)
    setExistingWeeks((prev) => {
      const next = new Set(prev)
      next.add(currentWeek)
      return next
    })
    setSaveStatus('saved')
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    fadeTimerRef.current = setTimeout(() => {
      setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
    }, 2000)
    return true
  }, [
    bottlenecks,
    clientId,
    currentUserId,
    currentWeek,
    launchedAt,
    metricInputs,
    nextSteps,
    priorities,
    supabase,
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

  // Cleanup fade timer
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [])

  // ── Input handlers
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

  // ── Week navigation
  const { start, end } = weekRange(launchedAt, currentWeek)
  const isCurrentWeek = currentWeek === thisWeekNum

  function goPrev() {
    setCurrentWeek((w) => Math.max(1, w - 1))
  }
  function goNext() {
    setCurrentWeek((w) => Math.min(thisWeekNum, w + 1))
  }
  function goThisWeek() {
    setCurrentWeek(thisWeekNum)
  }

  // ── Visible week dots (last 12 ending at thisWeekNum)
  const visibleWeeks = useMemo(() => {
    const startW = Math.max(1, thisWeekNum - 11)
    const arr: number[] = []
    for (let i = startW; i <= thisWeekNum; i++) arr.push(i)
    return arr
  }, [thisWeekNum])

  const showEarlier = thisWeekNum > 12

  return (
    <div>
      {/* Week navigation */}
      <div className="glass-panel-sm p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentWeek <= 1}
            aria-label="Previous week"
            className="w-9 h-9 rounded-full flex items-center justify-center text-kst-muted hover:text-kst-white hover:bg-white/[0.05] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="text-center min-w-0">
            <p className="text-kst-white font-semibold">Week {currentWeek}</p>
            <p className="text-kst-muted text-xs">{formatRange(start, end)}</p>
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={currentWeek >= thisWeekNum}
            aria-label="Next week"
            className="w-9 h-9 rounded-full flex items-center justify-center text-kst-muted hover:text-kst-white hover:bg-white/[0.05] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {showEarlier && (
              <button
                type="button"
                onClick={() => setCurrentWeek(1)}
                className="text-[11px] text-kst-muted hover:text-kst-gold transition-colors mr-1"
              >
                ← Earlier
              </button>
            )}
            {visibleWeeks.map((w) => {
              const filled = existingWeeks.has(w)
              const isCur = w === currentWeek
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => setCurrentWeek(w)}
                  title={`Week ${w}`}
                  aria-label={`Go to week ${w}`}
                  className="p-1 -m-1"
                >
                  <span
                    className={cn(
                      'block rounded-full transition-all',
                      isCur
                        ? 'w-3 h-3 ring-2 ring-kst-gold ring-offset-2 ring-offset-kst-black'
                        : 'w-2 h-2',
                      filled ? 'bg-kst-gold' : 'bg-white/20 hover:bg-white/40'
                    )}
                  />
                </button>
              )
            })}
          </div>

          {!isCurrentWeek && (
            <button
              type="button"
              onClick={goThisWeek}
              className="text-xs px-3 h-8 rounded-full border border-kst-gold/60 text-kst-gold hover:bg-kst-gold/10 transition-colors"
            >
              This Week
            </button>
          )}
        </div>
      </div>

      {/* Report card */}
      <div className="glass-panel p-6 md:p-8 relative">
        {/* Save indicator (top-right) */}
        <div className="absolute top-4 right-4 flex items-center gap-3">
          <SaveIndicator status={saveStatus} />
          <button
            type="button"
            onClick={() => doSave()}
            disabled={saveStatus === 'saving'}
            className="inline-flex items-center gap-1.5 text-xs px-3 h-8 rounded-full border border-kst-gold/60 text-kst-gold hover:bg-kst-gold/10 transition-colors disabled:opacity-60"
          >
            <Save size={12} />
            Save
          </button>
        </div>

        {loading ? (
          <p className="text-kst-muted text-sm">Loading week...</p>
        ) : (
          <div className="space-y-8 mt-6">
            {!reportExists && (
              <p className="text-kst-muted text-xs">
                No report for this week yet. Start filling in the fields to
                create one.
              </p>
            )}

            {/* Metrics */}
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

            {/* Bottlenecks */}
            <Section title="Bottlenecks" icon={<AlertTriangle size={16} />}>
              <ReportTextarea
                value={bottlenecks}
                onChange={handleBottlenecks}
                placeholder="What's blocking progress this week?"
              />
            </Section>

            {/* Next Steps */}
            <Section title="Next Steps" icon={<ArrowRight size={16} />}>
              <ReportTextarea
                value={nextSteps}
                onChange={handleNextSteps}
                placeholder="Action items for the coming week..."
              />
            </Section>

            {/* Current Priorities */}
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
