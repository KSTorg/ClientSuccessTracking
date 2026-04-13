import { SkeletonPageTitle, SkeletonStatCard, SkeletonListRow } from '@/components/ui/skeletons'

export default function DashboardLoading() {
  return (
    <div className="w-full">
      <SkeletonPageTitle />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
        {[0, 1, 2, 3, 4].map((i) => <SkeletonStatCard key={i} />)}
      </div>

      {/* Two-column: Recent Clients + Reports Due */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        <div className="glass-panel p-6 md:p-8">
          <div className="h-5 w-36 rounded kst-shimmer mb-5" />
          <div className="divide-y divide-white/[0.06]">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonListRow key={i} />)}
          </div>
        </div>
        <div className="glass-panel p-6 md:p-8">
          <div className="h-5 w-44 rounded kst-shimmer mb-5" />
          <div className="divide-y divide-white/[0.06]">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonListRow key={i} />)}
          </div>
        </div>
      </div>

      {/* Analytics heading */}
      <div className="h-7 w-32 rounded kst-shimmer mb-6" />

      {/* Analytics stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <SkeletonStatCard key={i} />)}
      </div>

      {/* Chart area */}
      <div className="glass-panel p-6 md:p-8">
        <div className="h-5 w-28 rounded kst-shimmer mb-4" />
        <div className="h-48 rounded-lg kst-shimmer" />
      </div>
    </div>
  )
}
