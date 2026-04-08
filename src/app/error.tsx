'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app error boundary]', error)
  }, [error])

  return (
    <main className="min-h-screen bg-kst-black flex items-center justify-center px-6">
      <div className="glass-panel max-w-lg w-full p-8 text-center">
        <div className="w-12 h-12 mx-auto rounded-full border border-kst-error/40 flex items-center justify-center mb-5">
          <AlertTriangle size={20} className="text-kst-error" />
        </div>
        <h1 className="text-2xl text-kst-white font-semibold mb-2">
          Something went wrong
        </h1>
        {error.message && (
          <p className="text-kst-muted text-sm mb-6 break-words">
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold text-sm hover:bg-kst-gold-light transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="px-5 h-11 rounded-xl glass-panel-sm text-kst-muted hover:text-kst-white transition-colors text-sm inline-flex items-center"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
