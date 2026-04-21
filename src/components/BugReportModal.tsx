'use client'

import { useState, type FormEvent } from 'react'
import { Camera, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface BugReportPanelProps {
  onClose: () => void
  userName: string
  userOrganization?: string
}

type ReportType = 'bug' | 'suggestion'

const TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'suggestion', label: 'Suggestion' },
]

export function BugReportPanel({ onClose, userName, userOrganization }: BugReportPanelProps) {
  const supabase = createClient()
  const toast = useToast()

  const [name, setName] = useState(userName)
  const [type, setType] = useState<ReportType>('bug')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSubmitting(true)

    let screenshotUrl: string | null = null

    // Upload screenshot if provided
    if (file) {
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('bug-screenshots')
        .upload(path, file)
      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from('bug-screenshots')
          .getPublicUrl(path)
        screenshotUrl = urlData.publicUrl
      }
    }

    const { data: userData } = await supabase.auth.getUser()

    const { error } = await supabase.from('bug_reports').insert({
      submitted_by: userData.user?.id ?? null,
      submitted_name: name.trim() || null,
      organization: userOrganization ?? null,
      type,
      description: description.trim(),
      screenshot_url: screenshotUrl,
      status: 'to_do',
    })

    setSubmitting(false)
    if (error) {
      toast.error(`Could not submit: ${error.message}`)
      return
    }

    toast.success('Report submitted — thank you!')
    setDescription('')
    setFile(null)
    setType('bug')
    onClose()
  }

  return (
    <div className="flex flex-col flex-1 p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-kst-white text-base font-semibold">Report a Bug</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-kst-muted hover:text-kst-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
        {/* Name */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-kst-muted">Your Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full h-10 px-3.5 rounded-xl bg-kst-dark border border-white/10 text-kst-white text-sm placeholder:text-kst-muted focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors"
          />
        </label>

        {/* Type pills */}
        <div>
          <span className="block text-xs uppercase tracking-wider text-kst-muted mb-2">Type</span>
          <div className="flex gap-2">
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  'px-3 h-8 rounded-full text-xs font-medium border transition-colors',
                  type === t.value
                    ? 'border-kst-gold/60 text-kst-gold bg-kst-gold/10'
                    : 'border-white/10 text-kst-muted hover:text-kst-white hover:border-white/20'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wider text-kst-muted">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            placeholder="Describe the bug or suggestion..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors resize-vertical"
          />
        </label>

        {/* Screenshot */}
        <div>
          <span className="block text-xs uppercase tracking-wider text-kst-muted mb-2">
            Screenshot (Optional)
          </span>
          <label className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-dashed border-white/15 hover:border-white/25 cursor-pointer transition-colors">
            <Camera size={16} className="text-kst-muted shrink-0" />
            <span className="text-sm text-kst-muted truncate">
              {file ? file.name : 'Click to upload'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !description.trim()}
          className="w-full h-10 rounded-xl bg-kst-gold text-kst-black font-semibold hover:bg-kst-gold-light transition-colors text-sm disabled:opacity-60 mt-auto"
        >
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  )
}
