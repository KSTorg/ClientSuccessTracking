'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface AddTaskModalProps {
  open: boolean
  onClose: () => void
  stageId: string
  parentTaskId?: string | null
  program: 'educator_incubator' | 'accelerator'
  nextOrderIndex: number
  onAdded: () => void
}

const SPECIALTIES = [
  { value: '', label: 'None' },
  { value: 'ads', label: 'Ads' },
  { value: 'systems', label: 'Systems' },
  { value: 'organic', label: 'Organic' },
  { value: 'sales', label: 'Sales' },
]

const inputCls =
  'w-full h-11 px-4 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted text-sm focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors'

export function AddTaskModal({
  open,
  onClose,
  stageId,
  parentTaskId,
  program,
  nextOrderIndex,
  onAdded,
}: AddTaskModalProps) {
  const supabase = createClient()
  const toast = useToast()
  const isSubtask = !!parentTaskId

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [trainingUrl, setTrainingUrl] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [dueOffset, setDueOffset] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [subtaskGroup, setSubtaskGroup] = useState('')
  const [bothPrograms, setBothPrograms] = useState(program === 'educator_incubator')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function handleSubmit() {
    if (!title.trim()) return
    setSaving(true)

    // If adding a subtask and parent isn't marked as having subtasks, update it
    if (parentTaskId) {
      await supabase
        .from('tasks')
        .update({ has_subtasks: true })
        .eq('id', parentTaskId)
    }

    const isAccOnly = program === 'accelerator' && !bothPrograms

    const { error } = await supabase.from('tasks').insert({
      stage_id: stageId,
      title: title.trim(),
      description: description.trim() || null,
      training_url: trainingUrl.trim() || null,
      doc_url: docUrl.trim() || null,
      order_index: nextOrderIndex,
      has_subtasks: false,
      parent_task_id: parentTaskId || null,
      default_specialty: specialty || null,
      due_days_offset: dueOffset ? Number(dueOffset) : null,
      subtask_group: isSubtask ? (subtaskGroup.trim() || null) : null,
      accelerator_excluded: false,
      accelerator_only: isAccOnly,
      is_active: true,
    })

    setSaving(false)
    if (error) {
      toast.error(`Could not add task: ${error.message}`)
      return
    }
    toast.success(`${isSubtask ? 'Subtask' : 'Task'} added`)
    onAdded()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/70 backdrop-blur-[20px] backdrop-saturate-[1.2]"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start md:items-center justify-center p-4 py-8 md:py-16">
        <div
          className="glass-panel relative w-full max-w-[480px] p-7"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-kst-muted hover:text-kst-white transition-colors"
          >
            <X size={18} />
          </button>

          <h2 className="text-kst-white text-xl font-semibold mb-5">
            {isSubtask ? 'Add Subtask' : 'Add Task'}
          </h2>

          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wider text-kst-muted">Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title..."
                autoFocus
                className={inputCls}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wider text-kst-muted">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                className={cn(inputCls, 'h-auto py-3 resize-none')}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-kst-muted">Training URL</span>
                <input
                  type="url"
                  value={trainingUrl}
                  onChange={(e) => setTrainingUrl(e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-kst-muted">Doc URL</span>
                <input
                  type="url"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-kst-muted">Due Day Offset</span>
                <input
                  type="number"
                  value={dueOffset}
                  onChange={(e) => setDueOffset(e.target.value)}
                  placeholder="e.g. 3"
                  className={inputCls}
                />
                <span className="text-[10px] text-kst-muted">Days after client joins</span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-kst-muted">Specialty</span>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className={cn(inputCls, 'appearance-none')}
                >
                  {SPECIALTIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {isSubtask && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wider text-kst-muted">Subtask Group</span>
                <input
                  type="text"
                  value={subtaskGroup}
                  onChange={(e) => setSubtaskGroup(e.target.value)}
                  placeholder="e.g. Getting Started"
                  className={inputCls}
                />
              </label>
            )}

            <label className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={bothPrograms}
                onChange={(e) => setBothPrograms(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-kst-dark accent-kst-gold"
              />
              <span className="text-sm text-kst-white">Show in both programs</span>
            </label>

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 h-11 rounded-xl glass-panel-sm text-kst-muted hover:text-kst-white transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !title.trim()}
                onClick={handleSubmit}
                className="px-5 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold hover:bg-kst-gold-light transition-colors text-sm disabled:opacity-60"
              >
                {saving ? 'Adding...' : isSubtask ? 'Add Subtask' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
