'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type TaskStatus,
  STATUS_LABELS,
  TEAM_STATUSES,
  CLIENT_STATUSES,
} from './types'

export function StatusGlyph({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'completed':
      return (
        <div className="w-6 h-6 rounded-full bg-kst-gold flex items-center justify-center shadow-[0_0_12px_rgba(201,168,76,0.4)]">
          <Check size={14} className="text-kst-black" strokeWidth={3} />
        </div>
      )
    case 'in_review':
      return (
        <div className="w-6 h-6 rounded-full border-2 border-kst-gold flex items-center justify-center bg-kst-gold/10">
          <Clock size={11} className="text-kst-gold" />
        </div>
      )
    case 'in_progress':
      return (
        <div className="w-6 h-6 rounded-full border-2 border-kst-gold flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-kst-gold animate-pulse" />
        </div>
      )
    default:
      return (
        <div className="w-6 h-6 rounded-full border-2 border-white/20 group-hover:border-white/40 transition-colors" />
      )
  }
}

export function StatusPicker({
  status,
  isTeamView,
  onChange,
}: {
  status: TaskStatus
  isTeamView: boolean
  onChange: (next: TaskStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
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
    if (!open || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setFlipUp(spaceBelow < 180)
  }, [open])

  const display: TaskStatus =
    !isTeamView && status === 'in_review' ? 'in_progress' : status

  const options: TaskStatus[] = isTeamView ? TEAM_STATUSES : CLIENT_STATUSES

  return (
    <div ref={wrapRef} className="relative mt-0.5 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="block hover:scale-110 transition-transform"
        aria-label="Change task status"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <StatusGlyph status={display} />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 left-0 min-w-[180px] kst-dropdown p-1 kst-fade-in',
            flipUp ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          {options.map((opt) => {
            const active = opt === status
            return (
              <button
                key={opt}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(opt)
                  setOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-white/[0.06] transition-colors',
                  active && 'bg-kst-gold/10'
                )}
              >
                <StatusGlyph status={opt} />
                <span
                  className={cn(
                    'flex-1',
                    active ? 'text-kst-white' : 'text-kst-muted'
                  )}
                >
                  {STATUS_LABELS[opt]}
                </span>
                {active && <Check size={14} className="text-kst-gold" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
