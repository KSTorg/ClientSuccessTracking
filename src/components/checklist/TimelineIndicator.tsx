'use client'

import { cn } from '@/lib/utils'
import { parseLocalYmd, startOfToday, diffDaysStart } from './DueDateBadge'
import { TIMELINE_TOTAL_DAYS } from './types'

export function TimelineIndicator({ joinedDate }: { joinedDate: string }) {
  const start = parseLocalYmd(joinedDate)
  const now = startOfToday()
  const rawDay = diffDaysStart(now, start) + 1
  const dayNumber = Math.max(1, rawDay)
  const extended = dayNumber > TIMELINE_TOTAL_DAYS
  const pct = Math.min(100, (dayNumber / TIMELINE_TOTAL_DAYS) * 100)

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-kst-muted text-xs uppercase tracking-wider">
          Timeline
        </span>
        <span
          className={cn(
            'text-xs',
            extended ? 'text-kst-muted' : 'text-kst-white'
          )}
        >
          Day {dayNumber}
          {extended ? ' (extended)' : ` of ${TIMELINE_TOTAL_DAYS}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-kst-surface overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-kst-gold to-kst-gold-light transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
