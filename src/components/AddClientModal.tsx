'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { inviteUser } from '@/lib/supabase/invite'
import {
  TeamSlotPicker,
  buildDefaultClientTeam,
} from '@/components/clients/client-team-section'
import { cn } from '@/lib/utils'
import {
  EMPTY_CLIENT_TEAM,
  type ClientTeam,
  type CsmOption,
  type Program,
} from '@/lib/types'

interface AddClientModalProps {
  open: boolean
  onClose: () => void
  csms: CsmOption[]
}

interface FieldErrors {
  company_name?: string
  contact_name?: string
  contact_email?: string
  password?: string
}

const inputClass =
  'w-full h-11 px-4 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors disabled:opacity-60'

export function AddClientModal({ open, onClose, csms }: AddClientModalProps) {
  const router = useRouter()
  const supabase = createClient()

  const today = new Date().toISOString().slice(0, 10)
  const [program, setProgram] = useState<Program>('educator_incubator')
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [joinedDate, setJoinedDate] = useState(today)
  const [clientTeam, setClientTeam] = useState<ClientTeam>(EMPTY_CLIENT_TEAM)
  const [notes, setNotes] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Reset state when the modal closes; auto-fill the client team when
  // it opens so each slot starts on the first team member with the
  // matching specialty.
  useEffect(() => {
    if (open) {
      setClientTeam(buildDefaultClientTeam(csms))
    } else {
      setProgram('educator_incubator')
      setCompanyName('')
      setContactName('')
      setContactEmail('')
      setJoinedDate(today)
      setClientTeam(EMPTY_CLIENT_TEAM)
      setNotes('')
      setPassword('')
      setFieldErrors({})
      setSubmitError(null)
      setLoading(false)
    }
  }, [open, today, csms])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitError(null)

    const errs: FieldErrors = {}
    if (!companyName.trim()) errs.company_name = 'Company name is required.'
    if (!contactName.trim()) errs.contact_name = 'Contact name is required.'
    if (!contactEmail.trim()) errs.contact_email = 'Contact email is required.'
    if (password.length < 8)
      errs.password = 'Password must be at least 8 characters.'
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})

    setLoading(true)

    // 1) Insert the client row and grab its id
    const { data: clientRow, error: insertErr } = await supabase
      .from('clients')
      .insert({
        company_name: companyName.trim(),
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        joined_date: joinedDate || null,
        client_team: clientTeam,
        notes: notes.trim() || null,
        status: 'onboarding',
        program,
      })
      .select('id')
      .single()

    if (insertErr || !clientRow) {
      setSubmitError(insertErr?.message ?? 'Could not create client.')
      setLoading(false)
      return
    }

    const clientId = (clientRow as { id: string }).id

    // 2) Create the client's auth user + profile via the admin route
    let newUserId: string
    try {
      const res = await inviteUser({
        email: contactEmail.trim(),
        fullName: contactName.trim(),
        role: 'client',
        password,
      })
      newUserId = res.userId
    } catch (err) {
      // Roll back the client row so the admin can retry cleanly
      await supabase.from('clients').delete().eq('id', clientId)
      setSubmitError(
        err instanceof Error ? err.message : 'Could not create login.'
      )
      setLoading(false)
      return
    }

    // 3) Link the new user to the client (so RLS on /my-progress works)
    const { error: linkErr } = await supabase
      .from('clients')
      .update({ user_id: newUserId })
      .eq('id', clientId)
    if (linkErr) {
      setSubmitError(`Client created but user link failed: ${linkErr.message}`)
      setLoading(false)
      return
    }

    // 4) Create the primary contact row with has_login + user_id set
    const { error: contactErr } = await supabase
      .from('client_contacts')
      .insert({
        client_id: clientId,
        full_name: contactName.trim(),
        email: contactEmail.trim(),
        role: 'owner',
        is_primary: true,
        has_login: true,
        user_id: newUserId,
      })
    if (contactErr) {
      // Not fatal — the client + login still work; surface a warning but
      // let the modal close so the page refreshes.
      console.warn(
        '[add client] primary contact insert failed:',
        contactErr.message
      )
    }

    // 5) Auto-assign client_tasks based on program. Non-fatal on failure —
    // the client is fully functional, assignments can be fixed manually.
    try {
      const assignRes = await fetch('/api/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, program }),
      })
      if (!assignRes.ok) {
        const body = await assignRes.json().catch(() => ({}))
        console.warn(
          '[add client] auto-assign failed:',
          body?.error ?? assignRes.status
        )
      }
    } catch (err) {
      console.warn('[add client] auto-assign threw:', err)
    }

    setLoading(false)
    onClose()
    router.refresh()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-client-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />

      <div
        className="glass-panel relative w-full max-w-[520px] p-7 max-h-[90vh] overflow-y-auto"
        style={{ animation: 'kst-fade-up 0.2s ease-out both' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-kst-muted hover:text-kst-white transition-colors"
        >
          <X size={18} />
        </button>

        <h2
          id="add-client-title"
          className="text-kst-white text-xl font-semibold mb-6"
        >
          Add New Client
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <span className="block text-xs uppercase tracking-wider text-kst-muted mb-2">
              Program
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ProgramCard
                title="Educator Incubator"
                subtitle="Client handles setup with our training & guidance"
                selected={program === 'educator_incubator'}
                onClick={() => setProgram('educator_incubator')}
                disabled={loading}
              />
              <ProgramCard
                title="Accelerator"
                subtitle="Done-for-you setup by our team"
                selected={program === 'accelerator'}
                onClick={() => setProgram('accelerator')}
                disabled={loading}
              />
            </div>
          </div>

          <Field label="Company Name" error={fieldErrors.company_name}>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
              placeholder="Acme Corp"
              className={inputClass}
            />
          </Field>

          <Field label="Contact Name" error={fieldErrors.contact_name}>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={loading}
              placeholder="Jane Doe"
              className={inputClass}
            />
          </Field>

          <Field label="Contact Email" error={fieldErrors.contact_email}>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              disabled={loading}
              placeholder="jane@acme.com"
              className={inputClass}
            />
          </Field>

          <Field label="Joined Date">
            <input
              type="date"
              value={joinedDate}
              onChange={(e) => setJoinedDate(e.target.value)}
              disabled={loading}
              className={inputClass}
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder="Optional context for the team..."
              className={cn(inputClass, 'h-auto py-3 resize-none')}
            />
          </Field>

          <div>
            <span className="block text-xs uppercase tracking-wider text-kst-muted mb-2">
              Client Team
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TeamSlotPicker
                label="CSM"
                match="csm"
                value={clientTeam.csm}
                teamMembers={csms}
                onChange={(id) =>
                  setClientTeam((t) => ({ ...t, csm: id }))
                }
              />
              <TeamSlotPicker
                label="Ads"
                match="ads"
                value={clientTeam.ads}
                teamMembers={csms}
                onChange={(id) =>
                  setClientTeam((t) => ({ ...t, ads: id }))
                }
              />
              <TeamSlotPicker
                label="Systems"
                match="systems"
                value={clientTeam.systems}
                teamMembers={csms}
                onChange={(id) =>
                  setClientTeam((t) => ({ ...t, systems: id }))
                }
              />
              <TeamSlotPicker
                label="Organic"
                match="organic"
                value={clientTeam.organic}
                teamMembers={csms}
                onChange={(id) =>
                  setClientTeam((t) => ({ ...t, organic: id }))
                }
              />
              <div className="sm:col-span-2">
                <TeamSlotPicker
                  label="Sales"
                  match="sales"
                  value={clientTeam.sales}
                  teamMembers={csms}
                  onChange={(id) =>
                    setClientTeam((t) => ({ ...t, sales: id }))
                  }
                />
              </div>
            </div>
          </div>

          <Field label="Password" error={fieldErrors.password}>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="Min 8 characters"
              autoComplete="new-password"
              className={inputClass}
            />
            <span className="text-[11px] text-kst-muted mt-1">
              You&apos;ll share these credentials with the client directly.
            </span>
          </Field>

          {submitError && (
            <p className="text-kst-error text-sm">{submitError}</p>
          )}

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 h-11 rounded-xl glass-panel-sm text-kst-muted hover:text-kst-white transition-colors text-sm disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold hover:bg-kst-gold-light transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes kst-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-kst-muted">
        {label}
      </span>
      {children}
      {error && <span className="text-kst-error text-xs">{error}</span>}
    </label>
  )
}

function ProgramCard({
  title,
  subtitle,
  selected,
  onClick,
  disabled,
}: {
  title: string
  subtitle: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'glass-panel-sm text-left p-4 transition-all disabled:opacity-60',
        selected
          ? 'border-kst-gold/80 ring-2 ring-kst-gold/30'
          : 'hover:border-white/15'
      )}
      style={
        selected
          ? { borderColor: 'rgba(201, 168, 76, 0.8)' }
          : undefined
      }
    >
      <p
        className={cn(
          'text-sm font-semibold',
          selected ? 'text-kst-gold' : 'text-kst-white'
        )}
      >
        {title}
      </p>
      <p className="text-[11px] text-kst-muted mt-1 leading-snug">
        {subtitle}
      </p>
    </button>
  )
}
