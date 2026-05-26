'use client'

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────

interface MeetingSummary {
  id: string
  client_id: string
  week_number: number
  title: string
  content: string
  author_name: string | null
  created_by: string | null
  created_at: string
}

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
      <MeetingSummarySection clientId={clientId} weekNum={weekNum} currentUserId={currentUserId} currentUserName={currentUserName} />
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

// ─── Meeting Summaries (multiple per week, collapsible) ───────────────────

function MeetingSummarySection({
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
  const [entries, setEntries] = useState<MeetingSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/meeting-summaries?clientId=${clientId}&weekNum=${weekNum}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setEntries((json.data ?? []) as MeetingSummary[])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [clientId, weekNum])

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-kst-white font-semibold">
          <MessageSquare size={16} className="text-kst-gold" />
          Meeting Summaries
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
        <MeetingSummaryAddForm
          clientId={clientId}
          weekNum={weekNum}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onAdded={(entry) => {
            setEntries((prev) => [entry, ...prev])
            setAdding(false)
            setExpandedId(entry.id)
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {loading ? (
        <p className="text-kst-muted text-xs">Loading...</p>
      ) : entries.length === 0 && !adding ? (
        <p className="text-kst-muted text-xs">No meeting summaries yet.</p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <MeetingSummaryEntry
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === entry.id ? null : entry.id))
              }
              onDelete={() =>
                setEntries((prev) => prev.filter((e) => e.id !== entry.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MeetingSummaryAddForm({
  clientId,
  weekNum,
  currentUserId,
  currentUserName,
  onAdded,
  onCancel,
}: {
  clientId: string
  weekNum: number
  currentUserId: string | null
  currentUserName: string | null
  onAdded: (entry: MeetingSummary) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)
    const res = await fetch('/api/meeting-summaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        weekNum,
        title: title.trim() || 'Call',
        content: content.trim(),
        authorName: currentUserName,
        createdBy: currentUserId,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok || !json.data) return
    onAdded(json.data as MeetingSummary)
  }

  return (
    <div className="mb-3 p-4 rounded-xl bg-kst-dark border border-white/10 space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (e.g. Call May 18)"
        className="w-full px-3 py-2 rounded-lg bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted text-sm focus:outline-none focus:border-kst-gold/60 transition-colors"
      />
      <AutoTextarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste meeting notes here..."
      />
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 h-8 rounded-lg text-kst-muted text-xs hover:text-kst-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="px-3 h-8 rounded-lg bg-kst-gold text-kst-black font-semibold text-xs hover:bg-kst-gold-light transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Add'}
        </button>
      </div>
    </div>
  )
}

function MeetingSummaryEntry({
  entry,
  expanded,
  onToggle,
  onDelete,
}: {
  entry: MeetingSummary
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const dateLabel = new Date(entry.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [content, setContent] = useState(entry.content)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!dirtyRef.current) return
    const t = setTimeout(async () => {
      setSaveStatus('saving')
      await fetch('/api/meeting-summaries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, content: content.trim() }),
      })
      dirtyRef.current = false
      setSaveStatus('saved')
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
      }, 2000)
    }, 1500)
    return () => clearTimeout(t)
  }, [content, entry.id])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  function handleDelete() {
    fetch(`/api/meeting-summaries?id=${entry.id}`, { method: 'DELETE' })
    onDelete()
  }

  // Preview: first line or first 80 chars
  const preview = entry.content.split('\n')[0]?.slice(0, 80) || 'Empty'

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-kst-muted shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-kst-muted shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <span className="text-kst-white text-sm font-medium">
            {entry.title}
          </span>
          <span className="text-kst-muted text-xs ml-2">{dateLabel}</span>
          {!expanded && (
            <p className="text-kst-muted text-xs truncate mt-0.5">{preview}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saveStatus === 'saving' && (
            <span className="text-[11px] text-kst-muted">Saving…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[11px] text-kst-success">Saved</span>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          <AutoTextarea
            value={content}
            onChange={(e) => {
              dirtyRef.current = true
              setContent(e.target.value)
            }}
            placeholder="Meeting notes..."
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-kst-muted hover:text-kst-error hover:bg-kst-error/10 transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
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
  const [uiError, setUiError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setUiError(null)
    fetch(`/api/team-notes?clientId=${clientId}&weekNum=${weekNum}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          if (json.error) setUiError(`Fetch: ${json.error}`)
          setNotes((json.data ?? []) as TeamNote[])
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setUiError(`Fetch crash: ${err}`)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [clientId, weekNum])

  async function handleAdd() {
    if (!newContent.trim()) return
    setUiError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/team-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          weekNum,
          content: newContent.trim(),
          authorName: currentUserName,
          createdBy: currentUserId,
        }),
      })
      const json = await res.json()
      setSaving(false)
      if (!res.ok || json.error || !json.data) {
        setUiError(`Save: ${json.error ?? `HTTP ${res.status}`}`)
        return
      }
      setNotes((prev) => [json.data as TeamNote, ...prev])
      setNewContent('')
      setAdding(false)
    } catch (err) {
      setSaving(false)
      setUiError(`Save crash: ${err}`)
    }
  }

  async function handleDelete(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    fetch(`/api/team-notes?id=${id}`, { method: 'DELETE' })
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

      {uiError && (
        <p className="text-red-400 text-xs mb-2 p-2 bg-red-500/10 rounded-lg break-all">
          {uiError}
        </p>
      )}

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
