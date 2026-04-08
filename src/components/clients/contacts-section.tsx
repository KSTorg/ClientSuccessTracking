'use client'

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  Mail,
  MoreVertical,
  Phone,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { inviteUser } from '@/lib/supabase/invite'
import type { Role } from '@/lib/supabase/get-user'
import { cn } from '@/lib/utils'

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

export type ContactRole = 'owner' | 'co-founder' | 'manager' | 'team-member'

export interface ClientContact {
  id: string
  client_id: string
  full_name: string
  email: string
  phone: string | null
  role: ContactRole
  is_primary: boolean
  has_login: boolean
  user_id: string | null
  created_at: string
}

interface ContactsSectionProps {
  clientId: string
  clientName: string
  initialContacts: ClientContact[]
  // For seeding the first contact from the legacy clients table fields
  legacyContactName: string | null
  legacyContactEmail: string | null
  currentUserRole: Role
}

const ROLE_LABELS: Record<ContactRole, string> = {
  owner: 'Owner',
  'co-founder': 'Co-Founder',
  manager: 'Manager',
  'team-member': 'Team Member',
}

const ROLE_OPTIONS: ContactRole[] = [
  'owner',
  'co-founder',
  'manager',
  'team-member',
]

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

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────

export function ContactsSection({
  clientId,
  clientName,
  initialContacts,
  legacyContactName,
  legacyContactEmail,
  currentUserRole,
}: ContactsSectionProps) {
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = currentUserRole === 'admin'

  const [contacts, setContacts] = useState<ClientContact[]>(initialContacts)
  const [addOpen, setAddOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [invitePromptFor, setInvitePromptFor] =
    useState<ClientContact | null>(null)
  const migratedRef = useRef(false)

  // Auto-migrate legacy contact_name/email into client_contacts
  // (runs once per mount when there are no contacts and legacy data exists)
  useEffect(() => {
    if (migratedRef.current) return
    if (contacts.length > 0) return
    if (!legacyContactName || !legacyContactEmail) return
    migratedRef.current = true

    async function migrate() {
      // Re-check defensively in case another tab inserted in the meantime
      const { data: existing } = await supabase
        .from('client_contacts')
        .select('id')
        .eq('client_id', clientId)
        .eq('email', legacyContactEmail!)
        .maybeSingle()

      if (existing) {
        // Refetch the full list and bail
        const { data: list } = await supabase
          .from('client_contacts')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at')
        if (list) setContacts(list as ClientContact[])
        return
      }

      const { data: inserted, error: insErr } = await supabase
        .from('client_contacts')
        .insert({
          client_id: clientId,
          full_name: legacyContactName!,
          email: legacyContactEmail!,
          role: 'owner',
          is_primary: true,
          has_login: false,
        })
        .select('*')
        .single()

      if (insErr) {
        setError(`Could not migrate primary contact: ${insErr.message}`)
        return
      }
      if (inserted) setContacts([inserted as ClientContact])
      router.refresh()
    }

    migrate()
  }, [
    clientId,
    contacts.length,
    legacyContactEmail,
    legacyContactName,
    router,
    supabase,
  ])

  async function setPrimary(contact: ClientContact) {
    setBusyId(contact.id)
    setError(null)
    // Clear all primary flags for this client, then set the chosen one.
    const { error: clearErr } = await supabase
      .from('client_contacts')
      .update({ is_primary: false })
      .eq('client_id', clientId)
    if (clearErr) {
      setBusyId(null)
      setError(clearErr.message)
      return
    }
    const { error: setErr } = await supabase
      .from('client_contacts')
      .update({ is_primary: true })
      .eq('id', contact.id)
    setBusyId(null)
    if (setErr) {
      setError(setErr.message)
      return
    }
    setContacts((prev) =>
      prev.map((c) => ({ ...c, is_primary: c.id === contact.id }))
    )
    router.refresh()
  }

  async function removeContact(contact: ClientContact) {
    if (
      !confirm(
        `Remove ${contact.full_name} from this client's contacts? This cannot be undone.`
      )
    )
      return
    setBusyId(contact.id)
    const { error: delErr } = await supabase
      .from('client_contacts')
      .delete()
      .eq('id', contact.id)
    setBusyId(null)
    if (delErr) {
      setError(delErr.message)
      return
    }
    setContacts((prev) => prev.filter((c) => c.id !== contact.id))
    router.refresh()
  }

  async function sendLoginInvite(contact: ClientContact, password: string) {
    setBusyId(contact.id)
    setError(null)
    try {
      const { userId } = await inviteUser({
        email: contact.email,
        fullName: contact.full_name,
        role: 'client',
        password,
      })
      // Mark the contact as having a login + link the user_id
      await supabase
        .from('client_contacts')
        .update({ has_login: true, user_id: userId })
        .eq('id', contact.id)

      // If this contact is primary, also set the client's user_id so RLS
      // for /my-progress works for the primary contact.
      if (contact.is_primary) {
        await supabase
          .from('clients')
          .update({ user_id: userId })
          .eq('id', clientId)
      }

      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id
            ? { ...c, has_login: true, user_id: userId }
            : c
        )
      )
      setInvitePromptFor(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite.')
      throw err
    } finally {
      setBusyId(null)
    }
  }

  async function addContact(input: AddContactInput) {
    setError(null)
    const isFirst = contacts.length === 0

    if (!input.password || input.password.length < 8) {
      throw new Error('Password must be at least 8 characters.')
    }

    // 1) Insert the contact row (no login yet)
    const { data: inserted, error: insErr } = await supabase
      .from('client_contacts')
      .insert({
        client_id: clientId,
        full_name: input.full_name.trim(),
        email: input.email.trim(),
        phone: input.phone?.trim() || null,
        role: input.role,
        is_primary: isFirst,
        has_login: false,
      })
      .select('*')
      .single()

    if (insErr || !inserted) {
      throw new Error(insErr?.message ?? 'Could not add contact.')
    }

    let next = inserted as ClientContact

    // 2) Always create the auth login via /api/invite. If it fails, roll
    //    back the contact row so the admin can retry with the same email.
    try {
      const { userId } = await inviteUser({
        email: input.email.trim(),
        fullName: input.full_name.trim(),
        role: 'client',
        password: input.password,
      })

      // 3) Mark the contact as having a login + link the user_id
      await supabase
        .from('client_contacts')
        .update({ has_login: true, user_id: userId })
        .eq('id', next.id)
      next = { ...next, has_login: true, user_id: userId }

      // 4) If this is the first (and therefore primary) contact, also
      //    sync clients.user_id so RLS for /my-progress works.
      if (next.is_primary) {
        await supabase
          .from('clients')
          .update({ user_id: userId })
          .eq('id', clientId)
      }
    } catch (err) {
      // Roll back the contact row
      await supabase.from('client_contacts').delete().eq('id', next.id)
      throw err
    }

    setContacts((prev) => [...prev, next])
    router.refresh()
  }

  return (
    <div className="glass-panel-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-kst-white font-semibold">Contacts</h3>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs px-3 h-8 rounded-full border border-kst-gold/60 text-kst-gold hover:bg-kst-gold/10 transition-colors"
        >
          <UserPlus size={12} />
          Add Contact
        </button>
      </div>

      {error && (
        <p className="text-kst-error text-xs mb-3">{error}</p>
      )}

      {contacts.length === 0 ? (
        <p className="text-kst-muted text-sm py-4 text-center">
          No contacts yet for {clientName}.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-kst-white font-medium truncate">
                    {c.full_name}
                  </span>
                  <ContactRoleBadge role={c.role} />
                  {c.is_primary && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-kst-gold/60 text-kst-gold bg-kst-gold/10">
                      <Star size={9} />
                      Primary
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs flex-wrap">
                  <a
                    href={`mailto:${c.email}`}
                    className="text-kst-muted hover:text-kst-gold transition-colors inline-flex items-center gap-1"
                  >
                    <Mail size={11} />
                    {c.email}
                  </a>
                  {c.phone && (
                    <span className="text-kst-muted inline-flex items-center gap-1">
                      <Phone size={11} />
                      {c.phone}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {c.has_login ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-kst-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-kst-success" />
                    Has login
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setInvitePromptFor(c)}
                    disabled={busyId === c.id}
                    className="text-[11px] px-2.5 h-7 rounded-full border border-kst-gold/60 text-kst-gold hover:bg-kst-gold/10 transition-colors disabled:opacity-60"
                  >
                    {busyId === c.id ? 'Sending…' : 'Invite'}
                  </button>
                )}

                <ContactRowMenu
                  contact={c}
                  busy={busyId === c.id}
                  canRemove={isAdmin}
                  onSetPrimary={() => setPrimary(c)}
                  onSendInvite={() => setInvitePromptFor(c)}
                  onRemove={() => removeContact(c)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {addOpen && (
        <AddContactModal
          onClose={() => setAddOpen(false)}
          onSubmit={async (input) => {
            await addContact(input)
            setAddOpen(false)
          }}
        />
      )}

      {invitePromptFor && (
        <LoginInvitePasswordModal
          contact={invitePromptFor}
          onCancel={() => setInvitePromptFor(null)}
          onSubmit={(password) => sendLoginInvite(invitePromptFor, password)}
        />
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

function ContactRoleBadge({ role }: { role: ContactRole }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/15 text-kst-muted">
      {ROLE_LABELS[role]}
    </span>
  )
}

function ContactRowMenu({
  contact,
  busy,
  canRemove,
  onSetPrimary,
  onSendInvite,
  onRemove,
}: {
  contact: ClientContact
  busy: boolean
  canRemove: boolean
  onSetPrimary: () => void
  onSendInvite: () => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, open, () => setOpen(false))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="w-8 h-8 rounded-full flex items-center justify-center text-kst-muted hover:text-kst-white hover:bg-white/[0.05] transition-colors disabled:opacity-60"
        aria-label="Open contact actions"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-[200px] kst-dropdown p-1 kst-fade-in z-50">
          {!contact.is_primary && (
            <MenuItem
              onClick={() => {
                setOpen(false)
                onSetPrimary()
              }}
            >
              <Star size={13} />
              Set as Primary
            </MenuItem>
          )}
          {!contact.has_login && (
            <MenuItem
              onClick={() => {
                setOpen(false)
                onSendInvite()
              }}
            >
              <Mail size={13} />
              Send Login Invite
            </MenuItem>
          )}
          {canRemove && (
            <MenuItem
              tone="danger"
              onClick={() => {
                setOpen(false)
                onRemove()
              }}
            >
              <Trash2 size={13} />
              Remove Contact
            </MenuItem>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  children,
  onClick,
  tone = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
        tone === 'danger'
          ? 'text-kst-error hover:bg-kst-error/10'
          : 'text-kst-white hover:bg-white/[0.06]'
      )}
    >
      {children}
    </button>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Add Contact modal
// ───────────────────────────────────────────────────────────────────────────

interface AddContactInput {
  full_name: string
  email: string
  phone: string
  role: ContactRole
  password: string
}

function AddContactModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (input: AddContactInput) => Promise<void>
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<ContactRole>('owner')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!fullName.trim() || !email.trim()) {
      setError('Name and email are required.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      await onSubmit({
        full_name: fullName,
        email,
        phone,
        role,
        password,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add contact.')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="glass-panel relative w-full max-w-[480px] p-7 max-h-[90vh] overflow-y-auto kst-fade-in">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-kst-muted hover:text-kst-white transition-colors"
        >
          <X size={18} />
        </button>
        <h2 className="text-kst-white text-xl font-semibold mb-6">
          Add Contact
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Full Name">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              className={inputClass}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className={inputClass}
            />
          </Field>
          <Field label="Role">
            <ContactRolePicker
              value={role}
              onChange={setRole}
              disabled={loading}
            />
          </Field>
          <Field label="Phone (optional)">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              className={inputClass}
            />
          </Field>

          <Field label="Password">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              autoComplete="new-password"
              disabled={loading}
              className={inputClass}
            />
            <span className="text-[11px] text-kst-muted mt-1">
              You&apos;ll share these credentials with the contact directly.
            </span>
          </Field>

          {error && <p className="text-kst-error text-sm">{error}</p>}

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 h-11 rounded-xl glass-panel-sm text-kst-muted hover:text-kst-white transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold hover:bg-kst-gold-light transition-colors text-sm disabled:opacity-60"
            >
              <UserPlus size={14} />
              {loading ? 'Adding…' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ContactRolePicker({
  value,
  onChange,
  disabled,
}: {
  value: ContactRole
  onChange: (r: ContactRole) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, open, () => setOpen(false))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(inputClass, 'flex items-center justify-between text-left')}
      >
        <span>{ROLE_LABELS[value]}</span>
        <span className="text-kst-muted text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-2 kst-dropdown p-1 kst-fade-in">
          {ROLE_OPTIONS.map((r) => {
            const active = r === value
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  onChange(r)
                  setOpen(false)
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-white/[0.06] transition-colors',
                  active && 'bg-kst-gold/10'
                )}
              >
                <span className={active ? 'text-kst-white' : 'text-kst-muted'}>
                  {ROLE_LABELS[r]}
                </span>
                {active && <Check size={13} className="text-kst-gold" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-kst-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full h-11 px-4 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors disabled:opacity-60'

// ───────────────────────────────────────────────────────────────────────────
// Login invite password modal
// ───────────────────────────────────────────────────────────────────────────

function LoginInvitePasswordModal({
  contact,
  onCancel,
  onSubmit,
}: {
  contact: ClientContact
  onCancel: () => void
  onSubmit: (password: string) => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      await onSubmit(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create login.')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onCancel}
      />
      <div className="glass-panel relative w-full max-w-[460px] p-7 kst-fade-in">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-kst-muted hover:text-kst-white transition-colors"
        >
          <X size={18} />
        </button>
        <h2 className="text-kst-white text-xl font-semibold mb-2">
          Create login for {contact.full_name}
        </h2>
        <p className="text-kst-muted text-sm mb-6">
          Set a password for{' '}
          <span className="text-kst-white">{contact.email}</span>. You&apos;ll
          share it with them directly — no email is sent.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Password">
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder="Min 8 characters"
              autoComplete="new-password"
              disabled={loading}
              className={inputClass}
            />
          </Field>

          {error && <p className="text-kst-error text-sm">{error}</p>}

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-5 h-11 rounded-xl glass-panel-sm text-kst-muted hover:text-kst-white transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold hover:bg-kst-gold-light transition-colors text-sm disabled:opacity-60"
            >
              <UserPlus size={14} />
              {loading ? 'Creating…' : 'Create Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
