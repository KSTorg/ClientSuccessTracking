'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  FileText,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  fetchTeamNotes,
  addTeamNote,
  deleteTeamNote,
} from '@/lib/actions/team-notes'

// ─── Types ────────────────────────────────────────────────────────────────

interface TeamNote {
  id: string
  client_id: string
  week_number: number
  content: string
  author_name: string | null
  created_by: string | null
  created_at: string
}

export interface WeekNotesSidebarProps {
  clientId: string
  weekNum: number
  weekLabel: string
  /** unused — meeting summary is self-fetched */
  meetingSummary?: string
  /** unused — meeting summary is self-saved */
  onMeetingSummaryChange?: (value: string) => void
  currentUserId: string | null
  currentUserName: string | null
}

// ─── Sidebar content (used both inline and inside popup) ──────────────────

export function WeekNotesSidebar({
  clientId,
  weekNum,
  currentUserId,
  currentUserName,
}: WeekNotesSidebarProps) {
  return (
    <div className="space-y-4">
      <MeetingSummarySection clientId={clientId} weekNum={weekNum} />
      <TeamNotesSection
        clientId={clientId}
        weekNum={weekNum}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────

export function WeekNotesSidebarEmpty() {
  return (
    <div className="glass-panel p-6 text-center">
      <p className="text-kst-muted text-sm">
        Expand a week to see its notes
      </p>
    </div>
  )
}

// ─── Fullscreen popup (narrow screens) ────────────────────────────────────

export function WeekNotesPopup({
  onClose,
  ...props
}: WeekNotesSidebarProps & { onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] bg-kst-dark/95 backdrop-blur-sm flex flex-col kst-fade-in">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <h2
          className="text-kst-gold text-lg font-semibold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {props.weekLabel}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/[0.06] text-kst-muted hover:text-kst-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <WeekNotesSidebar {...props} />
      </div>
    </div>
  )
}

// ─── Meeting Summary (self-contained: fetches + saves to weekly_reports) ──

function MeetingSummarySection({
  clientId,
  weekNum,
}: {
  clientId: string
  weekNum: number
}) {
  const supabase = useMemo(() => createClient(), [])
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const dirtyRef = useRef(false)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch current meeting_summary for this week
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('weekly_reports')
      .select('meeting_summary')
      .eq('client_id', clientId)
      .eq('week_number', weekNum)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setValue((data as { meeting_summary: string | null } | null)?.meeting_summary ?? '')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [clientId, weekNum, supabase])

  const doSave = useCallback(async (content: string) => {
    setSaveStatus('saving')
    const { error } = await supabase
      .from('weekly_reports')
      .update({ meeting_summary: content.trim() || null })
      .eq('client_id', clientId)
      .eq('week_number', weekNum)
    dirtyRef.current = false
    if (error) {
      console.error('[MeetingSummary] save failed:', error)
      setSaveStatus('idle')
      return
    }
    setSaveStatus('saved')
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    fadeTimerRef.current = setTimeout(() => {
      setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
    }, 2000)
  }, [clientId, weekNum, supabase])

  // Debounced save
  useEffect(() => {
    if (!dirtyRef.current) return
    const t = setTimeout(() => doSave(value), 1500)
    return () => clearTimeout(t)
  }, [value, doSave])

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [])

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    dirtyRef.current = true
    setValue(e.target.value)
  }

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-kst-white font-semibold">
          <MessageSquare size={16} className="text-kst-gold" />
          Meeting Summary
        </h3>
        {saveStatus === 'saving' && (
          <span className="text-[11px] text-kst-muted">Saving…</span>
        )}
        {saveStatus === 'saved' && (
          <span className="text-[11px] text-kst-success kst-fade-in">Saved</span>
        )}
      </div>
      {loading ? (
        <p className="text-kst-muted text-xs">Loading...</p>
      ) : (
        <AutoTextarea
          value={value}
          onChange={handleChange}
          placeholder="Paste meeting notes here..."
        />
      )}
    </div>
  )
}

// ─── Team Notes (comment thread) ──────────────────────────────────────────

function TeamNotesSection({
  clientId,
  weekNum,
  currentUserId,
  currentUserName,
}: {
  clientId: string
  weekNum: number
  currentUserId: string | null
  currentUserName: string | null
}) {
  const [notes, setNotes] = useState<TeamNote[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchTeamNotes(clientId, weekNum).then(({ data }) => {
      if (!cancelled) {
        setNotes((data ?? []) as TeamNote[])
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [clientId, weekNum])

  async function handleAdd() {
    if (!newContent.trim()) return
    setSaving(true)
    const { data, error } = await addTeamNote(
      clientId,
      weekNum,
      newContent.trim(),
      currentUserName,
      currentUserId,
    )
    setSaving(false)
    if (error || !data) {
      console.error('[TeamNotes] insert failed:', error)
      return
    }
    setNotes((prev) => [data as TeamNote, ...prev])
    setNewContent('')
    setAdding(false)
  }

  async function handleDelete(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    await deleteTeamNote(id)
  }

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-kst-white font-semibold">
          <FileText size={16} className="text-kst-gold" />
          Team Notes
        </h3>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-kst-muted hover:text-kst-gold transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {adding && (
        <div className="mb-4 p-4 rounded-xl bg-kst-dark border border-white/10 space-y-3">
          <AutoTextarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write a team note..."
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setAdding(false); setNewContent('') }}
              className="px-3 h-8 rounded-lg text-kst-muted text-xs hover:text-kst-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !newContent.trim()}
              className="px-3 h-8 rounded-lg bg-kst-gold text-kst-black font-semibold text-xs hover:bg-kst-gold-light transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-kst-muted text-xs">Loading...</p>
      ) : notes.length === 0 && !adding ? (
        <p className="text-kst-muted text-xs">No team notes yet.</p>
      ) : (
        <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] overflow-hidden">
          {notes.map((n) => {
            const dateLabel = new Date(n.created_at).toLocaleDateString(
              'en-US',
              { month: 'short', day: 'numeric' }
            )
            return (
              <div key={n.id} className="px-4 py-3 group">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs">
                    <span className="text-kst-gold font-medium">
                      {n.author_name ?? 'Unknown'}
                    </span>
                    <span className="text-kst-muted ml-2">{dateLabel}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDelete(n.id)}
                    className="p-1 rounded hover:bg-kst-error/10 text-kst-muted hover:text-kst-error transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-kst-white text-sm whitespace-pre-wrap">
                  {n.content}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Shared textarea ──────────────────────────────────────────────────────

function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  placeholder: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 72)}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={3}
      className={cn(
        'w-full min-h-[72px] px-4 py-3 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors resize-none overflow-hidden',
        className
      )}
    />
  )
}
