'use client'

import { useMemo } from 'react'
import { ChevronDown, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Program } from '@/lib/types'
import { StatusGlyph, StatusPicker } from './StatusPicker'
import { DueDateBadge } from './DueDateBadge'
import { TaskLinks } from './TaskLinks'
import { AssigneePicker, TeamAssigneeTag } from './AssigneePicker'
import {
  type TaskStatus,
  type ClientTaskJoined,
  type ChecklistTeamMember,
  effectiveParentStatus,
  groupForSubtask,
  GROUP_ORDER,
  displaySubtaskTitle,
} from './types'

interface TopLevelTaskProps {
  ct: ClientTaskJoined
  subs: ClientTaskJoined[]
  isTeamView: boolean
  program: Program
  teamMembers: ChecklistTeamMember[]
  teamById: Map<string, ChecklistTeamMember>
  clientContactName: string | null
  onSetStatus: (id: string, next: TaskStatus) => void
  onReassign: (id: string, next: string | null) => void
  onUpdateDueDate: (id: string, next: string | null) => void
  isParentExpanded: boolean
  toggleParent: () => void
  commentCounts: Map<string, number>
  onOpenComments: (id: string, title: string) => void
}

export function TopLevelTask({
  ct,
  subs,
  isTeamView,
  program,
  teamMembers,
  teamById,
  clientContactName,
  onSetStatus,
  onReassign,
  onUpdateDueDate,
  isParentExpanded,
  toggleParent,
  commentCounts,
  onOpenComments,
}: TopLevelTaskProps) {
  const hasSubs = !!ct.task?.has_subtasks
  const effective = hasSubs ? effectiveParentStatus(ct, subs) : ct.status
  const subsDone = subs.filter((s) => s.status === 'completed').length

  const grouped = useMemo(() => {
    const m = new Map<string, ClientTaskJoined[]>()
    for (const s of subs) {
      const g = groupForSubtask(s.task?.title ?? '')
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(s)
    }
    return Array.from(m.entries()).sort(
      (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0])
    )
  }, [subs])

  const isTeamOwnedForClient =
    !isTeamView &&
    program === 'accelerator' &&
    !hasSubs &&
    ct.assigned_to !== null

  const hideLinks = ct.assigned_to !== null

  return (
    <div>
      <div
        className={cn(
          'group grid items-start gap-x-3 gap-y-2 md:gap-y-0 px-2 md:px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors',
          'grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_70px_160px_160px]',
          hasSubs && 'cursor-pointer'
        )}
        onClick={hasSubs ? toggleParent : undefined}
        role={hasSubs ? 'button' : undefined}
        tabIndex={hasSubs ? 0 : undefined}
        onKeyDown={
          hasSubs
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleParent()
                }
              }
            : undefined
        }
      >
        {/* Col 1 — status circle */}
        <div
          onClick={(e) => !hasSubs && e.stopPropagation()}
        >
          {hasSubs ? (
            <StatusGlyph status={effective} />
          ) : isTeamOwnedForClient ? (
            <StatusGlyph status={ct.status} />
          ) : (
            <StatusPicker
              status={ct.status}
              isTeamView={isTeamView}
              onChange={(next) => onSetStatus(ct.id, next)}
            />
          )}
        </div>

        {/* Col 2 — title + description */}
        <div className="min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span
              className={cn(
                'text-sm break-words',
                effective === 'completed'
                  ? 'text-kst-muted line-through'
                  : 'text-kst-white',
                hasSubs && 'group-hover:text-kst-gold transition-colors'
              )}
            >
              {ct.task?.title ?? 'Untitled task'}
            </span>
            {hasSubs && (
              <span className="text-kst-muted text-xs shrink-0 mt-0.5">
                ({subsDone}/{subs.length})
              </span>
            )}
            {hasSubs && (
              <ChevronDown
                size={14}
                className={cn(
                  'text-kst-muted transition-transform ml-auto shrink-0 mt-1',
                  isParentExpanded && 'rotate-180'
                )}
              />
            )}
          </div>
          {ct.task?.description && (
            <p className="text-kst-muted text-xs mt-0.5 break-words">
              {ct.task.description}
            </p>
          )}
        </div>

        {/* Row 2 on mobile, cols 3/4/5 on md+ */}
        <div className="col-span-2 flex items-center gap-3 flex-wrap md:contents">
          {/* Col 3 — due date */}
          <div
            className="md:flex md:justify-end min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {!hasSubs && (
              <DueDateBadge
                dueDate={ct.due_date}
                completed={ct.status === 'completed'}
                readOnly={!isTeamView}
                onChange={(next) => onUpdateDueDate(ct.id, next)}
              />
            )}
          </div>

          {/* Col 4 — links + comments */}
          <div
            className="min-w-0 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {!hasSubs && !hideLinks && (
              <TaskLinks task={ct.task} program={program} />
            )}
            {!hasSubs && (
              <button
                type="button"
                onClick={() => onOpenComments(ct.id, ct.task?.title ?? 'Untitled')}
                className="relative p-1.5 rounded-md text-kst-muted hover:text-kst-white hover:bg-white/[0.06] transition-colors"
                title="Comments"
              >
                <MessageSquare size={14} />
                {(commentCounts.get(ct.id) ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-kst-gold text-kst-black text-[9px] font-bold min-w-[16px] h-[16px] flex items-center justify-center rounded-full px-0.5">
                    {commentCounts.get(ct.id)}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Col 5 — assignee */}
          <div
            className="md:flex md:justify-end min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {!hasSubs &&
              (isTeamView ? (
                <AssigneePicker
                  assigneeId={ct.assigned_to}
                  teamMembers={teamMembers}
                  teamById={teamById}
                  clientContactName={clientContactName}
                  onChange={(next) => onReassign(ct.id, next)}
                />
              ) : isTeamOwnedForClient ? (
                <TeamAssigneeTag
                  assignee={
                    ct.assigned_to ? teamById.get(ct.assigned_to) ?? null : null
                  }
                />
              ) : null)}
          </div>
        </div>
      </div>

      {/* Subtasks */}
      {hasSubs && isParentExpanded && (
        <div className="ml-9 mr-2 mb-2 border-l border-white/[0.06] pl-4 kst-fade-in">
          {grouped.map(([groupName, items]) => {
            const groupDone = items.filter(
              (i) => i.status === 'completed'
            ).length
            return (
              <div key={groupName} className="mt-3 first:mt-1">
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-kst-muted/80 font-semibold">
                    {groupName}
                  </span>
                  <span className="text-[10px] text-kst-muted/60">
                    {groupDone}/{items.length}
                  </span>
                </div>
                {items.map((s) => (
                  <SubtaskRow
                    key={s.id}
                    ct={s}
                    isTeamView={isTeamView}
                    program={program}
                    teamMembers={teamMembers}
                    teamById={teamById}
                    clientContactName={clientContactName}
                    onSetStatus={onSetStatus}
                    onReassign={onReassign}
                    onUpdateDueDate={onUpdateDueDate}
                    commentCount={commentCounts.get(s.id) ?? 0}
                    onOpenComments={() => onOpenComments(s.id, s.task?.title ?? 'Subtask')}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SubtaskRow({
  ct,
  isTeamView,
  program,
  teamMembers,
  teamById,
  clientContactName,
  onSetStatus,
  onReassign,
  onUpdateDueDate,
  commentCount,
  onOpenComments,
}: {
  ct: ClientTaskJoined
  isTeamView: boolean
  program: Program
  teamMembers: ChecklistTeamMember[]
  teamById: Map<string, ChecklistTeamMember>
  clientContactName: string | null
  onSetStatus: (id: string, next: TaskStatus) => void
  onReassign: (id: string, next: string | null) => void
  onUpdateDueDate: (id: string, next: string | null) => void
  commentCount: number
  onOpenComments: () => void
}) {
  const isTeamOwnedForClient =
    !isTeamView && program === 'accelerator' && ct.assigned_to !== null
  const hideLinks = ct.assigned_to !== null

  return (
    <div
      className={cn(
        'group grid items-start gap-x-3 gap-y-1.5 md:gap-y-0 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors',
        'grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_70px_160px_160px]'
      )}
    >
      {/* Col 1 — status */}
      <div className="mt-0.5">
        {isTeamOwnedForClient ? (
          <StatusGlyph status={ct.status} />
        ) : (
          <StatusPicker
            status={ct.status}
            isTeamView={isTeamView}
            onChange={(next) => onSetStatus(ct.id, next)}
          />
        )}
      </div>

      {/* Col 2 — title */}
      <div className="min-w-0">
        <p
          className={cn(
            'text-sm break-words',
            ct.status === 'completed'
              ? 'text-kst-muted line-through'
              : 'text-kst-white'
          )}
        >
          {displaySubtaskTitle(ct.task?.title ?? '')}
        </p>
      </div>

      {/* Row 2 on mobile, cols 3/4/5 on md+ */}
      <div className="col-span-2 flex items-center gap-3 flex-wrap md:contents">
        {/* Col 3 — due */}
        <div className="md:flex md:justify-end min-w-0">
          <DueDateBadge
            dueDate={ct.due_date}
            completed={ct.status === 'completed'}
            readOnly={!isTeamView}
            onChange={(next) => onUpdateDueDate(ct.id, next)}
            compact
          />
        </div>

        {/* Col 4 — links + comments */}
        <div className="min-w-0 flex items-center gap-1">
          {!hideLinks && <TaskLinks task={ct.task} program={program} small />}
          <button
            type="button"
            onClick={onOpenComments}
            className="relative p-1 rounded-md text-kst-muted hover:text-kst-white hover:bg-white/[0.06] transition-colors"
            title="Comments"
          >
            <MessageSquare size={12} />
            {commentCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-kst-gold text-kst-black text-[8px] font-bold min-w-[14px] h-[14px] flex items-center justify-center rounded-full px-0.5">
                {commentCount}
              </span>
            )}
          </button>
        </div>

        {/* Col 5 — assignee */}
        <div className="md:flex md:justify-end min-w-0">
          {isTeamView ? (
            <AssigneePicker
              assigneeId={ct.assigned_to}
              teamMembers={teamMembers}
              teamById={teamById}
              clientContactName={clientContactName}
              onChange={(next) => onReassign(ct.id, next)}
              compact
            />
          ) : isTeamOwnedForClient ? (
            <TeamAssigneeTag
              assignee={
                ct.assigned_to ? teamById.get(ct.assigned_to) ?? null : null
              }
              compact
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
