'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { StageEditor } from './stage-editor'

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

interface TemplatesViewProps {
  stages: Stage[]
  tasks: TemplateTask[]
}

type Program = 'educator_incubator' | 'accelerator'

export function TemplatesView({ stages, tasks }: TemplatesViewProps) {
  const router = useRouter()
  const [program, setProgram] = useState<Program>('educator_incubator')

  function handleUpdated() {
    router.refresh()
  }

  // Filter tasks by program tab
  function tasksForStage(stageId: string): TemplateTask[] {
    return tasks.filter((t) => {
      if (t.stage_id !== stageId) return false
      if (program === 'educator_incubator' && t.accelerator_only) return false
      if (program === 'accelerator' && t.accelerator_excluded) return false
      return true
    })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1
          className="text-2xl md:text-3xl text-kst-gold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Templates
        </h1>
        <p className="text-kst-muted text-sm mt-1">
          Edit the onboarding checklists for new clients. Changes only affect future clients.
        </p>
      </div>

      {/* Program tabs */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setProgram('educator_incubator')}
          className={cn(
            'inline-flex items-center gap-2 px-4 h-10 rounded-xl glass-panel-sm text-sm transition-colors border-b-2',
            program === 'educator_incubator'
              ? 'text-kst-gold border-kst-gold'
              : 'text-kst-muted border-transparent hover:text-kst-white'
          )}
        >
          Educator Incubator
        </button>
        <button
          type="button"
          onClick={() => setProgram('accelerator')}
          className={cn(
            'inline-flex items-center gap-2 px-4 h-10 rounded-xl glass-panel-sm text-sm transition-colors border-b-2',
            program === 'accelerator'
              ? 'text-kst-gold border-kst-gold'
              : 'text-kst-muted border-transparent hover:text-kst-white'
          )}
        >
          Accelerator
        </button>
      </div>

      {/* Stages */}
      <div className="flex flex-col gap-4">
        {stages.map((stage, i) => (
          <StageEditor
            key={stage.id}
            stage={stage}
            tasks={tasksForStage(stage.id)}
            allTasks={tasks}
            stageIndex={i}
            program={program}
            onTaskUpdated={handleUpdated}
          />
        ))}
      </div>
    </div>
  )
}
