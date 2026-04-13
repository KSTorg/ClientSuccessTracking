import { cn } from '@/lib/utils'

export function SkeletonBox({ className }: { className?: string }) {
  return <div className={cn('rounded-lg kst-shimmer', className)} />
}

export function SkeletonText({ className, width }: { className?: string; width?: string }) {
  return <div className={cn('h-3 rounded kst-shimmer', className)} style={{ width: width ?? '100%' }} />
}

export function SkeletonStatCard() {
  return (
    <div className="glass-panel-sm p-5">
      <div className="w-5 h-5 rounded kst-shimmer mb-3" />
      <div className="h-8 w-16 rounded kst-shimmer mb-2" />
      <div className="h-3 w-24 rounded kst-shimmer" />
    </div>
  )
}

export function SkeletonListRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-2">
      <div className="h-4 flex-1 rounded kst-shimmer" />
      <div className="h-6 w-20 rounded-full kst-shimmer" />
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="glass-panel-sm p-4">
      <div className="h-4 w-2/3 rounded kst-shimmer mb-3" />
      <div className="h-3 w-1/2 rounded kst-shimmer mb-4" />
      <div className="flex gap-2 mb-3">
        <div className="h-6 w-20 rounded-full kst-shimmer" />
        <div className="h-6 w-16 rounded-full kst-shimmer" />
      </div>
      <div className="h-1.5 w-full rounded-full kst-shimmer" />
    </div>
  )
}

export function SkeletonPageTitle() {
  return (
    <div className="mb-8">
      <div className="h-12 w-64 rounded kst-shimmer mb-3" />
      <div className="h-4 w-40 rounded kst-shimmer" />
    </div>
  )
}

export function SkeletonStageSection({ rows = 3 }: { rows?: number }) {
  return (
    <div className="glass-panel-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-full kst-shimmer" />
        <div className="h-4 w-32 rounded kst-shimmer" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-3 rounded kst-shimmer" style={{ width: `${85 - i * 10}%` }} />
        ))}
      </div>
    </div>
  )
}
