import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-kst-black flex items-center justify-center px-6">
      <div className="relative flex flex-col items-center text-center">
        <span
          aria-hidden
          className="absolute -top-16 left-1/2 -translate-x-1/2 text-[220px] md:text-[300px] leading-none text-kst-gold/10 select-none pointer-events-none"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          404
        </span>
        <div className="relative pt-24 md:pt-32">
          <h1 className="text-4xl md:text-5xl text-kst-white tracking-tight">
            Page not found
          </h1>
          <p className="mt-4 text-kst-muted max-w-md">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 mt-8 px-6 h-11 rounded-xl bg-kst-gold text-kst-black font-semibold text-sm hover:bg-kst-gold-light transition-colors shadow-[0_8px_32px_rgba(201,168,76,0.25)]"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
