'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, ChevronDown, Edit3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

const STATUS_TEXT: Record<ClientStatus, string> = {
  onboarding: 'text-kst-gold',
  launched: 'text-kst-success',
  paused: 'text-kst-warning',
  churned: 'text-kst-error',
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

  const selectClass =
    'h-10 px-3 pr-9 rounded-lg bg-kst-dark border border-white/10 text-kst-white text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors appearance-none'

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
            <div className="relative">
              <select
                value={status}
                onChange={(e) =>
                  handleStatusChange(e.target.value as ClientStatus)
                }
                disabled={savingField === 'status'}
                className={cn(selectClass, STATUS_TEXT[status], 'font-medium')}
              >
                {CLIENT_STATUSES.map((s) => (
                  <option
                    key={s}
                    value={s}
                    className="text-kst-white bg-kst-dark"
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-kst-muted pointer-events-none"
              />
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-kst-muted mb-2">
              Assigned CSM
            </p>
            <div className="relative">
              <select
                value={csmId}
                onChange={(e) => handleCsmChange(e.target.value)}
                disabled={savingField === 'csm'}
                className={selectClass}
              >
                <option value="">Unassigned</option>
                {csms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name ?? 'Unnamed'}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-kst-muted pointer-events-none"
              />
            </div>
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

      <div className="glass-panel p-8 mb-6">
        {activeTab === 'setup' ? (
          <p className="text-kst-muted text-sm">Checklist coming in Phase 3</p>
        ) : (
          <p className="text-kst-muted text-sm">Coming in Phase 5</p>
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
