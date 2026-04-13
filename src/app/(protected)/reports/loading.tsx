export default function ReportsLoading() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Title */}
      <div className="mb-8">
        <div className="h-8 w-56 rounded kst-shimmer mb-3" />
        <div className="h-4 w-64 rounded kst-shimmer" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 rounded-full kst-shimmer" style={{ width: `${60 + i * 16}px` }} />
        ))}
      </div>

      {/* Active heading */}
      <div className="h-4 w-20 rounded kst-shimmer mb-3" />

      {/* Report cards */}
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-panel-sm p-4">
            <div className="flex items-start gap-3">
              <div className="w-4 h-4 rounded kst-shimmer shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="h-4 rounded kst-shimmer mb-2" style={{ width: `${80 - i * 10}%` }} />
                <div className="h-3 w-40 rounded kst-shimmer" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
