'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Date helpers
export function parseLocalYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function diffDaysStart(a: Date, b: Date): number {
  const ax = new Date(a)
  ax.setHours(0, 0, 0, 0)
  const bx = new Date(b)
  bx.setHours(0, 0, 0, 0)
  return Math.round((ax.getTime() - bx.getTime()) / 86400000)
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function formatShortDate(d: Date): string {
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return sameYear
    ? `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
    : `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function DueDateBadge({
  dueDate,
  completed,
  readOnly,
  onChange,
  compact,
}: {
  dueDate: string | null
  completed: boolean
  readOnly: boolean
  onChange: (next: string | null) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [flipUp, setFlipUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setFlipUp(spaceBelow < 220)
  }, [open])

  function openEditor() {
    setDraft(dueDate ?? '')
    setOpen(true)
  }

  function save() {
    onChange(draft || null)
    setOpen(false)
  }

  const date = dueDate ? parseLocalYmd(dueDate) : null
  const diff = date ? diffDaysStart(date, startOfToday()) : null

  type State = 'completed' | 'overdue' | 'today' | 'tomorrow' | 'future'
  const state: State | null = date
    ? completed
      ? 'completed'
      : diff! < 0
        ? 'overdue'
        : diff! === 0
          ? 'today'
          : diff! === 1
            ? 'tomorrow'
            : 'future'
    : null

  const label =
    state === 'overdue'
      ? 'Overdue'
      : state === 'today'
        ? 'Due today'
        : date
          ? formatShortDate(date)
          : '+ Due'

  const baseCls = cn(
    'inline-flex items-center gap-1 rounded-full font-medium border shrink-0 transition-colors',
    compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
  )

  const stateCls: Record<State, string> = {
    completed: 'border-white/10 text-kst-muted',
    future: 'border-white/10 text-kst-muted',
    tomorrow: 'border-kst-gold/60 text-kst-gold bg-kst-gold/10',
    today:
      'border-kst-gold/80 text-kst-gold bg-kst-gold/15 font-semibold kst-pulse-gold',
    overdue: '',
  }

  const overdueStyle =
    state === 'overdue'
      ? {
          color: 'rgba(248, 113, 113, 0.85)',
          borderColor: 'rgba(248, 113, 113, 0.3)',
          background: 'rgba(248, 113, 113, 0.06)',
          fontSize: compact ? '9px' : '10px',
        }
      : undefined

  if (readOnly) {
    if (!state) return null
    return (
      <span className={cn(baseCls, stateCls[state])} style={overdueStyle}>
        {state === 'overdue' && (
          <AlertCircle size={compact ? 10 : 11} className="shrink-0" />
        )}
        {label}
      </span>
    )
  }

  const trigger = state ? (
    <button
      type="button"
      onClick={openEditor}
      className={cn(baseCls, stateCls[state], 'hover:brightness-110')}
      style={overdueStyle}
    >
      {state === 'overdue' && (
        <AlertCircle size={compact ? 10 : 11} className="shrink-0" />
      )}
      {label}
    </button>
  ) : (
    <button
      type="button"
      onClick={openEditor}
      className={cn(
        'rounded-full border border-dashed border-white/15 text-kst-muted hover:text-kst-white hover:border-white/30 transition-colors shrink-0',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      )}
    >
      + Due
    </button>
  )

  return (
    <div ref={ref} className="relative shrink-0">
      {trigger}
      {open && (
        <div
          className={cn(
            'absolute z-50 right-0 w-[240px] kst-dropdown p-3 kst-fade-in',
            flipUp ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          <p className="text-[10px] uppercase tracking-wider text-kst-muted mb-2">
            Due Date
          </p>
          <input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-kst-dark border border-white/10 text-kst-white text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors"
          />
          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-kst-muted hover:text-kst-white transition-colors"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              {dueDate && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft('')
                  }}
                  className="text-xs text-kst-muted hover:text-kst-error transition-colors"
                  title="Clear date"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={save}
                className="px-3 h-8 rounded-full bg-kst-gold text-kst-black font-semibold text-xs hover:bg-kst-gold-light transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
