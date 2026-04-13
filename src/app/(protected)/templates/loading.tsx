import { SkeletonStageSection } from '@/components/ui/skeletons'

export default function TemplatesLoading() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Title */}
      <div className="mb-8">
        <div className="h-8 w-40 rounded kst-shimmer mb-3" />
        <div className="h-4 w-72 rounded kst-shimmer" />
      </div>

      {/* Program tabs */}
      <div className="flex gap-2 mb-6">
        <div className="h-10 w-40 rounded-xl kst-shimmer" />
        <div className="h-10 w-32 rounded-xl kst-shimmer" />
      </div>

      {/* Stage sections */}
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass-panel-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 rounded-full kst-shimmer" />
              <div className="h-4 w-32 rounded kst-shimmer" />
            </div>
            <div className="space-y-2">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="h-8 rounded kst-shimmer" style={{ width: `${90 - j * 5}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
