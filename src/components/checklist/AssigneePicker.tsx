'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SPECIALTY_LABELS, type Specialty } from '@/lib/types'
import { SpecialtyBadge } from '@/components/team/specialty-badge'
import type { ChecklistTeamMember } from './types'

function initialsOf(name: string | null): string {
  const t = (name ?? '').trim()
  if (!t) return '?'
  const parts = t.split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

const SPECIALTY_GROUP_ORDER: (Specialty | 'none')[] = [
  'ads',
  'systems',
  'organic',
  'sales',
  'none',
]

export function AssigneePicker({
  assigneeId,
  teamMembers,
  teamById,
  clientContactName,
  onChange,
  compact,
}: {
  assigneeId: string | null
  teamMembers: ChecklistTeamMember[]
  teamById: Map<string, ChecklistTeamMember>
  clientContactName: string | null
  onChange: (next: string | null) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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
    setFlipUp(spaceBelow < 260)
  }, [open])

  const assignee = assigneeId ? teamById.get(assigneeId) ?? null : null

  const grouped = useMemo(() => {
    const m = new Map<Specialty | 'none', ChecklistTeamMember[]>()
    for (const t of teamMembers) {
      const key = (t.specialty ?? 'none') as Specialty | 'none'
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(t)
    }
    return SPECIALTY_GROUP_ORDER.map(
      (k) => [k, m.get(k) ?? []] as const
    ).filter(([, arr]) => arr.length > 0)
  }, [teamMembers])

  const sizeCls = compact
    ? 'h-7 w-7 text-[10px]'
    : 'h-8 w-8 text-[10px]'

  const assigneeFirstName =
    (assignee?.full_name ?? '').trim().split(/\s+/)[0] ?? ''

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        aria-label="Assign task"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {assignee ? (
          <>
            <div
              className={cn(
                'rounded-full border border-kst-gold/60 text-kst-gold flex items-center justify-center bg-white/[0.02] font-semibold shrink-0',
                sizeCls
              )}
              title={assignee.full_name ?? 'Unnamed'}
            >
              {initialsOf(assignee.full_name)}
            </div>
            <span className="hidden sm:inline text-[11px] text-kst-white whitespace-nowrap max-w-[8rem] truncate">
              {assigneeFirstName || 'Unnamed'}
            </span>
            {assignee.specialty && (
              <span className="hidden md:inline">
                <SpecialtyBadge specialty={assignee.specialty} />
              </span>
            )}
          </>
        ) : clientContactName ? (
          <span className="text-[11px] text-kst-muted px-1 truncate max-w-[8rem]">
            {clientContactName}
          </span>
        ) : (
          <span className="text-[11px] text-kst-muted italic px-1">
            Unassigned
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 right-0 min-w-[220px] max-h-[280px] overflow-y-auto kst-dropdown p-1 kst-fade-in',
            flipUp ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            className={cn(
              'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-white/[0.06] transition-colors',
              assigneeId === null && 'bg-kst-gold/10'
            )}
          >
            <span className="text-kst-muted italic">
              {clientContactName
                ? `Client (${clientContactName})`
                : 'Unassigned'}
            </span>
            {assigneeId === null && <Check size={13} className="text-kst-gold" />}
          </button>
          {grouped.map(([groupKey, members]) => (
            <div key={groupKey}>
              <p className="text-[9px] uppercase tracking-wider text-kst-muted/70 px-3 pt-2 pb-1">
                {groupKey === 'none' ? 'Other' : SPECIALTY_LABELS[groupKey]}
              </p>
              {members.map((m) => {
                const active = m.id === assigneeId
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onChange(m.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-white/[0.06] transition-colors',
                      active && 'bg-kst-gold/10'
                    )}
                  >
                    <div className="w-7 h-7 rounded-full border border-kst-gold/60 text-kst-gold flex items-center justify-center text-[10px] font-semibold bg-white/[0.02] shrink-0">
                      {initialsOf(m.full_name)}
                    </div>
                    <span
                      className={cn(
                        'flex-1 truncate',
                        active ? 'text-kst-white' : 'text-kst-muted'
                      )}
                    >
                      {m.full_name ?? 'Unnamed'}
                    </span>
                    {active && (
                      <Check size={13} className="text-kst-gold shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function TeamAssigneeTag({
  assignee,
  compact,
}: {
  assignee: ChecklistTeamMember | null
  compact?: boolean
}) {
  const first =
    (assignee?.full_name ?? '').trim().split(/\s+/)[0] ?? 'KST Team'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium border border-white/15 text-kst-muted shrink-0',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      )}
    >
      {assignee ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-kst-gold/70" />
          {first}
        </>
      ) : (
        'KST Team'
      )}
    </span>
  )
}
