'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, DollarSign, Plus, Search, Users, X } from 'lucide-react'
import { AddClientModal } from '@/components/AddClientModal'
import { StatusBadge } from '@/components/clients/status-badge'
import { ProgramBadge } from '@/components/clients/program-badge'
import { cn, formatDate } from '@/lib/utils'
import {
  CLIENT_STATUSES,
  PROGRAM_LABELS,
  type ClientStatus,
  type ClientWithCsmAndStats,
  type CsmOption,
  type Program,
} from '@/lib/types'

interface ClientsViewProps {
  clients: ClientWithCsmAndStats[]
  csms: CsmOption[]
  clientsWithSubs?: string[]
}

type StatusFilter = ClientStatus | 'all' | 'active'
type ProgramFilter = Program | 'all'
type SortKey = 'company' | 'contact' | 'status' | 'program' | 'joined' | 'ends' | 'progress'
type SortDir = 'asc' | 'desc'

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  ...CLIENT_STATUSES.map((s) => ({
    value: s as StatusFilter,
    label: s.charAt(0).toUpperCase() + s.slice(1),
  })),
]

const PROGRAM_FILTERS: { value: ProgramFilter; label: string }[] = [
  { value: 'all', label: 'All Programs' },
  { value: 'educator_incubator', label: PROGRAM_LABELS.educator_incubator },
  { value: 'accelerator', label: PROGRAM_LABELS.accelerator },
]

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'contact', label: 'Contact' },
  { key: 'status', label: 'Status' },
  { key: 'program', label: 'Program' },
  { key: 'joined', label: 'Joined' },
  { key: 'ends', label: 'Ends' },
  { key: 'progress', label: 'Progress' },
]

function getSortValue(c: ClientWithCsmAndStats, key: SortKey, hasSubs?: boolean): string | number {
  switch (key) {
    case 'company': return c.company_name.toLowerCase()
    case 'contact': return c.contact_name.toLowerCase()
    case 'status': return c.status
    case 'program': return c.program
    case 'joined': return c.joined_date ?? c.created_at
    case 'ends': return hasSubs ? 'aaa' : (c.program_end_date ?? 'zzz')
    case 'progress': return c.task_total > 0 ? c.task_completed / c.task_total : 0
    default: return ''
  }
}

export function ClientsView({ clients, csms, clientsWithSubs }: ClientsViewProps) {
  const searchParams = useSearchParams()
  const filterParam = searchParams.get('filter')

  const initialStatus: StatusFilter = (() => {
    if (filterParam === 'onboarding') return 'onboarding'
    if (filterParam === 'launched') return 'launched'
    if (filterParam === 'active') return 'active'
    if (filterParam === 'ending_soon') return 'all'
    return 'active'
  })()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus)
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('joined')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showEndingSoon, setShowEndingSoon] = useState(filterParam === 'ending_soon')

  function handleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const todayIso = new Date().toISOString().slice(0, 10)
    const in7 = new Date()
    in7.setDate(in7.getDate() + 7)
    const in7Iso = in7.toISOString().slice(0, 10)

    const base = clients.filter((c) => {
      if (statusFilter === 'active' && c.status !== 'onboarding' && c.status !== 'launched') return false
      else if (statusFilter !== 'all' && statusFilter !== 'active' && c.status !== statusFilter) return false
      if (programFilter !== 'all' && c.program !== programFilter) return false
      if (showEndingSoon) {
        const end = c.program_end_date
        if (!end || end < todayIso || end > in7Iso) return false
      }
      if (!q) return true
      return (
        c.company_name.toLowerCase().includes(q) ||
        c.contact_name.toLowerCase().includes(q) ||
        c.contact_email.toLowerCase().includes(q)
      )
    })

    // Sort
    const sorted = [...base].sort((a, b) => {
      const va = getSortValue(a, sortBy, clientsWithSubs?.includes(a.id))
      const vb = getSortValue(b, sortBy, clientsWithSubs?.includes(b.id))
      let cmp = 0
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      else cmp = String(va).localeCompare(String(vb))
      return sortDir === 'desc' ? -cmp : cmp
    })
    return sorted
  }, [clients, search, statusFilter, programFilter, sortBy, sortDir, clientsWithSubs, showEndingSoon])

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8 gap-4">
        <h1
          className="text-5xl md:text-6xl text-kst-gold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Clients
        </h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold hover:bg-kst-gold-light transition-colors text-sm"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Client</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Search & filters */}
      <div className="glass-panel-sm p-4 mb-6 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-kst-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company, contact or email..."
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 h-9 rounded-full text-xs font-medium border transition-colors',
                statusFilter === f.value
                  ? 'border-kst-gold/60 text-kst-gold bg-kst-gold/10'
                  : 'border-white/10 text-kst-muted hover:text-kst-white hover:border-white/20'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Program filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {PROGRAM_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setProgramFilter(f.value)}
            className={cn(
              'px-3 h-9 rounded-full text-xs font-medium border transition-colors',
              programFilter === f.value
                ? 'border-kst-gold/60 text-kst-gold bg-kst-gold/10'
                : 'border-white/10 text-kst-muted hover:text-kst-white hover:border-white/20'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Ending soon filter pill */}
      {showEndingSoon && (
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full border border-kst-gold/40 bg-kst-gold/10 text-kst-gold text-xs font-medium">
            Ending within 7 days
            <button
              type="button"
              onClick={() => setShowEndingSoon(false)}
              className="ml-0.5 hover:text-kst-white transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        </div>
      )}

      {/* Empty state */}
      {clients.length === 0 ? (
        <div className="glass-panel p-12 md:p-16 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center mb-5">
            <Users size={28} className="text-kst-muted" />
          </div>
          <p className="text-kst-white text-lg font-semibold">
            No clients yet
          </p>
          <p className="text-kst-muted text-sm mt-1 mb-6 max-w-xs">
            Add your first client to get started. They&apos;ll receive a
            login to track their onboarding progress.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold hover:bg-kst-gold-light transition-colors text-sm shadow-[0_8px_32px_rgba(201,168,76,0.25)]"
          >
            <Plus size={16} />
            Add Client
          </button>
        </div>
      ) : (
        <>
          {/* ── Mobile card layout (below md) ─────────────────────────── */}
          <div className="md:hidden flex flex-col gap-3">
            {filtered.map((c) => {
              const pct =
                c.task_total > 0
                  ? Math.round((c.task_completed / c.task_total) * 100)
                  : 0
              const hasSubs = clientsWithSubs?.includes(c.id)

              return (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}`}
                  className="glass-panel-sm glass-panel-interactive block px-4 py-4"
                >
                  {/* Row 1: Company name + badges */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-kst-white font-semibold text-sm truncate">
                      {c.company_name}
                    </span>
                    {hasSubs && (
                      <DollarSign size={12} className="text-kst-gold shrink-0" />
                    )}
                    {c.is_imported && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-kst-muted shrink-0">
                        imported
                      </span>
                    )}
                  </div>

                  {/* Row 2: Contact + CSM */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-kst-muted text-xs truncate">
                      {c.contact_name}
                    </span>
                    <span className="text-xs truncate ml-2">
                      {c.csm?.full_name ? (
                        <>
                          <span className="text-white/30 mr-1">CSM</span>
                          <span className="text-kst-white">{c.csm.full_name}</span>
                        </>
                      ) : (
                        <span className="text-white/30">No CSM</span>
                      )}
                    </span>
                  </div>

                  {/* Row 3: Status + Program badges */}
                  <div className="flex items-center gap-2 mb-3">
                    <StatusBadge status={c.status} />
                    <ProgramBadge program={c.program} short />
                  </div>

                  {/* Row 4: Dates */}
                  <div className="flex items-center gap-4 text-xs mb-3">
                    <div>
                      <span className="text-white/30 mr-1">Joined</span>
                      <span className="text-kst-muted">
                        {formatDate(c.joined_date ?? c.created_at)}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/30 mr-1">Ends</span>
                      <EndDateInline
                        programEndDate={c.program_end_date}
                        hasActiveSubs={!!hasSubs}
                      />
                    </div>
                  </div>

                  {/* Row 5: Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full bg-kst-gold rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-kst-muted text-xs w-8 text-right shrink-0">
                      {pct}%
                    </span>
                  </div>
                </Link>
              )
            })}
            {filtered.length === 0 && (
              <div className="glass-panel-sm p-8 text-center text-kst-muted text-sm">
                No clients match your filters.
              </div>
            )}
          </div>

          {/* ── Desktop table (md and up) ──────────────────────────────── */}
          <div className="hidden md:block glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm"
                style={{ tableLayout: 'fixed' }}
              >
                <colgroup>
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider border-b border-white/[0.06]">
                    {COLUMNS.map((col) => {
                      const isActive = sortBy === col.key
                      return (
                        <th key={col.key} className="px-3 py-3 font-medium">
                          <button
                            type="button"
                            onClick={() => handleSort(col.key)}
                            className={cn(
                              'flex items-center gap-1 transition-colors',
                              isActive ? 'text-kst-gold' : 'text-kst-muted hover:text-kst-white'
                            )}
                          >
                            <span className="truncate">{col.label}</span>
                            {isActive && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                          </button>
                        </th>
                      )
                    })}
                    <th className="px-3 py-3 font-medium text-kst-muted">
                      <div className="truncate">CSM</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const pct =
                      c.task_total > 0
                        ? Math.round((c.task_completed / c.task_total) * 100)
                        : 0
                    const hasSubs = clientsWithSubs?.includes(c.id)
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.03] transition-colors cursor-pointer"
                        onClick={() => {
                          window.location.href = `/clients/${c.id}`
                        }}
                      >
                        <td className="px-3 py-4">
                          <Link
                            href={`/clients/${c.id}`}
                            className="flex items-center gap-1.5 text-kst-white font-medium hover:text-kst-gold transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="truncate">{c.company_name}</span>
                            {hasSubs && (
                              <DollarSign size={12} className="text-kst-gold shrink-0" />
                            )}
                            {c.is_imported && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-kst-muted shrink-0">
                                imported
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="px-3 py-4">
                          <div className="truncate text-kst-white">
                            {c.contact_name}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="truncate">
                            <StatusBadge status={c.status} />
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="truncate">
                            <ProgramBadge program={c.program} />
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="truncate text-kst-muted">
                            {formatDate(c.joined_date ?? c.created_at)}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <EndDateInline
                            programEndDate={c.program_end_date}
                            hasActiveSubs={!!hasSubs}
                          />
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full bg-kst-gold rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-kst-muted text-xs w-8 text-right shrink-0">
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="truncate">
                            {c.csm?.full_name ? (
                              <span className="text-kst-white">
                                {c.csm.full_name}
                              </span>
                            ) : (
                              <span className="text-kst-muted">Unassigned</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-10 text-center text-kst-muted text-sm"
                      >
                        No clients match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <AddClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        csms={csms}
      />
    </div>
  )
}

// ─── Shared end-date helper ────────────────────────────────────────────────

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function EndDateInline({ programEndDate, hasActiveSubs }: { programEndDate: string | null; hasActiveSubs: boolean }) {
  if (hasActiveSubs) {
    return <span className="text-kst-success text-sm truncate">Active</span>
  }

  const date = programEndDate
  if (!date) return <span className="text-kst-muted truncate">—</span>

  const todayIso = new Date().toISOString().slice(0, 10)
  const in7 = new Date()
  in7.setDate(in7.getDate() + 7)
  const in7Iso = in7.toISOString().slice(0, 10)

  const [, m, d] = date.split('-').map(Number)
  const short = `${MONTH_SHORT[(m ?? 1) - 1]} ${d}`

  let color = 'text-kst-muted'
  let label = short
  if (date < todayIso) {
    color = 'text-red-400'
    label = `Ended ${short}`
  } else if (date <= in7Iso) {
    color = 'text-kst-gold'
  }

  return <span className={cn('truncate text-sm', color)}>{label}</span>
}
