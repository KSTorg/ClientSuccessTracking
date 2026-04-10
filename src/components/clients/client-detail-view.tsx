'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  CheckCircle,
  ChevronDown,
  Edit3,
  Lock,
  RefreshCw,
  Rocket,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SetupChecklist } from '@/components/SetupChecklist'
import { SuccessTracking } from '@/components/SuccessTracking'
import { useToast } from '@/components/ui/toast'
import {
  ContactsSection,
  type ClientContact,
} from '@/components/clients/contacts-section'
import { ClientTeamSection } from '@/components/clients/client-team-section'
import { SubscriptionsSection } from '@/components/clients/subscriptions-section'
import { StatusBadge } from '@/components/clients/status-badge'
import { ProgramBadge } from '@/components/clients/program-badge'
import type { Role } from '@/lib/supabase/get-user'
import { cn, formatDate } from '@/lib/utils'
import {
  CLIENT_STATUSES,
  EMPTY_CLIENT_TEAM,
  type ClientStatus,
  type ClientTeam,
  type ClientWithCsm,
  type CsmOption,
} from '@/lib/types'

interface ClientDetailViewProps {
  client: ClientWithCsm
  csms: CsmOption[]
  contacts: ClientContact[]
  currentUserRole: Role
  primaryContactName: string | null
}

const STATUS_DOT: Record<ClientStatus, string> = {
  onboarding: 'bg-kst-gold',
  launched: 'bg-kst-success',
  paused: 'bg-white/50',
  churned: 'bg-kst-error',
}

const STATUS_LABEL: Record<ClientStatus, string> = {
  onboarding: 'Onboarding',
  launched: 'Launched',
  paused: 'Paused',
  churned: 'Churned',
}

type Tab = 'setup' | 'success'

export function ClientDetailView({
  client,
  csms,
  contacts,
  currentUserRole,
  primaryContactName,
}: ClientDetailViewProps) {
  const isAdmin = currentUserRole === 'admin'
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const toast = useToast()

  const [status, setStatus] = useState<ClientStatus>(client.status)
  const [launchedDate, setLaunchedDate] = useState<string | null>(
    client.launched_date
  )
  const [stage12, setStage12] = useState<{
    total: number
    completed: number
  } | null>(null)
  const [savingField, setSavingField] = useState<'status' | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab')
    if (tab === 'success' && client.launched_date) return 'success'
    if (tab === 'setup') return 'setup'
    // Default: launched clients land on Success Tracking, others on Setup
    return client.launched_date ? 'success' : 'setup'
  })

  const isLaunched = !!launchedDate

  const handleLaunchedChange = useCallback(
    (date: string | null) => {
      setLaunchedDate(date)
      setStatus(date ? 'launched' : 'onboarding')
      if (date) {
        toast.success(`${client.company_name} launched!`)
        // Fire-and-forget Discord notification
        fetch('/api/notifications/client-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'launched', clientId: client.id }),
        }).catch(() => {})
      } else {
        toast.info(`${client.company_name} moved back to onboarding`)
      }
      router.refresh()
    },
    [router, toast, client.company_name, client.id]
  )

  const handleStage12Progress = useCallback(
    (p: { total: number; completed: number }) => {
      setStage12(p)
    },
    []
  )

  // ── Inline date editors (staged value + explicit save) ──────────────
  const [joinedDate, setJoinedDate] = useState<string>(
    (client.joined_date ?? client.created_at).slice(0, 10)
  )
  const [editingJoined, setEditingJoined] = useState(false)
  const [savingJoined, setSavingJoined] = useState(false)
  const [stagedJoined, setStagedJoined] = useState(joinedDate)

  async function saveJoinedDate() {
    if (!stagedJoined) return
    const prev = joinedDate
    setJoinedDate(stagedJoined)
    setSavingJoined(true)
    const { error } = await supabase
      .from('clients')
      .update({ joined_date: stagedJoined })
      .eq('id', client.id)
    setSavingJoined(false)
    setEditingJoined(false)
    if (error) {
      setJoinedDate(prev)
      toast.error(`Could not update joined date: ${error.message}`)
      return
    }
    router.refresh()
  }

  const [editingLaunched, setEditingLaunched] = useState(false)
  const [savingLaunched, setSavingLaunched] = useState(false)
  const [stagedLaunched, setStagedLaunched] = useState(launchedDate ?? '')

  async function saveLaunchedDate() {
    if (!stagedLaunched) return
    const prev = launchedDate
    setLaunchedDate(stagedLaunched)
    setStatus('launched')
    setSavingLaunched(true)
    const { error } = await supabase
      .from('clients')
      .update({ launched_date: stagedLaunched, status: 'launched' })
      .eq('id', client.id)
    setSavingLaunched(false)
    setEditingLaunched(false)
    if (error) {
      setLaunchedDate(prev)
      setStatus(prev ? 'launched' : 'onboarding')
      toast.error(`Could not update launched date: ${error.message}`)
      return
    }
    router.refresh()
  }

  const [programEndDate, setProgramEndDate] = useState<string | null>(
    client.program_end_date ?? null
  )
  const [editingEndDate, setEditingEndDate] = useState(false)
  const [savingEndDate, setSavingEndDate] = useState(false)
  const [stagedEndDate, setStagedEndDate] = useState(programEndDate ?? '')

  async function saveEndDate() {
    if (!stagedEndDate) return
    const prev = programEndDate
    setProgramEndDate(stagedEndDate)
    setSavingEndDate(true)
    const { error } = await supabase
      .from('clients')
      .update({ program_end_date: stagedEndDate })
      .eq('id', client.id)
    setSavingEndDate(false)
    setEditingEndDate(false)
    if (error) {
      setProgramEndDate(prev)
      toast.error(`Could not update end date: ${error.message}`)
      return
    }
    router.refresh()
  }

  const [notes, setNotes] = useState(client.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(true)
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // Status history
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyRows, setHistoryRows] = useState<Array<{
    created_at: string
    old_status: string
    new_status: string
    program_end_date_at_change: string | null
  }>>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  async function loadHistory() {
    if (historyLoaded) return
    const { data } = await supabase
      .from('client_status_history')
      .select('created_at, old_status, new_status, program_end_date_at_change')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
    setHistoryRows((data ?? []) as typeof historyRows)
    setHistoryLoaded(true)
  }

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleStatusChange(next: ClientStatus) {
    const prev = status
    setStatus(next)
    setSavingField('status')

    const updates: Record<string, unknown> = { status: next }
    if (next === 'churned') updates.churned_at = new Date().toISOString().slice(0, 10)
    if (prev === 'churned' && next !== 'churned') updates.churned_at = null

    const { error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', client.id)
    setSavingField(null)
    if (error) {
      setStatus(prev)
      toast.error(`Could not update status: ${error.message}`)
      return
    }

    // Log status change history (fire-and-forget)
    supabase
      .from('client_status_history')
      .insert({
        client_id: client.id,
        old_status: prev,
        new_status: next,
        program_end_date_at_change: programEndDate,
      })
      .then(({ error: logErr }) => {
        if (logErr) console.warn('[status history] insert failed:', logErr.message)
      })

    toast.success('Status updated')
    router.refresh()
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
      toast.error(`Could not save notes: ${error.message}`)
      return
    }
    setNotesSaved(true)
    toast.success('Notes saved')
    setTimeout(() => setNotesSaved(false), 2000)
    router.refresh()
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)

    // 1) Collect every auth user that should be removed alongside the client:
    //    - Every client_contacts row with has_login && user_id
    //    - The client's own clients.user_id (the primary contact's auth user)
    const { data: contactRows, error: contactsErr } = await supabase
      .from('client_contacts')
      .select('user_id, has_login')
      .eq('client_id', client.id)

    if (contactsErr) {
      console.warn(
        '[delete client] could not fetch contacts for cleanup:',
        contactsErr.message
      )
    }

    const userIds = new Set<string>()
    if (client.user_id) userIds.add(client.user_id)
    for (const row of (contactRows ?? []) as {
      user_id: string | null
      has_login: boolean
    }[]) {
      if (row.has_login && row.user_id) userIds.add(row.user_id)
    }

    // 2) Call /api/delete-user for each. Failures are logged but never block
    //    the client deletion itself — an orphan auth user is recoverable, a
    //    half-deleted client is not.
    await Promise.all(
      Array.from(userIds).map(async (userId) => {
        try {
          const res = await fetch('/api/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          })
          const body = await res.json().catch(() => ({}))
          if (!res.ok) {
            console.warn(
              `[delete client] delete-user failed for ${userId}:`,
              body?.error ?? res.status
            )
          }
        } catch (err) {
          console.warn(
            `[delete client] delete-user threw for ${userId}:`,
            err
          )
        }
      })
    )

    // 3) Finally delete the client itself. DB cascades clean up
    //    client_tasks and client_contacts.
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', client.id)
    if (error) {
      setDeleting(false)
      setDeleteError(error.message)
      return
    }
    toast.success(`${client.company_name} deleted`)
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
        <div className="flex items-center gap-3 flex-wrap">
          <h1
            className="text-5xl md:text-6xl text-kst-gold tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {client.company_name}
          </h1>
          {client.is_imported && (
            <span className="text-xs px-2 py-1 rounded bg-white/[0.06] text-kst-muted">
              imported
            </span>
          )}
        </div>
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
        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-white/[0.05]">
          <span className="text-xs uppercase tracking-wider text-kst-muted">
            Program
          </span>
          <ProgramBadge program={client.program} />
        </div>
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
              Joined Date
            </p>
            {editingJoined ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={stagedJoined}
                  autoFocus
                  disabled={savingJoined}
                  onChange={(e) => setStagedJoined(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveJoinedDate()
                    if (e.key === 'Escape') { setStagedJoined(joinedDate); setEditingJoined(false) }
                  }}
                  className="h-10 px-3 rounded-lg bg-kst-dark border border-white/10 text-kst-white text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors"
                />
                <button type="button" disabled={savingJoined} onClick={saveJoinedDate} className="h-8 px-2.5 rounded-lg bg-kst-gold/20 text-kst-gold text-xs font-medium hover:bg-kst-gold/30 transition-colors disabled:opacity-50">
                  {savingJoined ? '...' : 'Save'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setStagedJoined(joinedDate); setEditingJoined(true) }}
                className="text-kst-white text-sm h-10 flex items-center hover:text-kst-gold transition-colors"
              >
                {formatDate(joinedDate)}
              </button>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-kst-muted mb-2">
              Launched Date
            </p>
            {editingLaunched ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={stagedLaunched}
                  autoFocus
                  disabled={savingLaunched}
                  onChange={(e) => setStagedLaunched(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveLaunchedDate()
                    if (e.key === 'Escape') { setStagedLaunched(launchedDate ?? ''); setEditingLaunched(false) }
                  }}
                  className="h-10 px-3 rounded-lg bg-kst-dark border border-white/10 text-kst-white text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors"
                />
                <button type="button" disabled={savingLaunched} onClick={saveLaunchedDate} className="h-8 px-2.5 rounded-lg bg-kst-gold/20 text-kst-gold text-xs font-medium hover:bg-kst-gold/30 transition-colors disabled:opacity-50">
                  {savingLaunched ? '...' : 'Save'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setStagedLaunched(launchedDate ?? ''); setEditingLaunched(true) }}
                className="text-sm h-10 flex items-center hover:text-kst-gold transition-colors"
              >
                {launchedDate ? (
                  <span className="text-kst-white">
                    {formatDate(launchedDate)}
                  </span>
                ) : (
                  <span className="text-kst-muted">Not launched</span>
                )}
              </button>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-kst-muted mb-2">
              Program End
            </p>
            {editingEndDate ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={stagedEndDate}
                  autoFocus
                  disabled={savingEndDate}
                  onChange={(e) => setStagedEndDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEndDate()
                    if (e.key === 'Escape') { setStagedEndDate(programEndDate ?? ''); setEditingEndDate(false) }
                  }}
                  className="h-10 px-3 rounded-lg bg-kst-dark border border-white/10 text-kst-white text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors"
                />
                <button type="button" disabled={savingEndDate} onClick={saveEndDate} className="h-8 px-2.5 rounded-lg bg-kst-gold/20 text-kst-gold text-xs font-medium hover:bg-kst-gold/30 transition-colors disabled:opacity-50">
                  {savingEndDate ? '...' : 'Save'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setStagedEndDate(programEndDate ?? ''); setEditingEndDate(true) }}
                className={cn(
                  'text-sm h-10 flex items-center transition-colors',
                  !programEndDate
                    ? 'text-kst-muted hover:text-kst-gold'
                    : (() => {
                        const today = new Date().toISOString().slice(0, 10)
                        if (programEndDate < today) return 'text-red-400 hover:text-red-300'
                        const in7 = new Date()
                        in7.setDate(in7.getDate() + 7)
                        if (programEndDate <= in7.toISOString().slice(0, 10)) return 'text-kst-gold hover:text-kst-gold-light'
                        return 'text-kst-muted hover:text-kst-gold'
                      })()
                )}
              >
                {!programEndDate
                  ? 'Not set'
                  : programEndDate < new Date().toISOString().slice(0, 10)
                    ? `Ended ${formatDate(programEndDate)}`
                    : formatDate(programEndDate)}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contacts */}
      <ContactsSection
        clientId={client.id}
        clientName={client.company_name}
        initialContacts={contacts}
        legacyContactName={client.contact_name}
        legacyContactEmail={client.contact_email}
        currentUserRole={currentUserRole}
      />

      {/* Launch banner */}
      <LaunchStatusBanner
        launchedDate={launchedDate}
        stage12={stage12}
      />

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
          disabled={!isLaunched}
          onClick={() => isLaunched && setActiveTab('success')}
          tooltip={!isLaunched ? 'Available after launch' : undefined}
          icon={!isLaunched ? <Lock size={11} /> : undefined}
        >
          Success Tracking
        </TabButton>
      </div>

      <div className="mb-6">
        {activeTab === 'setup' || !isLaunched ? (
          <SetupChecklist
            clientId={client.id}
            isTeamView
            clientName={client.company_name}
            isLaunched={isLaunched}
            program={client.program}
            teamMembers={csms.map((c) => ({
              id: c.id,
              full_name: c.full_name,
              specialty: c.specialty ?? null,
            }))}
            clientContactName={primaryContactName}
            joinedDate={client.joined_date ?? client.created_at}
            onLaunchedChange={handleLaunchedChange}
            onStage12ProgressChange={handleStage12Progress}
          />
        ) : (
          <SuccessTracking
            clientId={client.id}
            launchedDate={launchedDate!}
          />
        )}
      </div>

      {/* Subscriptions — team only */}
      <SubscriptionsSection
        clientId={client.id}
        joinedDate={client.joined_date ?? client.created_at}
        programEndDate={programEndDate}
        status={status}
      />

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

      {/* Client Team */}
      <ClientTeamSection
        clientId={client.id}
        initialTeam={
          client.client_team ?? {
            ...EMPTY_CLIENT_TEAM,
            csm: client.assigned_csm ?? null,
          }
        }
        teamMembers={csms}
      />

      {/* Status History */}
      <div className="glass-panel-sm p-5 mb-6">
        <button
          type="button"
          onClick={() => { setHistoryOpen((v) => !v); loadHistory() }}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <RefreshCw size={14} className="text-kst-gold" />
            <h3 className="text-kst-white font-semibold text-sm">Status History</h3>
          </div>
          <ChevronDown
            size={16}
            className={cn('text-kst-muted transition-transform', historyOpen && 'rotate-180')}
          />
        </button>
        {historyOpen && (
          <div className="mt-4">
            {historyRows.length === 0 ? (
              <p className="text-kst-muted text-sm py-3 text-center">No status changes recorded.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {historyRows.map((h, i) => {
                  const isRenewal = h.new_status === 'launched' && h.program_end_date_at_change
                  return (
                    <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="text-kst-muted text-xs shrink-0 w-20">
                        {formatDate(h.created_at)}
                      </span>
                      <span className="text-kst-white flex-1">
                        {isRenewal ? (
                          <>Renewal — extended to {formatDate(h.program_end_date_at_change)}</>
                        ) : (
                          <>
                            <span className="capitalize">{h.old_status}</span>
                            {' → '}
                            <span className="capitalize">{h.new_status}</span>
                          </>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Danger zone — admin only */}
      {isAdmin && (
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
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
  disabled,
  tooltip,
  icon,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  tooltip?: string
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={cn(
        'inline-flex items-center gap-2 px-4 h-10 rounded-xl glass-panel-sm text-sm transition-colors border-b-2',
        disabled && 'opacity-40 cursor-not-allowed',
        !disabled &&
          (active
            ? 'text-kst-gold border-kst-gold'
            : 'text-kst-muted border-transparent hover:text-kst-white'),
        disabled && 'text-kst-muted border-transparent'
      )}
    >
      {icon}
      {children}
    </button>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Launch banner & launch date picker
// ───────────────────────────────────────────────────────────────────────────

function LaunchStatusBanner({
  launchedDate,
  stage12,
}: {
  launchedDate: string | null
  stage12: { total: number; completed: number } | null
}) {
  if (launchedDate) {
    return (
      <div
        className="glass-panel-sm p-4 mb-6 flex items-center gap-3"
        style={{ borderLeft: '3px solid var(--kst-success)' }}
      >
        <CheckCircle size={18} className="text-kst-success shrink-0" />
        <div className="min-w-0">
          <p className="text-kst-white text-sm font-medium">
            Launched on {formatDate(launchedDate)}
          </p>
          <p className="text-kst-muted text-xs">
            Success Tracking is now active
          </p>
        </div>
      </div>
    )
  }
  return (
    <div
      className="glass-panel-sm p-4 mb-6 flex items-center gap-3"
      style={{ borderLeft: '3px solid var(--kst-gold)' }}
    >
      <Rocket size={18} className="text-kst-gold shrink-0" />
      <div className="min-w-0">
        <p className="text-kst-white text-sm">
          This client will be launched when &lsquo;Launch Ads&rsquo; is
          completed
        </p>
        {stage12 && (
          <p className="text-kst-muted text-xs mt-0.5">
            {stage12.completed} of {stage12.total} Stage 1 &amp; 2 tasks
            completed
          </p>
        )}
      </div>
    </div>
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

