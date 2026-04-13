import { SkeletonCard } from '@/components/ui/skeletons'

export default function ClientsLoading() {
  return (
    <div className="w-full">
      {/* Title + button */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="h-14 w-48 rounded kst-shimmer" />
        <div className="h-11 w-32 rounded-xl kst-shimmer" />
      </div>

      {/* Search + filters */}
      <div className="glass-panel-sm p-4 mb-6">
        <div className="h-10 rounded-lg kst-shimmer" />
      </div>

      {/* Program filter pills */}
      <div className="flex gap-2 mb-6">
        <div className="h-9 w-24 rounded-full kst-shimmer" />
        <div className="h-9 w-36 rounded-full kst-shimmer" />
        <div className="h-9 w-28 rounded-full kst-shimmer" />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block glass-panel p-4">
        <div className="space-y-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-1/5 rounded kst-shimmer" />
              <div className="h-4 w-1/6 rounded kst-shimmer" />
              <div className="h-6 w-20 rounded-full kst-shimmer" />
              <div className="h-6 w-16 rounded-full kst-shimmer" />
              <div className="h-4 w-1/6 rounded kst-shimmer" />
              <div className="h-4 w-16 rounded kst-shimmer" />
              <div className="flex-1 h-1.5 rounded-full kst-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
