import { SkeletonCard } from '@/components/ui/skeletons'

export default function MyTasksLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Title */}
      <div className="h-8 w-40 rounded kst-shimmer" />

      {/* Overdue */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2.5 h-2.5 rounded-full kst-shimmer" />
          <div className="h-4 w-20 rounded kst-shimmer" />
        </div>
        <div className="glass-panel p-3 space-y-2">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>

      {/* To Do */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2.5 h-2.5 rounded-full kst-shimmer" />
          <div className="h-4 w-16 rounded kst-shimmer" />
        </div>
        <div className="glass-panel p-3 space-y-2">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </div>
  )
}
