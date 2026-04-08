import { cn } from '@/lib/utils'

/**
 * Skeleton placeholder block with a continuous shimmer sweep.
 * Uses the `.kst-shimmer` CSS class defined in globals.css.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('kst-shimmer rounded-md', className)}
      {...props}
    />
  )
}

/**
 * A glass-panel-sm card containing skeleton content, useful as a
 * drop-in placeholder for stat cards and list items while data loads.
 */
export function SkeletonCard({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('glass-panel-sm p-5', className)}>
      <Skeleton className="h-4 w-1/3 mb-4" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-3"
            style={{ width: `${100 - i * 12}%` }}
          />
        ))}
      </div>
    </div>
  )
}
