import type { Specialty, Program } from '@/lib/types'

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'in_review'
  | 'completed'

export interface StageRow {
  id: string
  name: string
  order_index: number
}

export interface TaskRow {
  id: string
  parent_task_id: string | null
  has_subtasks: boolean
  title: string
  description: string | null
  training_url: string | null
  doc_url: string | null
  extra_links: Record<string, string> | null
  order_index: number
  default_specialty: Specialty | null
  client_facing_accelerator: boolean | null
  accelerator_hide_docs: boolean | null
  stage: StageRow | null
}

export interface ClientTaskJoined {
  id: string
  client_id: string
  task_id: string
  status: TaskStatus
  completed_at: string | null
  assigned_to: string | null
  due_date: string | null
  task: TaskRow | null
}

export interface OrganizedStage {
  stage: StageRow
  topLevel: ClientTaskJoined[]
}

export interface Stage12Progress {
  total: number
  completed: number
}

export interface ChecklistTeamMember {
  id: string
  full_name: string | null
  specialty: Specialty | null
}

export interface SetupChecklistProps {
  clientId: string
  isTeamView: boolean
  clientName?: string
  isLaunched?: boolean
  program?: Program
  teamMembers?: ChecklistTeamMember[]
  clientContactName?: string | null
  joinedDate?: string | null
  onLaunchedChange?: (launchedDate: string | null) => void
  onStage12ProgressChange?: (progress: Stage12Progress) => void
}

export interface PendingLaunch {
  clientTaskId: string
  prevStatus: TaskStatus
  prevCompletedAt: string | null
}

export const TIMELINE_TOTAL_DAYS = 16
export const LAUNCH_TASK_TITLE = 'Launch Ads'

export const TEAM_STATUSES: TaskStatus[] = [
  'not_started',
  'in_progress',
  'in_review',
  'completed',
]

export const CLIENT_STATUSES: TaskStatus[] = [
  'not_started',
  'in_progress',
  'completed',
]

export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  in_review: 'In Review',
  completed: 'Completed',
}

export function hasUrl(url: string | null | undefined): boolean {
  return !!url && url.trim().length > 0
}

export function titleCase(s: string) {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export function displaySubtaskTitle(title: string) {
  const idx = title.indexOf(':')
  if (idx > 0 && idx < 40) return title.slice(idx + 1).trim()
  return title
}

export function groupForSubtask(title: string): string {
  const idx = title.indexOf(':')
  if (idx > 0 && idx < 40) return title.slice(0, idx).trim()

  const t = title.toLowerCase()
  if (
    t.includes('business profile') ||
    t.includes('timezone') ||
    t.includes('google calendar') ||
    t.includes('google meet') ||
    t.includes('zoom') ||
    t.includes('add domain') ||
    t.includes('connect google') ||
    t.includes('connect fb')
  )
    return 'Getting Started'
  if (
    t.includes('meeting title') ||
    t.includes('meeting location') ||
    t.includes('add closer') ||
    t.includes('activate calendar')
  )
    return 'Calendar'
  if (t.includes('connect domain') || t.includes('step url'))
    return 'Funnel / Sites'
  if (
    t.includes('callout') ||
    t.includes('offer statement') ||
    t.includes('vsl') ||
    t.includes('testimonial') ||
    t.includes('color') ||
    t.includes('phone version')
  )
    return 'Landing Page'
  if (t.includes('booking') || t.includes('paste testimonial'))
    return 'Booking Page'
  if (t.includes('pre-call')) return 'Pre-Call Homework'
  if (t.includes('custom value')) return 'Custom Values'
  if (t.includes('automation') || t.includes('workflow'))
    return 'Automations'
  if (t.includes('toll free') || t.includes('phone number'))
    return 'Phone Number'
  return 'Other'
}

export const GROUP_ORDER = [
  'Getting Started',
  'Calendar',
  'Funnel / Sites',
  'Landing Page',
  'Booking Page',
  'Pre-Call Homework',
  'Custom Values',
  'Automations',
  'Phone Number',
  'Other',
]

export function effectiveParentStatus(
  parent: ClientTaskJoined,
  subs: ClientTaskJoined[]
): TaskStatus {
  if (!parent.task?.has_subtasks) return parent.status
  if (subs.length === 0) return parent.status
  if (subs.every((s) => s.status === 'completed')) return 'completed'
  if (subs.every((s) => s.status === 'not_started')) return 'not_started'
  if (subs.some((s) => s.status === 'in_review')) return 'in_review'
  return 'in_progress'
}
