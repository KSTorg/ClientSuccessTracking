'use client'

import { ExternalLink, FileText, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hasUrl, titleCase, type TaskRow } from './types'
import type { Program } from '@/lib/types'

function matchesProgramTag(key: string, program: Program): boolean {
  const hasEi = /\(\s*EI\s*\)/i.test(key)
  const hasAcc = /\(\s*ACC\s*\)/i.test(key)
  if (hasEi && program !== 'educator_incubator') return false
  if (hasAcc && program !== 'accelerator') return false
  return true
}

function stripProgramTag(key: string): string {
  return key
    .replace(/\s*\(\s*(?:EI|ACC)\s*\)\s*/gi, '')
    .replace(/_+$/g, '')
    .replace(/\s+$/g, '')
    .trim()
}

function LinkButton({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-kst-gold/30 text-kst-gold hover:bg-kst-gold/10 transition-colors font-medium',
        className
      )}
    >
      {children}
    </a>
  )
}

export function TaskLinks({
  task,
  small = false,
  program,
}: {
  task: TaskRow | null
  small?: boolean
  program: Program
}) {
  if (!task) return null

  const validExtras = task.extra_links
    ? Object.entries(task.extra_links)
        .filter(([key, url]) => hasUrl(url) && matchesProgramTag(key, program))
        .map(
          ([key, url]) => [stripProgramTag(key) || key, url] as [string, string]
        )
    : []

  const hasTraining = hasUrl(task.training_url)
  const hideDocForAccelerator =
    program === 'accelerator' && task.accelerator_hide_docs === true
  const hasDoc = hasUrl(task.doc_url) && !hideDocForAccelerator

  if (!hasTraining && !hasDoc && validExtras.length === 0) return null

  const sizeCls = small ? 'text-[10px] px-2 py-1' : 'text-xs px-2.5 py-1'

  const trainingLabel =
    task.training_url && /loom\.com/i.test(task.training_url)
      ? 'Watch Loom'
      : 'Training'

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-start">
      {hasTraining && (
        <LinkButton href={task.training_url!} className={sizeCls}>
          <PlayCircle size={small ? 11 : 12} />
          {trainingLabel}
        </LinkButton>
      )}
      {hasDoc && (
        <LinkButton href={task.doc_url!} className={sizeCls}>
          <FileText size={small ? 11 : 12} />
          Doc
        </LinkButton>
      )}
      {validExtras.map(([key, url]) => (
        <LinkButton key={key} href={url} className={sizeCls}>
          <ExternalLink size={small ? 11 : 12} />
          {titleCase(key)}
        </LinkButton>
      ))}
    </div>
  )
}
