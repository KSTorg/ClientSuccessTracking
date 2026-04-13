'use client'

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  FileText,
  GripVertical,
  MoreHorizontal,
  PlayCircle,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface TemplateTask {
  id: string
  stage_id: string
  title: string
  description: string | null
  training_url: string | null
  doc_url: string | null
  extra_links: Record<string, string> | null
  order_index: number
  has_subtasks: boolean
  parent_task_id: string | null
  default_specialty: string | null
  due_days_offset: number | null
  subtask_group: string | null
  is_active: boolean
  accelerator_hide_docs: boolean | null
  client_facing_accelerator: boolean | null
}

interface TaskEditorRowProps {
  task: TemplateTask
  subtasks: TemplateTask[]
  program: 'educator_incubator' | 'accelerator'
  isSubtask?: boolean
  onUpdated: () => void
  onAddSubtask?: (parentId: string) => void
}

const SPECIALTIES = [
  { value: '', label: 'None' },
  { value: 'ads', label: 'Ads' },
  { value: 'systems', label: 'Systems' },
  { value: 'organic', label: 'Organic' },
  { value: 'sales', label: 'Sales' },
]

const SPEC_SHORT: Record<string, string> = {
  ads: 'Ads',
  systems: 'Sys',
  organic: 'Org',
  sales: 'Sales',
}

export function TaskEditorRow({
  task,
  subtasks,
  program,
  isSubtask,
  onUpdated,
  onAddSubtask,
}: TaskEditorRowProps) {
  const supabase = createClient()
  const toast = useToast()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingTitle && titleRef.current) titleRef.current.focus()
  }, [editingTitle])

  async function saveTitle() {
    if (!titleDraft.trim() || titleDraft.trim() === task.title) {
      setEditingTitle(false)
      return
    }
    await supabase.from('tasks').update({ title: titleDraft.trim() }).eq('id', task.id)
    setEditingTitle(false)
    onUpdated()
  }

  // Due offset editing
  const [editingDue, setEditingDue] = useState(false)
  const [dueDraft, setDueDraft] = useState(String(task.due_days_offset ?? ''))

  async function saveDue() {
    const val = dueDraft.trim() ? Number(dueDraft) : null
    await supabase.from('tasks').update({ due_days_offset: val }).eq('id', task.id)
    setEditingDue(false)
    onUpdated()
  }

  // Specialty editing
  const [editingSpec, setEditingSpec] = useState(false)

  async function saveSpec(val: string) {
    await supabase.from('tasks').update({ default_specialty: val || null }).eq('id', task.id)
    setEditingSpec(false)
    onUpdated()
  }

  // Menu
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    // Soft delete: set is_active = false
    await supabase.from('tasks').update({ is_active: false }).eq('id', task.id)
    // Also soft-delete subtasks
    if (task.has_subtasks) {
      await supabase.from('tasks').update({ is_active: false }).eq('parent_task_id', task.id)
    }
    toast.success('Task removed')
    setMenuOpen(false)
    setConfirmDelete(false)
    onUpdated()
  }

  const hasTraining = !!task.training_url?.trim()
  const hasDoc = !!task.doc_url?.trim()
  const hasExtras = task.extra_links && Object.keys(task.extra_links).length > 0
  const hasAnyLink = hasTraining || hasDoc || hasExtras

  // Links editing
  const [linksOpen, setLinksOpen] = useState(false)
  const [linksFlipUp, setLinksFlipUp] = useState(false)
  const linksRef = useRef<HTMLDivElement>(null)
  const [trainingDraft, setTrainingDraft] = useState(task.training_url ?? '')
  const [docDraft, setDocDraft] = useState(task.doc_url ?? '')
  const [extrasDraft, setExtrasDraft] = useState<[string, string][]>(
    task.extra_links ? Object.entries(task.extra_links) : []
  )

  function openLinks() {
    setTrainingDraft(task.training_url ?? '')
    setDocDraft(task.doc_url ?? '')
    setExtrasDraft(task.extra_links ? Object.entries(task.extra_links) : [])
    setLinksOpen(true)
  }

  useEffect(() => {
    if (!linksOpen) return
    function onDoc(e: MouseEvent) {
      if (linksRef.current && !linksRef.current.contains(e.target as Node)) setLinksOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [linksOpen])

  useEffect(() => {
    if (!linksOpen || !linksRef.current) return
    const rect = linksRef.current.getBoundingClientRect()
    setLinksFlipUp(window.innerHeight - rect.bottom < 300)
  }, [linksOpen])

  async function saveLinks() {
    const extras: Record<string, string> = {}
    for (const [k, v] of extrasDraft) {
      if (k.trim() && v.trim()) extras[k.trim()] = v.trim()
    }
    await supabase.from('tasks').update({
      training_url: trainingDraft.trim() || null,
      doc_url: docDraft.trim() || null,
      extra_links: Object.keys(extras).length > 0 ? extras : null,
    }).eq('id', task.id)
    setLinksOpen(false)
    onUpdated()
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors',
          isSubtask && 'ml-8'
        )}
      >
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab text-kst-muted/40 hover:text-kst-muted transition-colors shrink-0"
        >
          <GripVertical size={14} />
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              ref={titleRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle()
                if (e.key === 'Escape') { setTitleDraft(task.title); setEditingTitle(false) }
              }}
              className="w-full h-8 px-2 rounded bg-kst-dark border border-white/10 text-kst-white text-sm focus:outline-none focus:border-kst-gold/60"
            />
          ) : (
            <button
              type="button"
              onClick={() => { setTitleDraft(task.title); setEditingTitle(true) }}
              className="text-sm text-kst-white hover:text-kst-gold transition-colors text-left truncate block w-full"
            >
              {task.title}
            </button>
          )}
          {isSubtask && task.subtask_group && (
            <span className="text-[9px] text-kst-muted/60 uppercase tracking-wider">
              {task.subtask_group}
            </span>
          )}
        </div>

        {/* Due offset */}
        {editingDue ? (
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              value={dueDraft}
              onChange={(e) => setDueDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveDue()
                if (e.key === 'Escape') { setDueDraft(String(task.due_days_offset ?? '')); setEditingDue(false) }
              }}
              className="w-12 h-6 px-1 rounded bg-kst-dark border border-white/10 text-kst-white text-[10px] text-center focus:outline-none focus:border-kst-gold/60"
              autoFocus
            />
            <button type="button" onClick={saveDue} className="text-kst-gold"><Check size={10} /></button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setDueDraft(String(task.due_days_offset ?? '')); setEditingDue(true) }}
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded border shrink-0 transition-colors',
              task.due_days_offset != null
                ? 'border-white/10 text-kst-muted hover:text-kst-white'
                : 'border-dashed border-white/10 text-kst-muted/40 hover:text-kst-muted'
            )}
          >
            {task.due_days_offset != null ? `Day ${task.due_days_offset}` : '+ Day'}
          </button>
        )}

        {/* Specialty */}
        {editingSpec ? (
          <select
            value={task.default_specialty ?? ''}
            onChange={(e) => saveSpec(e.target.value)}
            onBlur={() => setEditingSpec(false)}
            autoFocus
            className="h-6 px-1 rounded bg-kst-dark border border-white/10 text-kst-white text-[10px] focus:outline-none appearance-none shrink-0"
          >
            {SPECIALTIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => setEditingSpec(true)}
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded shrink-0 transition-colors',
              task.default_specialty
                ? 'bg-kst-gold/10 text-kst-gold'
                : 'text-kst-muted/40 hover:text-kst-muted'
            )}
          >
            {task.default_specialty ? SPEC_SHORT[task.default_specialty] ?? task.default_specialty : '—'}
          </button>
        )}

        {/* Links */}
        <div ref={linksRef} className="relative shrink-0">
          {hasAnyLink ? (
            <button
              type="button"
              onClick={openLinks}
              className="flex items-center gap-0.5 hover:opacity-80 transition-opacity"
            >
              {hasTraining && <PlayCircle size={10} className="text-kst-gold/60" />}
              {hasDoc && <FileText size={10} className="text-kst-gold/60" />}
              {hasExtras && <span className="text-[8px] text-kst-gold/60">+{Object.keys(task.extra_links!).length}</span>}
            </button>
          ) : (
            <button
              type="button"
              onClick={openLinks}
              className="text-[10px] text-kst-muted/40 hover:text-kst-muted border border-dashed border-white/10 rounded px-1.5 py-0.5 transition-colors"
            >
              + Links
            </button>
          )}
          {linksOpen && (
            <div
              className={cn(
                'absolute z-50 right-0 w-[300px] kst-dropdown p-3 kst-fade-in',
                linksFlipUp ? 'bottom-full mb-2' : 'top-full mt-2'
              )}
            >
              <p className="text-[10px] uppercase tracking-wider text-kst-muted mb-2">Links</p>
              <div className="space-y-2">
                <input
                  type="url"
                  value={trainingDraft}
                  onChange={(e) => setTrainingDraft(e.target.value)}
                  placeholder="Training URL"
                  className="w-full h-8 px-2 rounded bg-kst-dark border border-white/10 text-kst-white text-xs focus:outline-none focus:border-kst-gold/60"
                />
                <input
                  type="url"
                  value={docDraft}
                  onChange={(e) => setDocDraft(e.target.value)}
                  placeholder="Doc URL"
                  className="w-full h-8 px-2 rounded bg-kst-dark border border-white/10 text-kst-white text-xs focus:outline-none focus:border-kst-gold/60"
                />
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-kst-muted/60 mb-1">Extra Links</p>
                  {extrasDraft.map(([k, v], i) => (
                    <div key={i} className="flex gap-1 mb-1">
                      <input
                        type="text"
                        value={k}
                        onChange={(e) => {
                          const next = [...extrasDraft]
                          next[i] = [e.target.value, v]
                          setExtrasDraft(next)
                        }}
                        placeholder="Label"
                        className="flex-1 h-7 px-2 rounded bg-kst-dark border border-white/10 text-kst-white text-[10px] focus:outline-none focus:border-kst-gold/60"
                      />
                      <input
                        type="url"
                        value={v}
                        onChange={(e) => {
                          const next = [...extrasDraft]
                          next[i] = [k, e.target.value]
                          setExtrasDraft(next)
                        }}
                        placeholder="URL"
                        className="flex-1 h-7 px-2 rounded bg-kst-dark border border-white/10 text-kst-white text-[10px] focus:outline-none focus:border-kst-gold/60"
                      />
                      <button
                        type="button"
                        onClick={() => setExtrasDraft(extrasDraft.filter((_, j) => j !== i))}
                        className="text-kst-muted hover:text-kst-error shrink-0"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExtrasDraft([...extrasDraft, ['', '']])}
                    className="text-[10px] text-kst-muted hover:text-kst-gold transition-colors"
                  >
                    + Add Link
                  </button>
                </div>
              </div>
              <div className="flex justify-between mt-3">
                <button
                  type="button"
                  onClick={() => setLinksOpen(false)}
                  className="text-xs text-kst-muted hover:text-kst-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveLinks}
                  className="px-3 h-7 rounded-full bg-kst-gold text-kst-black font-semibold text-[10px] hover:bg-kst-gold-light transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Menu */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 text-kst-muted/40 hover:text-kst-muted transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 kst-dropdown p-1 min-w-[160px] kst-fade-in">
              {!isSubtask && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onAddSubtask?.(task.id) }}
                  className="w-full text-left px-3 py-2 text-sm text-kst-white hover:bg-white/[0.06] rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus size={12} /> Add Subtask
                </button>
              )}
              {confirmDelete ? (
                <div className="px-3 py-2">
                  <p className="text-xs text-kst-muted mb-2">Remove this task?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs text-kst-muted hover:text-kst-white">
                      Cancel
                    </button>
                    <button type="button" onClick={handleDelete} className="text-xs text-kst-error hover:text-red-300">
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full text-left px-3 py-2 text-sm text-kst-error hover:bg-white/[0.06] rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 size={12} /> Remove Task
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Subtasks */}
      {!isSubtask && task.has_subtasks && subtasks.length > 0 && (
        <div className="border-l border-white/[0.06] ml-5 pl-2">
          {subtasks.map((s) => (
            <TaskEditorRow
              key={s.id}
              task={s}
              subtasks={[]}
              program={program}
              isSubtask
              onUpdated={onUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}
