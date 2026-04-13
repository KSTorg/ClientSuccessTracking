'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Bug, ChevronDown, Lightbulb } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'

type ReportType = 'bug' | 'problem' | 'suggestion'
type ReportStatus = 'to_do' | 'fixed' | 'rejected'

export interface BugReport {
  id: string
  submitted_by: string | null
  submitted_name: string | null
  organization: string | null
  type: ReportType
  description: string
  screenshot_url: string | null
  status: ReportStatus
  resolved_at: string | null
  created_at: string
}

type TypeFilter = ReportType | 'all'

const TYPE_ICON: Record<ReportType, { icon: typeof Bug; cls: string }> = {
  bug: { icon: Bug, cls: 'text-red-400' },
  problem: { icon: AlertTriangle, cls: 'text-amber-400' },
  suggestion: { icon: Lightbulb, cls: 'text-kst-gold' },
}

const STATUS_BADGE: Record<ReportStatus, { label: string; cls: string }> = {
  to_do: { label: 'To Do', cls: 'border-white/15 text-white/50 bg-white/[0.04]' },
  fixed: { label: 'Fixed', cls: 'border-kst-success/60 text-kst-success bg-kst-success/10' },
  rejected: { label: 'Rejected', cls: 'border-kst-error/60 text-kst-error bg-kst-error/10' },
}

export function ReportsView({ reports: initial }: { reports: BugReport[] }) {
  const supabase = createClient()
  const [reports, setReports] = useState(initial)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c = { all: reports.length, bug: 0, problem: 0, suggestion: 0 }
    for (const r of reports) c[r.type]++
    return c
  }, [reports])

  const filtered = useMemo(
    () => reports.filter((r) => typeFilter === 'all' || r.type === typeFilter),
    [reports, typeFilter]
  )

  const active = filtered.filter((r) => r.status === 'to_do')
  const fixed = filtered.filter((r) => r.status === 'fixed')
  const rejected = filtered.filter((r) => r.status === 'rejected')

  async function setStatus(id: string, status: ReportStatus) {
    const resolvedAt = status === 'to_do' ? null : new Date().toISOString()
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status, resolved_at: resolvedAt } : r))
    )
    await supabase
      .from('bug_reports')
      .update({ status, resolved_at: resolvedAt })
      .eq('id', id)
  }

  function renderSection(title: string, items: BugReport[]) {
    if (items.length === 0) return null
    return (
      <section className="mb-8">
        <h3 className="text-kst-white font-semibold text-sm mb-3">{title} ({items.length})</h3>
        <div className="space-y-2">
          {items.map((r) => {
            const isExpanded = expanded === r.id
            const TypeIcon = TYPE_ICON[r.type].icon
            const typeCls = TYPE_ICON[r.type].cls
            const badge = STATUS_BADGE[r.status]

            return (
              <div key={r.id} className="glass-panel-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : r.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <TypeIcon size={16} className={cn('mt-0.5 shrink-0', typeCls)} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', isExpanded ? 'text-kst-white' : 'text-kst-white truncate')}>
                      {r.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-kst-muted">
                        {r.submitted_name ?? 'Anonymous'} · {formatDate(r.created_at)}
                      </span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', badge.cls)}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    size={14}
                    className={cn('text-kst-muted shrink-0 mt-1 transition-transform', isExpanded && 'rotate-180')}
                  />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04] pt-3">
                    <p className="text-kst-white text-sm whitespace-pre-wrap">{r.description}</p>

                    {r.screenshot_url && (
                      <div>
                        <a
                          href={r.screenshot_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-kst-gold text-xs hover:underline"
                        >
                          Open full size
                        </a>
                        <img
                          src={r.screenshot_url}
                          alt="Screenshot"
                          className="mt-2 rounded-lg max-h-[300px] border border-white/10"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-kst-muted">
                      <span>By: {r.submitted_name ?? 'Anonymous'}</span>
                      {r.organization && <span>· {r.organization}</span>}
                      <span>· {formatDate(r.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-kst-muted text-xs mr-1">Set status:</span>
                      {(['to_do', 'fixed', 'rejected'] as ReportStatus[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(r.id, s)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors',
                            r.status === s
                              ? STATUS_BADGE[s].cls
                              : 'border-white/10 text-kst-muted hover:text-kst-white hover:border-white/20'
                          )}
                        >
                          {STATUS_BADGE[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1
          className="text-2xl md:text-3xl text-kst-gold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Reports & Suggestions
        </h1>
        <p className="text-kst-muted text-sm mt-1">
          Bug reports, problems, and feature suggestions
        </p>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([
          { value: 'all' as TypeFilter, label: `All (${counts.all})` },
          { value: 'bug' as TypeFilter, label: `Bugs (${counts.bug})` },
          { value: 'problem' as TypeFilter, label: `Problems (${counts.problem})` },
          { value: 'suggestion' as TypeFilter, label: `Suggestions (${counts.suggestion})` },
        ]).map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setTypeFilter(f.value)}
            className={cn(
              'px-3 h-9 rounded-full text-xs font-medium border transition-colors',
              typeFilter === f.value
                ? 'border-kst-gold/60 text-kst-gold bg-kst-gold/10'
                : 'border-white/10 text-kst-muted hover:text-kst-white hover:border-white/20'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {reports.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <p className="text-kst-muted text-sm">No reports yet.</p>
        </div>
      ) : (
        <>
          {renderSection('Active', active)}
          {renderSection('Resolved', fixed)}
          {renderSection('Rejected', rejected)}
          {filtered.length === 0 && (
            <div className="glass-panel p-8 text-center">
              <p className="text-kst-muted text-sm">No reports match this filter.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
