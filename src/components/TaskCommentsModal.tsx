'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface TaskCommentsModalProps {
  open: boolean
  onClose: () => void
  clientTaskId: string
  taskTitle: string
  currentUserId: string | null
}

interface TaskComment {
  id: string
  client_task_id: string
  author_id: string
  content: string
  created_at: string
  author?: {
    full_name: string | null
    role: string | null
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initialsOf(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function TaskCommentsModal({
  open,
  onClose,
  clientTaskId,
  taskTitle,
  currentUserId,
}: TaskCommentsModalProps) {
  const supabase = useMemo(() => createClient(), [])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function fetchComments() {
    const { data } = await supabase
      .from('task_comments')
      .select('*, author:profiles!author_id(full_name, role)')
      .eq('client_task_id', clientTaskId)
      .order('created_at', { ascending: true })

    const rows: TaskComment[] = []
    for (const r of (data ?? []) as unknown[]) {
      const obj = r as Record<string, unknown>
      const author = Array.isArray(obj.author) ? obj.author[0] : obj.author
      const authorObj = (author ?? {}) as Record<string, unknown>
      rows.push({
        id: obj.id as string,
        client_task_id: obj.client_task_id as string,
        author_id: obj.author_id as string,
        content: obj.content as string,
        created_at: obj.created_at as string,
        author: {
          full_name: (authorObj.full_name as string | null) ?? null,
          role: (authorObj.role as string | null) ?? null,
        },
      })
    }
    setComments(rows)
    setLoading(false)
  }

  useEffect(() => {
    if (open) {
      setLoading(true)
      fetchComments()
    }
  }, [open, clientTaskId])

  // Auto-scroll on new comments
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments])

  // Realtime
  useEffect(() => {
    if (!open) return
    const channel = supabase
      .channel(`comments-${clientTaskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments',
          filter: `client_task_id=eq.${clientTaskId}`,
        },
        async (payload) => {
          const newComment = payload.new as TaskComment
          // Don't duplicate if we already added it optimistically
          setComments((prev) => {
            if (prev.some((c) => c.id === newComment.id)) return prev
            return prev // Let fetchComments handle it for author info
          })
          fetchComments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, clientTaskId, open])

  async function handleSend() {
    if (!input.trim() || !currentUserId) return
    setSending(true)

    const { error } = await supabase.from('task_comments').insert({
      client_task_id: clientTaskId,
      author_id: currentUserId,
      content: input.trim(),
    })

    setSending(false)
    if (!error) {
      setInput('')
      fetchComments()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/70 backdrop-blur-[20px] backdrop-saturate-[1.2]"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start md:items-center justify-center p-4 py-8 md:py-16">
        <div
          className="glass-panel-modal relative w-full max-w-lg flex flex-col"
          style={{ maxHeight: '80vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
            <div className="min-w-0">
              <h2 className="text-kst-white font-semibold text-sm truncate">Comments</h2>
              <p className="text-kst-muted text-xs truncate mt-0.5">{taskTitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-kst-muted hover:text-kst-white transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Comments area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {loading ? (
              <p className="text-kst-muted text-sm text-center py-8">Loading...</p>
            ) : comments.length === 0 ? (
              <p className="text-kst-muted text-sm text-center py-8">No comments yet. Start the conversation.</p>
            ) : (
              comments.map((c) => {
                const isTeam = c.author?.role === 'admin' || c.author?.role === 'csm'
                const isMe = c.author_id === currentUserId
                return (
                  <div key={c.id} className="flex gap-3">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0',
                        isTeam
                          ? 'border border-kst-gold/60 text-kst-gold bg-white/[0.02]'
                          : 'border border-white/20 text-kst-muted bg-white/[0.02]'
                      )}
                    >
                      {initialsOf(c.author?.full_name ?? null)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-xs font-medium', isMe ? 'text-kst-gold' : 'text-kst-white')}>
                          {c.author?.full_name ?? 'Unknown'}
                        </span>
                        {isTeam && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-kst-gold/10 text-kst-gold">
                            Team
                          </span>
                        )}
                        <span className="text-[10px] text-kst-muted">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-kst-white/90 mt-0.5 whitespace-pre-wrap break-words">
                        {c.content}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-white/[0.06] shrink-0">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Write a comment..."
                rows={1}
                className="flex-1 px-3 py-2 rounded-lg bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors resize-none"
              />
              <button
                type="button"
                disabled={sending || !input.trim()}
                onClick={handleSend}
                className="px-3 h-10 rounded-lg bg-kst-gold/20 text-kst-gold hover:bg-kst-gold/30 transition-colors disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
