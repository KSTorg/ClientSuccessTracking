import { formatCurrencyCompact } from '@/lib/format'

export interface WeeklyTrendPoint {
  week_start: string | null
  revenue: number | null
  ad_spend: number | null
}

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

function formatWeekLabel(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${MONTH_SHORT[m - 1]} ${d}`
}

/** Get the Monday of the current week (ISO week starts Monday) */
function getCurrentWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1 // Monday = 0 offset
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  return monday.toISOString().slice(0, 10)
}

/**
 * SVG-based weekly trend chart. Two polyline series (revenue + ad spend)
 * scaled to a shared y-axis, with a subtle gold area fill under the
 * revenue line and muted grid lines. Server-rendered, no client JS.
 */
export function WeeklyTrendChart({ data }: { data: WeeklyTrendPoint[] }) {
  const currentWeekStart = getCurrentWeekStart()

  const points = data
    .filter((d) => d.week_start !== currentWeekStart)
    .map((d) => ({
      revenue: Number(d.revenue ?? 0) || 0,
      adSpend: Number(d.ad_spend ?? 0) || 0,
      week: d.week_start,
    }))

  const width = 800
  const height = 240
  const padTop = 20
  const padBottom = 40
  const padLeft = 12
  const padRight = 60
  const chartTop = padTop
  const chartBottom = height - padBottom
  const chartLeft = padLeft
  const chartRight = width - padRight
  const chartWidth = chartRight - chartLeft
  const chartHeight = chartBottom - chartTop

  const hasData = points.length > 0
  const rawMax = hasData
    ? Math.max(1, ...points.map((p) => Math.max(p.revenue, p.adSpend)))
    : 1

  // Round up to a nice ceiling divisible by 4
  const TICK_COUNT = 4
  const step = (() => {
    const raw = rawMax / TICK_COUNT
    const mag = Math.pow(10, Math.floor(Math.log10(raw)))
    const normalized = raw / mag // e.g. 5.876
    const niceSteps = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]
    return mag * (niceSteps.find((n) => n >= normalized) ?? 10)
  })()
  const maxValue = step * TICK_COUNT

  // Y-axis ticks: 0, step, 2*step, 3*step, 4*step
  const yTicks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
    const value = i * step
    return {
      value,
      y: chartBottom - (value / maxValue) * chartHeight,
    }
  })

  function xFor(i: number): number {
    if (points.length <= 1) return chartLeft + chartWidth / 2
    return chartLeft + (i / (points.length - 1)) * chartWidth
  }

  function yFor(value: number): number {
    return chartBottom - (value / maxValue) * chartHeight
  }

  const revenuePath = points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.revenue).toFixed(1)}`
    )
    .join(' ')
  const adSpendPath = points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.adSpend).toFixed(1)}`
    )
    .join(' ')

  const revenueArea =
    points.length > 0
      ? `${revenuePath} L ${xFor(points.length - 1).toFixed(1)} ${chartBottom} L ${xFor(0).toFixed(1)} ${chartBottom} Z`
      : ''

  return (
    <div className="glass-panel p-6 md:p-8">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h3 className="text-kst-white font-semibold">Weekly Trend</h3>
          <p className="text-kst-muted text-xs mt-0.5">
            Revenue vs. ad spend, last {points.length || 0} weeks
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-kst-gold rounded" />
            <span className="text-kst-muted">Revenue</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-white/40 rounded" />
            <span className="text-kst-muted">Ad Spend</span>
          </span>
        </div>
      </div>

      {!hasData ? (
        <p className="text-kst-muted text-sm text-center py-12">
          No weekly reports yet
        </p>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="kst-revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#C9A84C" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines + Y-axis labels */}
            {yTicks.map(({ value, y }) => (
              <g key={value}>
                {value > 0 && (
                  <line
                    x1={chartLeft}
                    y1={y}
                    x2={chartRight}
                    y2={y}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="1"
                  />
                )}
                <text
                  x={chartRight + 8}
                  y={y + 4}
                  fontSize="10"
                  fill="rgba(255,255,255,0.35)"
                  textAnchor="start"
                >
                  {formatCurrencyCompact(value)}
                </text>
              </g>
            ))}

            {/* Revenue area fill */}
            <path d={revenueArea} fill="url(#kst-revenue-fill)" />

            {/* Ad spend line */}
            <path
              d={adSpendPath}
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Ad spend dots */}
            {points.map((p, i) => (
              <circle
                key={`ads-${i}`}
                cx={xFor(i)}
                cy={yFor(p.adSpend)}
                r="2.5"
                fill="rgba(255,255,255,0.4)"
              />
            ))}

            {/* Revenue line */}
            <path
              d={revenuePath}
              fill="none"
              stroke="#C9A84C"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Dots on revenue points */}
            {points.map((p, i) => (
              <circle
                key={`rev-${i}`}
                cx={xFor(i)}
                cy={yFor(p.revenue)}
                r="3"
                fill="#C9A84C"
              />
            ))}

            {/* X-axis labels */}
            {points.map((p, i) => {
              const showLabel =
                points.length <= 6 ||
                i === 0 ||
                i === points.length - 1 ||
                i % 2 === 0
              if (!showLabel) return null
              return (
                <text
                  key={`lbl-${i}`}
                  x={xFor(i)}
                  y={chartBottom + 22}
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgba(255,255,255,0.45)"
                >
                  {formatWeekLabel(p.week)}
                </text>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}
