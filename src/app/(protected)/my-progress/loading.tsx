import { SkeletonStageSection } from '@/components/ui/skeletons'

export default function MyProgressLoading() {
  return (
    <div className="max-w-4xl">
      {/* Title */}
      <div className="h-12 w-56 rounded kst-shimmer mb-3" />
      <div className="h-4 w-40 rounded kst-shimmer mb-8" />

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="h-3 w-28 rounded kst-shimmer" />
          <div className="h-3 w-36 rounded kst-shimmer" />
        </div>
        <div className="h-2 w-full rounded-full kst-shimmer" />
      </div>

      {/* Stage sections */}
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3].map((i) => <SkeletonStageSection key={i} />)}
      </div>
    </div>
  )
}
