'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { ChevronDown, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { TaskEditorRow } from './task-editor-row'
import { AddTaskModal } from './add-task-modal'

interface Stage {
  id: string
  name: string
  order_index: number
}

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
  accelerator_excluded: boolean
  accelerator_only: boolean
  accelerator_hide_docs: boolean | null
  client_facing_accelerator: boolean | null
}

interface StageEditorProps {
  stage: Stage
  tasks: TemplateTask[]
  allTasks: TemplateTask[]
  stageIndex: number
  program: 'educator_incubator' | 'accelerator'
  onTaskUpdated: () => void
}

export function StageEditor({
  stage,
  tasks,
  allTasks,
  stageIndex,
  program,
  onTaskUpdated,
}: StageEditorProps) {
  const supabase = createClient()
  const [open, setOpen] = useState(true)
  const [addModal, setAddModal] = useState<{ parentId?: string } | null>(null)

  const topLevel = tasks
    .filter((t) => !t.parent_task_id)
    .sort((a, b) => a.order_index - b.order_index)

  function getSubtasks(parentTaskId: string): TemplateTask[] {
    return allTasks
      .filter((t) => t.parent_task_id === parentTaskId && t.is_active)
      .sort((a, b) => a.order_index - b.order_index)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = topLevel.findIndex((t) => t.id === active.id)
    const newIndex = topLevel.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(topLevel, oldIndex, newIndex)

    // Batch update order_index
    await Promise.all(
      reordered.map((t, i) =>
        supabase.from('tasks').update({ order_index: i }).eq('id', t.id)
      )
    )
    onTaskUpdated()
  }

  const nextOrder = topLevel.length > 0
    ? Math.max(...topLevel.map((t) => t.order_index)) + 1
    : 0

  return (
    <div className="glass-panel-sm overflow-visible">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full border border-kst-gold/60 text-kst-gold flex items-center justify-center text-xs font-semibold bg-kst-gold/5">
            {stageIndex + 1}
          </span>
          <span className="text-kst-white font-semibold">
            {stage.name}
          </span>
          <span className="text-kst-muted text-xs">
            ({topLevel.length} task{topLevel.length !== 1 ? 's' : ''})
          </span>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            'text-kst-muted transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="border-t border-white/[0.05] px-2 py-2">
          {/* Column headers — matches TaskEditorRow flex layout exactly */}
          <div className="hidden md:flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-wider text-kst-muted/50 border-b border-white/[0.04] mb-1">
            <div style={{ width: 14 }} className="shrink-0" />
            <div className="flex-1 min-w-0">Task</div>
            <div style={{ width: 52 }} className="shrink-0 text-right">Due</div>
            <div style={{ width: 40 }} className="shrink-0 text-right">Assignee</div>
            <div style={{ width: 60 }} className="shrink-0 text-right">Links</div>
            <div style={{ width: 22 }} className="shrink-0" />
          </div>
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={topLevel.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {topLevel.map((t) => (
                <TaskEditorRow
                  key={t.id}
                  task={t}
                  subtasks={getSubtasks(t.id)}
                  program={program}
                  onUpdated={onTaskUpdated}
                  onAddSubtask={(parentId) => setAddModal({ parentId })}
                />
              ))}
            </SortableContext>
          </DndContext>

          <button
            type="button"
            onClick={() => setAddModal({})}
            className="flex items-center gap-1.5 px-3 py-2 mt-1 text-kst-muted text-xs hover:text-kst-gold transition-colors"
          >
            <Plus size={12} />
            Add Task
          </button>
        </div>
      )}

      {addModal && (
        <AddTaskModal
          open
          onClose={() => setAddModal(null)}
          stageId={stage.id}
          parentTaskId={addModal.parentId}
          program={program}
          nextOrderIndex={addModal.parentId
            ? Math.max(0, ...getSubtasks(addModal.parentId).map((t) => t.order_index)) + 1
            : nextOrder
          }
          onAdded={() => { setAddModal(null); onTaskUpdated() }}
        />
      )}
    </div>
  )
}
