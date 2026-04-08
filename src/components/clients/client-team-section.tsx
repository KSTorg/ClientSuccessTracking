'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  EMPTY_CLIENT_TEAM,
  SPECIALTY_LABELS,
  type ClientTeam,
  type CsmOption,
  type Specialty,
} from '@/lib/types'
import { SpecialtyBadge } from '@/components/team/specialty-badge'

type SlotKey = keyof ClientTeam

interface SlotDef {
  key: SlotKey
  label: string
  match?: Specialty
}

const SLOTS: SlotDef[] = [
  { key: 'csm', label: 'CSM', match: 'csm' },
  { key: 'ads', label: 'Ads', match: 'ads' },
  { key: 'systems', label: 'Systems', match: 'systems' },
  { key: 'organic', label: 'Organic', match: 'organic' },
  { key: 'sales', label: 'Sales', match: 'sales' },
]

/**
 * Auto-fill a ClientTeam from the given team members: for each slot, pick
 * the first team member whose specialty matches. If no matching member
 * exists, the slot stays null.
 */
export function buildDefaultClientTeam(members: CsmOption[]): ClientTeam {
  function pick(spec: Specialty): string | null {
    return members.find((m) => m.specialty === spec)?.id ?? null
  }
  return {
    csm: pick('csm'),
    ads: pick('ads'),
    systems: pick('systems'),
    organic: pick('organic'),
    sales: pick('sales'),
  }
}

function initialsOf(name: string | null): string {
  const t = (name ?? '').trim()
  if (!t) return '?'
  const parts = t.split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function useClickOutside(
  ref: React.RefObject<HTMLDivElement | null>,
  open: boolean,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, ref])
}

export function ClientTeamSection({
  clientId,
  initialTeam,
  teamMembers,
}: {
  clientId: string
  initialTeam: ClientTeam
  teamMembers: CsmOption[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [team, setTeam] = useState<ClientTeam>(initialTeam)
  const [savingSlot, setSavingSlot] = useState<SlotKey | null>(null)
  const autoFilledRef = useRef(false)

  // Auto-fill defaults on first mount if every slot is null (new client
  // that hasn't had a team assigned yet). Persists immediately so the
  // suggestion becomes the saved state.
  useEffect(() => {
    if (autoFilledRef.current) return
    autoFilledRef.current = true

    const allNull = Object.values(team).every((v) => v === null)
    if (!allNull) return

    const suggested = buildDefaultClientTeam(teamMembers)
    const anyFilled = Object.values(suggested).some((v) => v !== null)
    if (!anyFilled) return

    setTeam(suggested)
    supabase
      .from('clients')
      .update({ client_team: suggested })
      .eq('id', clientId)
      .then(({ error }) => {
        if (error) {
          console.warn('[client team] auto-fill save failed:', error.message)
          // Roll back local state so the UI reflects the DB
          setTeam(initialTeam)
          return
        }
        router.refresh()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function updateSlot(slot: SlotKey, memberId: string | null) {
    const prev = team
    const next: ClientTeam = { ...team, [slot]: memberId }
    setTeam(next)
    setSavingSlot(slot)
    const { error } = await supabase
      .from('clients')
      .update({ client_team: next })
      .eq('id', clientId)
    setSavingSlot(null)
    if (error) {
      setTeam(prev)
      alert(`Could not update ${slot.toUpperCase()}: ${error.message}`)
      return
    }
    router.refresh()
  }

  return (
    <div className="glass-panel p-5 md:p-6 mb-6">
      <h3 className="text-kst-white font-semibold mb-4">Client Team</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {SLOTS.map((s) => (
          <TeamSlotPicker
            key={s.key}
            label={s.label}
            match={s.match}
            value={team[s.key]}
            saving={savingSlot === s.key}
            teamMembers={teamMembers}
            onChange={(id) => updateSlot(s.key, id)}
          />
        ))}
      </div>
    </div>
  )
}

export function TeamSlotPicker({
  label,
  match,
  value,
  saving = false,
  teamMembers,
  onChange,
}: {
  label: string
  match?: Specialty
  value: string | null
  saving?: boolean
  teamMembers: CsmOption[]
  onChange: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, open, () => setOpen(false))

  const assigned = value ? teamMembers.find((m) => m.id === value) ?? null : null

  // Sort: members whose specialty matches this slot first, then alphabetically
  const sorted = [...teamMembers].sort((a, b) => {
    const am = match && a.specialty === match ? 0 : 1
    const bm = match && b.specialty === match ? 0 : 1
    if (am !== bm) return am - bm
    return (a.full_name ?? '').localeCompare(b.full_name ?? '')
  })

  return (
    <div ref={ref} className="relative">
      <p
        className={cn(
          'text-[11px] uppercase tracking-wider mb-2 transition-colors',
          assigned ? 'text-kst-gold' : 'text-kst-muted'
        )}
      >
        {label}
      </p>
      <button
        type="button"
        disabled={saving}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-3 h-14 rounded-xl glass-panel-sm glass-panel-interactive disabled:opacity-60 text-left'
        )}
        style={
          assigned
            ? { borderColor: 'rgba(201, 168, 76, 0.35)' }
            : undefined
        }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {assigned ? (
          <>
            <div className="w-9 h-9 rounded-full border border-kst-gold/60 text-kst-gold flex items-center justify-center text-[11px] font-semibold bg-kst-gold/5 shrink-0">
              {initialsOf(assigned.full_name)}
            </div>
            <span className="text-kst-white text-sm truncate flex-1">
              {assigned.full_name ?? 'Unnamed'}
            </span>
          </>
        ) : (
          <>
            <div className="w-9 h-9 rounded-full border border-dashed border-white/15 flex items-center justify-center shrink-0">
              <span className="text-kst-muted text-sm">+</span>
            </div>
            <span className="text-kst-muted text-sm italic flex-1">
              Unassigned
            </span>
          </>
        )}
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-2 max-h-64 overflow-y-auto kst-dropdown p-1 kst-fade-in">
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            className={cn(
              'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-white/[0.06] transition-colors',
              value === null && 'bg-kst-gold/10'
            )}
          >
            <span className="text-kst-muted italic">Unassigned</span>
            {value === null && <Check size={13} className="text-kst-gold" />}
          </button>
          {sorted.map((m) => {
            const active = m.id === value
            const isMatch = !!match && m.specialty === match
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
                title={
                  isMatch
                    ? `Specialty matches: ${SPECIALTY_LABELS[m.specialty!]}`
                    : undefined
                }
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
                {isMatch && m.specialty && (
                  <SpecialtyBadge specialty={m.specialty} />
                )}
                {active && (
                  <Check size={13} className="text-kst-gold shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Exported for consumers that need to construct a default team
export { EMPTY_CLIENT_TEAM }
