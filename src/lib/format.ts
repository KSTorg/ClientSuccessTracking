/**
 * Small set of formatters used across the dashboard analytics.
 * Every formatter accepts null/undefined/NaN and returns a tidy "—"
 * fallback so analytics cards can render before any data exists.
 */

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'string' ? Number(value) : (value as number)
  return Number.isFinite(n) ? n : null
}

export function formatCurrency(value: unknown, decimals: number = 2): string {
  const n = asNumber(value)
  if (n === null) return '—'
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/** Like formatCurrency but drops cents for large round numbers. */
export function formatCurrencyCompact(value: unknown): string {
  const n = asNumber(value)
  if (n === null) return '—'
  if (Math.abs(n) >= 1000) {
    return `$${n.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`
  }
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatNumber(value: unknown): string {
  const n = asNumber(value)
  if (n === null) return '—'
  return n.toLocaleString('en-US')
}

export function formatPercent(value: unknown, decimals: number = 1): string {
  const n = asNumber(value)
  if (n === null) return '—'
  return `${n.toFixed(decimals)}%`
}

export function formatRoas(value: unknown): string {
  const n = asNumber(value)
  if (n === null) return '—'
  return `${n.toFixed(1)}x`
}
