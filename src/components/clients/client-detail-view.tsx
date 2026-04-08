'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ChevronDown, Edit3, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SetupChecklist } from '@/components/SetupChecklist'
import { StatusBadge } from '@/components/clients/status-badge'
import { cn, formatDate } from '@/lib/utils'
import {
  CLIENT_STATUSES,
  type ClientStatus,
  type ClientWithCsm,
  type CsmOption,
} from '@/lib/types'

interface ClientDetailViewProps {
  client: ClientWithCsm
  csms: CsmOption[]
}

const STATUS_DOT: Record<ClientStatus, string> = {
  onboarding: 'bg-kst-gold',
  launched: 'bg-kst-success',
  paused: 'bg-kst-warning',
  churned: 'bg-kst-error',
}

const STATUS_LABEL: Record<ClientStatus, string> = {
  onboarding: 'Onboarding',
  launched: 'Launched',
  paused: 'Paused',
  churned: 'Churned',
}

type Tab = 'setup' | 'success'

export function ClientDetailView({ client, csms }: ClientDetailViewProps) {
  const router = useRouter()
  const supabase = createClient()

  const [status, setStatus] = useState<ClientStatus>(client.status)
  const [csmId, setCsmId] = useState<string>(client.assigned_csm ?? '')
  const [savingField, setSavingField] = useState<'status' | 'csm' | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('setup')

  const [notes, setNotes] = useState(client.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(true)
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleStatusChange(next: ClientStatus) {
    const prev = status
    setStatus(next)
    setSavingField('status')
    const { error } = await supabase
      .from('clients')
      .update({ status: next })
      .eq('id', client.id)
    setSavingField(null)
    if (error) {
      setStatus(prev)
      alert(`Could not update status: ${error.message}`)
    } else {
      router.refresh()
    }
  }

  async function handleCsmChange(nextId: string) {
    const prev = csmId
    setCsmId(nextId)
    setSavingField('csm')
    const { error } = await supabase
      .from('clients')
      .update({ assigned_csm: nextId || null })
      .eq('id', client.id)
    setSavingField(null)
    if (error) {
      setCsmId(prev)
      alert(`Could not update CSM: ${error.message}`)
    } else {
      router.refresh()
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true)
    setNotesSaved(false)
    const { error } = await supabase
      .from('clients')
      .update({ notes: notes.trim() || null })
      .eq('id', client.id)
    setSavingNotes(false)
    if (error) {
      alert(`Could not save notes: ${error.message}`)
      return
    }
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
    router.refresh()
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', client.id)
    if (error) {
      setDeleting(false)
      setDeleteError(error.message)
      return
    }
    router.replace('/clients')
    router.refresh()
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-kst-muted hover:text-kst-gold transition-colors text-sm mb-4"
        >
          <ArrowLeft size={16} />
          Back to clients
        </Link>
        <h1
          className="text-5xl md:text-6xl text-kst-gold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {client.company_name}
        </h1>
        <p className="mt-3 text-kst-muted">
          {client.contact_name} ·{' '}
          <a
            href={`mailto:${client.contact_email}`}
            className="hover:text-kst-gold transition-colors"
          >
            {client.contact_email}
          </a>
        </p>
      </div>

      {/* Info bar */}
      <div className="glass-panel-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-kst-muted mb-2">
              Status
            </p>
            <ClientStatusPicker
              value={status}
              disabled={savingField === 'status'}
              onChange={handleStatusChange}
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-kst-muted mb-2">
              Assigned CSM
            </p>
            <CsmPicker
              value={csmId}
              csms={csms}
              disabled={savingField === 'csm'}
              onChange={handleCsmChange}
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-kst-muted mb-2">
              Joined Date
            </p>
            <p className="text-kst-white text-sm h-10 flex items-center">
              {formatDate(client.joined_date ?? client.created_at)}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-kst-muted mb-2">
              Launched Date
            </p>
            <p className="text-sm h-10 flex items-center">
              {client.launched_date ? (
                <span className="text-kst-white">
                  {formatDate(client.launched_date)}
                </span>
              ) : (
                <span className="text-kst-muted">Not launched</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <TabButton
          active={activeTab === 'setup'}
          onClick={() => setActiveTab('setup')}
        >
          Setup &amp; Launch
        </TabButton>
        <TabButton
          active={activeTab === 'success'}
          onClick={() => setActiveTab('success')}
        >
          Success Tracking
        </TabButton>
      </div>

      <div className="mb-6">
        {activeTab === 'setup' ? (
          <SetupChecklist
            clientId={client.id}
            isTeamView
            clientName={client.company_name}
          />
        ) : (
          <div className="glass-panel p-8">
            <p className="text-kst-muted text-sm">Coming in Phase 5</p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="glass-panel p-6 mb-6">
        <button
          type="button"
          onClick={() => setNotesOpen((v) => !v)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Edit3 size={16} className="text-kst-gold" />
            <h3 className="text-kst-white font-semibold">Notes</h3>
          </div>
          <ChevronDown
            size={16}
            className={cn(
              'text-kst-muted transition-transform',
              notesOpen && 'rotate-180'
            )}
          />
        </button>
        {notesOpen && (
          <div className="mt-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Add notes about this client..."
              className="w-full px-4 py-3 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors resize-none"
            />
            <div className="flex items-center justify-end gap-3 mt-3">
              {notesSaved && (
                <span className="text-kst-success text-xs">Saved</span>
              )}
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="px-4 h-10 rounded-xl bg-kst-gold text-kst-black font-semibold text-sm hover:bg-kst-gold-light transition-colors disabled:opacity-60"
              >
                {savingNotes ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="glass-panel-sm p-5 border border-kst-error/20">
        <p className="text-kst-muted text-xs uppercase tracking-wider mb-3">
          Danger Zone
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-kst-error/60 text-kst-error hover:bg-kst-error/10 transition-colors text-sm"
          >
            <Trash2 size={14} />
            Delete Client
          </button>
        ) : (
          <div>
            <p className="text-kst-white text-sm mb-4">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{client.company_name}</span>?
              This will delete all their task progress and cannot be undone.
            </p>
            {deleteError && (
              <p className="text-kst-error text-xs mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="px-4 h-10 rounded-xl glass-panel-sm text-kst-muted hover:text-kst-white transition-colors text-sm disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-kst-error text-kst-black font-semibold text-sm hover:bg-kst-error/90 transition-colors disabled:opacity-60"
              >
                <Trash2 size={14} />
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 h-10 rounded-xl glass-panel-sm text-sm transition-colors border-b-2',
        active
          ? 'text-kst-gold border-kst-gold'
          : 'text-kst-muted border-transparent hover:text-kst-white'
      )}
    >
      {children}
    </button>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Pickers
// ───────────────────────────────────────────────────────────────────────────

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

function ClientStatusPicker({
  value,
  disabled,
  onChange,
}: {
  value: ClientStatus
  disabled?: boolean
  onChange: (next: ClientStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, open, () => setOpen(false))

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center h-10 disabled:opacity-60"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <StatusBadge status={value} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute z-50 left-0 top-full mt-2 min-w-[200px] kst-dropdown p-1 kst-fade-in"
        >
          {CLIENT_STATUSES.map((s) => {
            const active = s === value
            return (
              <button
                key={s}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(s)
                  setOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-white/[0.06] transition-colors',
                  active && 'bg-kst-gold/10'
                )}
              >
                <span className={cn('w-2.5 h-2.5 rounded-full', STATUS_DOT[s])} />
                <span
                  className={cn(
                    'flex-1',
                    active ? 'text-kst-white' : 'text-kst-muted'
                  )}
                >
                  {STATUS_LABEL[s]}
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

function CsmPicker({
  value,
  csms,
  disabled,
  onChange,
}: {
  value: string
  csms: CsmOption[]
  disabled?: boolean
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, open, () => setOpen(false))

  const selected = csms.find((c) => c.id === value) ?? null

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-full glass-panel-sm text-sm disabled:opacity-60 hover:bg-white/[0.04] transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {selected ? (
          <span className="text-kst-white">
            {selected.full_name ?? 'Unnamed'}
          </span>
        ) : (
          <span className="text-kst-muted">Unassigned</span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute z-50 left-0 top-full mt-2 min-w-[220px] max-h-72 overflow-y-auto kst-dropdown p-1 kst-fade-in"
        >
          <PickerOption
            active={value === ''}
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
          >
            <span className="text-kst-muted italic">Unassigned</span>
          </PickerOption>
          {csms.map((c) => {
            const active = c.id === value
            return (
              <PickerOption
                key={c.id}
                active={active}
                onClick={() => {
                  onChange(c.id)
                  setOpen(false)
                }}
              >
                <span
                  className={cn(active ? 'text-kst-white' : 'text-kst-muted')}
                >
                  {c.full_name ?? 'Unnamed'}
                </span>
              </PickerOption>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PickerOption({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-white/[0.06] transition-colors',
        active && 'bg-kst-gold/10'
      )}
    >
      <span className="flex-1">{children}</span>
      {active && <Check size={14} className="text-kst-gold" />}
    </button>
  )
}
