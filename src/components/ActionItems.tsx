'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Circle, Loader2, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface ActionItemsProps {
  clientId: string
  weekNum: number
  reportId: string | null
  currentUserId: string | null
}

interface ActionItem {
  id: string
  title: string
  assigned_to: string | null
  assigned_name: string | null
  due_date: string | null
  status: 'not_started' | 'in_progress' | 'completed'
  completed_at: string | null
  created_at: string
}

interface TeamMember {
  id: string
  full_name: string | null
  specialty: string | null
}

const STATUS_ICON: Record<string, { cls: string; label: string }> = {
  not_started: { cls: 'text-kst-muted', label: 'Not started' },
  in_progress: { cls: 'text-kst-gold', label: 'In progress' },
  completed: { cls: 'text-kst-success', label: 'Completed' },
}

const NEXT_STATUS: Record<string, string> = {
  not_started: 'in_progress',
  in_progress: 'completed',
  completed: 'not_started',
}

export function ActionItems({ clientId, weekNum, reportId, currentUserId }: ActionItemsProps) {
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<ActionItem[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  // Add form state
  const [newTitle, setNewTitle] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchItems = useCallback(async () => {
    let query = supabase
      .from('action_items')
      .select('id, title, assigned_to, due_date, status, completed_at, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })

    if (reportId) {
      query = query.eq('weekly_report_id', reportId)
    } else {
      query = query.is('weekly_report_id', null)
    }

    const { data } = await query
    const rows = (data ?? []) as Array<{
      id: string
      title: string
      assigned_to: string | null
      due_date: string | null
      status: string
      completed_at: string | null
      created_at: string
    }>

    // Batch-fetch assignee names
    const assigneeIds = [...new Set(rows.map((r) => r.assigned_to).filter(Boolean))] as string[]
    const nameMap = new Map<string, string>()
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', assigneeIds)
      for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
        if (p.full_name) nameMap.set(p.id, p.full_name)
      }
    }

    setItems(
      rows.map((r) => ({
        ...r,
        status: r.status as ActionItem['status'],
        assigned_name: r.assigned_to ? nameMap.get(r.assigned_to) ?? null : null,
      }))
    )
    setLoading(false)
  }, [supabase, clientId, reportId])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Fetch team members once
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, specialty')
      .in('role', ['admin', 'csm'])
      .order('full_name')
      .then(({ data }) => setTeam((data ?? []) as TeamMember[]))
  }, [supabase])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`action-items-${clientId}-${weekNum}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'action_items',
          filter: `client_id=eq.${clientId}`,
        },
        () => fetchItems()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, clientId, weekNum, fetchItems])

  async function handleStatusToggle(item: ActionItem) {
    const next = NEXT_STATUS[item.status] as ActionItem['status']
    const completedAt = next === 'completed' ? new Date().toISOString() : null

    // Optimistic
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: next, completed_at: completedAt } : i))
    )

    const { error } = await supabase
      .from('action_items')
      .update({ status: next, completed_at: completedAt })
      .eq('id', item.id)

    if (error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: item.status, completed_at: item.completed_at } : i))
      )
    }
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    await supabase.from('action_items').delete().eq('id', id)
  }

  async function handleAdd() {
    if (!newTitle.trim()) return
    setSaving(true)

    const { error } = await supabase.from('action_items').insert({
      client_id: clientId,
      weekly_report_id: reportId,
      title: newTitle.trim(),
      assigned_to: newAssignee || null,
      due_date: newDueDate || null,
      status: 'not_started',
      created_by: currentUserId,
    })

    setSaving(false)
    if (error) return

    // Fire-and-forget Discord notification
    if (newAssignee) {
      fetch('/api/notifications/client-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'action_item_created',
          clientId,
          actionItemTitle: newTitle.trim(),
          assignedTo: newAssignee,
        }),
      }).catch(() => {})
    }

    setNewTitle('')
    setNewAssignee('')
    setNewDueDate('')
    setAdding(false)
    fetchItems()
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const in3 = new Date()
  in3.setDate(in3.getDate() + 3)
  const in3Iso = in3.toISOString().slice(0, 10)

  if (loading) return <p className="text-kst-muted text-xs py-2">Loading...</p>

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isCompleted = item.status === 'completed'
        const isOverdue = !isCompleted && item.due_date && item.due_date < todayIso
        const isSoon = !isCompleted && !isOverdue && item.due_date && item.due_date <= in3Iso

        return (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-2 py-1.5 group',
              isCompleted && 'opacity-50'
            )}
          >
            <button
              type="button"
              onClick={() => handleStatusToggle(item)}
              className="shrink-0"
              title={STATUS_ICON[item.status]?.label}
            >
              {isCompleted ? (
                <Check size={14} className="text-kst-success" />
              ) : item.status === 'in_progress' ? (
                <Loader2 size={14} className="text-kst-gold" />
              ) : (
                <Circle size={14} className="text-kst-muted" />
              )}
            </button>

            <span
              className={cn(
                'flex-1 text-sm truncate',
                isCompleted ? 'line-through text-kst-muted' : 'text-kst-white'
              )}
            >
              {item.title}
            </span>

            {item.assigned_name && (
              <span className="text-[10px] text-kst-muted shrink-0">
                {item.assigned_name}
              </span>
            )}

            {item.due_date && (
              <span
                className={cn(
                  'text-[10px] shrink-0',
                  isOverdue ? 'text-red-400' : isSoon ? 'text-kst-gold' : 'text-kst-muted'
                )}
              >
                {item.due_date.slice(5).replace('-', '/')}
              </span>
            )}

            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-kst-muted hover:text-kst-error transition-all"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )
      })}

      {adding ? (
        <div className="space-y-2 pt-1">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Action item title..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') setAdding(false)
            }}
            className="w-full h-9 px-3 rounded-lg bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors"
          />
          <div className="flex gap-2">
            <select
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg bg-kst-dark border border-white/10 text-kst-white text-sm focus:outline-none focus:border-kst-gold/60 appearance-none"
            >
              <option value="">Unassigned</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name ?? 'Unknown'}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="h-9 px-3 rounded-lg bg-kst-dark border border-white/10 text-kst-white text-sm focus:outline-none focus:border-kst-gold/60"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-3 h-8 rounded-lg text-kst-muted text-xs hover:text-kst-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !newTitle.trim()}
              onClick={handleAdd}
              className="px-3 h-8 rounded-lg bg-kst-gold/20 text-kst-gold text-xs font-medium hover:bg-kst-gold/30 transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-kst-muted text-xs hover:text-kst-gold transition-colors py-1"
        >
          <Plus size={12} />
          Add action item
        </button>
      )}
    </div>
  )
}
