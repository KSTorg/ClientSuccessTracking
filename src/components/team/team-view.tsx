'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  MoreVertical,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { inviteUser } from '@/lib/supabase/invite'
import { cn } from '@/lib/utils'
import type { Role } from '@/lib/supabase/get-user'

interface TeamMember {
  id: string
  full_name: string | null
  email: string | null
  role: Role
}

interface TeamViewProps {
  members: TeamMember[]
  currentUserId: string
  currentUserRole: Role
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  csm: 'CSM',
  client: 'Client',
}

function initialsOf(name: string | null, email: string | null): string {
  const source = (name ?? email ?? '?').trim()
  if (!source) return '?'
  const parts = source.split(/\s+/)
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

export function TeamView({
  members: initialMembers,
  currentUserId,
  currentUserRole,
}: TeamViewProps) {
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = currentUserRole === 'admin'

  const [members, setMembers] = useState(initialMembers)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function changeRole(member: TeamMember, nextRole: Role) {
    setSavingId(member.id)
    const prev = member.role
    setMembers((m) =>
      m.map((x) => (x.id === member.id ? { ...x, role: nextRole } : x))
    )
    const { error } = await supabase
      .from('profiles')
      .update({ role: nextRole })
      .eq('id', member.id)
    setSavingId(null)
    if (error) {
      setMembers((m) =>
        m.map((x) => (x.id === member.id ? { ...x, role: prev } : x))
      )
      alert(`Could not change role: ${error.message}`)
      return
    }
    router.refresh()
  }

  async function removeMember(member: TeamMember) {
    setRemoveError(null)

    // Client-side guardrails — same checks the API route also enforces, but
    // bail early so we don't waste a network round-trip.
    if (member.id === currentUserId) {
      setRemoveError('You cannot remove your own account.')
      return
    }
    if (member.role === 'admin') {
      setRemoveError(
        'Admins cannot be removed from this screen. Demote them to CSM first if needed.'
      )
      return
    }
    if (member.role !== 'csm') {
      setRemoveError('Only CSM team members can be removed here.')
      return
    }

    // Hand off to the server-side admin route, which deletes both the
    // profile row and the auth.users row using the service_role key.
    let res: Response
    try {
      res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id }),
      })
    } catch (err) {
      console.error('[team] delete-user fetch failed:', err)
      setRemoveError(
        err instanceof Error ? err.message : 'Network error during delete.'
      )
      return
    }

    let data: { success?: boolean; error?: string } = {}
    try {
      data = await res.json()
    } catch {
      // ignore — fall through to status check below
    }

    if (!res.ok || !data.success) {
      setRemoveError(data.error || `Delete failed (${res.status})`)
      return
    }

    setMembers((m) => m.filter((x) => x.id !== member.id))
    setConfirmRemove(null)
    router.refresh()
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8 gap-4">
        <h1
          className="text-5xl md:text-6xl text-kst-gold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Team
        </h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold hover:bg-kst-gold-light transition-colors text-sm"
          >
            <UserPlus size={16} />
            Invite Team Member
          </button>
        )}
      </div>

      {!isAdmin && (
        <p className="text-kst-muted text-xs mb-4">
          You have read-only access to the team list. Only admins can invite,
          change roles, or remove members.
        </p>
      )}

      <div className="glass-panel">
        {members.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-kst-muted text-sm">
              No team members yet. Add your first one to get started.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {members.map((member) => {
              const isMe = member.id === currentUserId
              return (
                <li
                  key={member.id}
                  className="flex items-center gap-4 px-5 py-4"
                >
                  <div className="w-10 h-10 rounded-full border border-kst-gold/60 text-kst-gold flex items-center justify-center text-xs font-semibold bg-white/[0.02] shrink-0">
                    {initialsOf(member.full_name, member.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-kst-white font-medium truncate">
                      {member.full_name ?? '(no name)'}
                      {isMe && (
                        <span className="text-kst-muted text-xs ml-2 font-normal">
                          (You)
                        </span>
                      )}
                    </p>
                    <p className="text-kst-muted text-xs truncate">
                      {member.email ?? '—'}
                    </p>
                  </div>
                  <RoleBadge role={member.role} />
                  {isAdmin && (
                    <RowMenu
                      member={member}
                      isMe={isMe}
                      saving={savingId === member.id}
                      onChangeRole={changeRole}
                      onRemove={() => setConfirmRemove(member)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {inviteOpen && (
        <InviteTeamModal
          onClose={() => setInviteOpen(false)}
          onInvited={() => {
            setInviteOpen(false)
            router.refresh()
          }}
        />
      )}

      {confirmRemove && (
        <ConfirmRemoveModal
          member={confirmRemove}
          error={removeError}
          onCancel={() => {
            setConfirmRemove(null)
            setRemoveError(null)
          }}
          onConfirm={() => removeMember(confirmRemove)}
        />
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-kst-gold/60 text-kst-gold bg-kst-gold/10">
        <ShieldCheck size={11} />
        Admin
      </span>
    )
  }
  if (role === 'csm') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
        style={{
          color: '#60A5FA',
          borderColor: 'rgba(96, 165, 250, 0.55)',
          background: 'rgba(96, 165, 250, 0.10)',
        }}
      >
        <Shield size={11} />
        CSM
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-white/10 text-kst-muted">
      Client
    </span>
  )
}

function RowMenu({
  member,
  isMe,
  saving,
  onChangeRole,
  onRemove,
}: {
  member: TeamMember
  isMe: boolean
  saving: boolean
  onChangeRole: (member: TeamMember, role: Role) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const [showRoles, setShowRoles] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, open, () => {
    setOpen(false)
    setShowRoles(false)
  })

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className="w-9 h-9 rounded-full flex items-center justify-center text-kst-muted hover:text-kst-white hover:bg-white/[0.05] transition-colors disabled:opacity-60"
        aria-label="Open actions"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-[200px] kst-dropdown p-1 kst-fade-in z-50">
          {!showRoles ? (
            <>
              <MenuItem onClick={() => setShowRoles(true)}>
                Change Role
              </MenuItem>
              <MenuItem
                disabled={isMe || member.role !== 'csm'}
                tone="danger"
                onClick={() => {
                  setOpen(false)
                  onRemove()
                }}
              >
                <Trash2 size={13} />
                Remove from Team
              </MenuItem>
            </>
          ) : (
            <>
              {(['admin', 'csm'] as Role[]).map((r) => {
                const active = member.role === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      setShowRoles(false)
                      if (!active) onChangeRole(member, r)
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm hover:bg-white/[0.06] transition-colors',
                      active && 'bg-kst-gold/10 text-kst-white'
                    )}
                  >
                    <span>{ROLE_LABELS[r]}</span>
                    {active && <Check size={13} className="text-kst-gold" />}
                  </button>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  children,
  onClick,
  disabled,
  tone = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
        disabled && 'opacity-40 cursor-not-allowed',
        !disabled &&
          (tone === 'danger'
            ? 'text-kst-error hover:bg-kst-error/10'
            : 'text-kst-white hover:bg-white/[0.06]')
      )}
    >
      {children}
    </button>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Invite modal
// ───────────────────────────────────────────────────────────────────────────

function InviteTeamModal({
  onClose,
  onInvited,
}: {
  onClose: () => void
  onInvited: () => void
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('csm')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
    setLoading(true)
    try {
      await inviteUser({
        email: email.trim(),
        fullName: fullName.trim(),
        role,
      })
      setSuccess(true)
      setTimeout(onInvited, 1500)
    } catch (err) {
      console.error('[invite modal] inviteUser threw:', err)
      setError(err instanceof Error ? err.message : 'Could not invite user.')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="glass-panel relative w-full max-w-[480px] p-7 kst-fade-in">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-kst-muted hover:text-kst-white transition-colors"
        >
          <X size={18} />
        </button>
        <h2 className="text-kst-white text-xl font-semibold mb-6">
          Invite Team Member
        </h2>

        {success ? (
          <p className="text-kst-success text-sm">
            Invite sent! They&apos;ll receive an email to set their password.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Full Name">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                disabled={loading}
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@kst.com"
                disabled={loading}
                className={inputClass}
              />
            </Field>
            <Field label="Role">
              <RolePicker value={role} onChange={setRole} disabled={loading} />
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
                {loading ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function ConfirmRemoveModal({
  member,
  error,
  onCancel,
  onConfirm,
}: {
  member: TeamMember
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const expected = (member.full_name ?? member.email ?? '').trim()
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === expected && expected.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onCancel}
      />
      <div className="glass-panel relative w-full max-w-[460px] p-7 kst-fade-in">
        <h2 className="text-kst-white text-xl font-semibold mb-3">
          Remove team member?
        </h2>
        <p className="text-kst-muted text-sm mb-4">
          This will remove{' '}
          <span className="text-kst-white">{expected}</span> from the team.
          Their profile row will be deleted; you may need to delete the auth
          user separately in Supabase.
        </p>
        <p className="text-kst-muted text-xs mb-2">
          Type{' '}
          <span className="text-kst-white font-medium">{expected}</span> to
          confirm:
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          placeholder={expected}
          className="w-full h-11 px-4 mb-4 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted text-sm focus:outline-none focus:border-kst-error/60 focus:ring-2 focus:ring-kst-error/20 transition-colors"
        />
        {error && <p className="text-kst-error text-xs mb-3">{error}</p>}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 h-11 rounded-xl glass-panel-sm text-kst-muted hover:text-kst-white transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-kst-error text-kst-black font-semibold text-sm hover:bg-kst-error/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: Role
  onChange: (r: Role) => void
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
          {(['admin', 'csm'] as Role[]).map((r) => {
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
