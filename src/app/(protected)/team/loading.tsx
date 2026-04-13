export default function TeamLoading() {
  return (
    <div className="w-full">
      {/* Title + button */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="h-14 w-32 rounded kst-shimmer" />
        <div className="h-11 w-40 rounded-xl kst-shimmer" />
      </div>

      {/* Team member cards */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass-panel-sm p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full kst-shimmer shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-4 w-32 rounded kst-shimmer mb-2" />
              <div className="h-3 w-48 rounded kst-shimmer" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full kst-shimmer" />
              <div className="h-6 w-14 rounded-full kst-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
