'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
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
}

type StatusFilter = ClientStatus | 'all'
type ProgramFilter = Program | 'all'

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...CLIENT_STATUSES.map((s) => ({
    value: s,
    label: s.charAt(0).toUpperCase() + s.slice(1),
  })),
]

const PROGRAM_FILTERS: { value: ProgramFilter; label: string }[] = [
  { value: 'all', label: 'All Programs' },
  { value: 'educator_incubator', label: PROGRAM_LABELS.educator_incubator },
  { value: 'accelerator', label: PROGRAM_LABELS.accelerator },
]

export function ClientsView({ clients, csms }: ClientsViewProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [programFilter, setProgramFilter] = useState<ProgramFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (programFilter !== 'all' && c.program !== programFilter) return false
      if (!q) return true
      return (
        c.company_name.toLowerCase().includes(q) ||
        c.contact_name.toLowerCase().includes(q) ||
        c.contact_email.toLowerCase().includes(q)
      )
    })
  }, [clients, search, statusFilter, programFilter])

  return (
    <div className="max-w-7xl">
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
          Add Client
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

      {/* Table */}
      {clients.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <p className="text-kst-muted text-sm mb-6">
            No clients yet. Add your first client to get started.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold hover:bg-kst-gold-light transition-colors text-sm"
          >
            <Plus size={16} />
            Add Client
          </button>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="text-left text-kst-muted text-xs uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium w-[140px]">Contact</th>
                  <th className="px-4 py-3 font-medium w-[200px] hidden xl:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-3 font-medium w-[100px]">Status</th>
                  <th className="px-4 py-3 font-medium w-[60px]">Program</th>
                  <th className="px-4 py-3 font-medium w-[100px] hidden lg:table-cell">
                    CSM
                  </th>
                  <th className="px-4 py-3 font-medium w-[90px] hidden lg:table-cell">
                    Joined
                  </th>
                  <th className="px-4 py-3 font-medium w-[120px]">Progress</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const pct =
                    c.task_total > 0
                      ? Math.round((c.task_completed / c.task_total) * 100)
                      : 0
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      onClick={() => {
                        window.location.href = `/clients/${c.id}`
                      }}
                    >
                      <td className="px-4 py-4">
                        <Link
                          href={`/clients/${c.id}`}
                          className="block text-kst-white font-medium hover:text-kst-gold transition-colors truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.company_name}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-kst-white truncate">
                        {c.contact_name}
                      </td>
                      <td className="px-4 py-4 text-kst-muted truncate hidden xl:table-cell">
                        {c.contact_email}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-4">
                        <ProgramBadge program={c.program} short />
                      </td>
                      <td className="px-4 py-4 truncate hidden lg:table-cell">
                        {c.csm?.full_name ? (
                          <span className="text-kst-white">
                            {c.csm.full_name}
                          </span>
                        ) : (
                          <span className="text-kst-muted">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-kst-muted hidden lg:table-cell whitespace-nowrap">
                        {formatDate(c.joined_date ?? c.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full bg-kst-gold rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-kst-muted text-xs w-8 text-right">
                            {pct}%
                          </span>
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
      )}

      <AddClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        csms={csms}
      />
    </div>
  )
}
