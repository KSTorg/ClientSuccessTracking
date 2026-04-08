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

/**
 * SVG-based weekly trend chart. Two polyline series (revenue + ad spend)
 * scaled to a shared y-axis, with a subtle gold area fill under the
 * revenue line and muted grid lines. Server-rendered, no client JS.
 */
export function WeeklyTrendChart({ data }: { data: WeeklyTrendPoint[] }) {
  const points = data.map((d) => ({
    revenue: Number(d.revenue ?? 0) || 0,
    adSpend: Number(d.ad_spend ?? 0) || 0,
    week: d.week_start,
  }))

  const width = 800
  const height = 240
  const padTop = 20
  const padBottom = 40
  const padLeft = 12
  const padRight = 20
  const chartTop = padTop
  const chartBottom = height - padBottom
  const chartLeft = padLeft
  const chartRight = width - padRight
  const chartWidth = chartRight - chartLeft
  const chartHeight = chartBottom - chartTop

  const hasData = points.length > 0
  const maxValue = hasData
    ? Math.max(
        1,
        ...points.map((p) => Math.max(p.revenue, p.adSpend))
      )
    : 1

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

            {/* Horizontal grid lines */}
            {[0.25, 0.5, 0.75, 1].map((frac) => (
              <line
                key={frac}
                x1={chartLeft}
                y1={chartBottom - frac * chartHeight}
                x2={chartRight}
                y2={chartBottom - frac * chartHeight}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
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

          {/* Max label at the top-right */}
          <p className="absolute top-0 right-3 text-[10px] text-kst-muted/60">
            Max {formatCurrencyCompact(maxValue)}
          </p>
        </div>
      )}
    </div>
  )
}
