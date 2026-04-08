'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { CsmOption } from '@/lib/types'

interface AddClientModalProps {
  open: boolean
  onClose: () => void
  csms: CsmOption[]
}

interface FieldErrors {
  company_name?: string
  contact_name?: string
  contact_email?: string
}

const inputClass =
  'w-full h-11 px-4 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors disabled:opacity-60'

export function AddClientModal({ open, onClose, csms }: AddClientModalProps) {
  const router = useRouter()
  const supabase = createClient()

  const today = new Date().toISOString().slice(0, 10)
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [joinedDate, setJoinedDate] = useState(today)
  const [csmId, setCsmId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Reset state when the modal closes
  useEffect(() => {
    if (!open) {
      setCompanyName('')
      setContactName('')
      setContactEmail('')
      setJoinedDate(today)
      setCsmId('')
      setNotes('')
      setFieldErrors({})
      setSubmitError(null)
      setLoading(false)
    }
  }, [open, today])

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
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})

    setLoading(true)
    const { error } = await supabase.from('clients').insert({
      company_name: companyName.trim(),
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim(),
      joined_date: joinedDate || null,
      assigned_csm: csmId || null,
      notes: notes.trim() || null,
      status: 'onboarding',
    })

    if (error) {
      setSubmitError(error.message)
      setLoading(false)
      return
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Joined Date">
              <input
                type="date"
                value={joinedDate}
                onChange={(e) => setJoinedDate(e.target.value)}
                disabled={loading}
                className={inputClass}
              />
            </Field>

            <Field label="Assigned CSM">
              <select
                value={csmId}
                onChange={(e) => setCsmId(e.target.value)}
                disabled={loading}
                className={cn(inputClass, 'appearance-none pr-9')}
              >
                <option value="">Unassigned</option>
                {csms.map((csm) => (
                  <option key={csm.id} value={csm.id}>
                    {csm.full_name ?? 'Unnamed'}
                  </option>
                ))}
              </select>
            </Field>
          </div>

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
