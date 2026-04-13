import { SkeletonStageSection, SkeletonListRow } from '@/components/ui/skeletons'

export default function ClientDetailLoading() {
  return (
    <div className="max-w-5xl">
      {/* Back link */}
      <div className="h-4 w-28 rounded kst-shimmer mb-4" />

      {/* Company name */}
      <div className="h-14 w-72 rounded kst-shimmer mb-3" />
      <div className="h-4 w-48 rounded kst-shimmer mb-6" />

      {/* Info bar */}
      <div className="glass-panel-sm p-5 mb-6">
        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-white/[0.05]">
          <div className="h-3 w-16 rounded kst-shimmer" />
          <div className="h-6 w-28 rounded-full kst-shimmer" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-3 w-20 rounded kst-shimmer mb-2" />
              <div className="h-8 w-24 rounded kst-shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* Contacts */}
      <div className="glass-panel-sm p-5 mb-6">
        <div className="h-5 w-24 rounded kst-shimmer mb-4" />
        <SkeletonListRow />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <div className="h-10 w-32 rounded-xl kst-shimmer" />
        <div className="h-10 w-36 rounded-xl kst-shimmer" />
      </div>

      {/* Stage sections */}
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3].map((i) => <SkeletonStageSection key={i} />)}
      </div>
    </div>
  )
}
