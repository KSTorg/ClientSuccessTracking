export function ChecklistSkeleton() {
  return (
    <div>
      <div className="mb-8">
        <div className="h-3 w-40 rounded skeleton-shimmer mb-3" />
        <div className="h-2 w-full rounded-full skeleton-shimmer" />
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass-panel-sm p-5">
            <div className="h-4 w-1/3 rounded skeleton-shimmer" />
            <div className="mt-4 space-y-3">
              <div className="h-3 w-full rounded skeleton-shimmer" />
              <div className="h-3 w-5/6 rounded skeleton-shimmer" />
              <div className="h-3 w-4/6 rounded skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 0%,
            rgba(201,168,76,0.10) 50%,
            rgba(255,255,255,0.04) 100%
          );
          background-size: 200% 100%;
          animation: kst-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes kst-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
