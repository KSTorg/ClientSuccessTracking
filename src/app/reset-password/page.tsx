'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/update-password`,
      }
    )

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-kst-black">
      <div className="flex flex-col items-center mb-10">
        <h1
          className="text-7xl text-kst-gold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          KST
        </h1>
        <p className="mt-2 text-kst-muted text-sm tracking-wide">
          Client Success Tracker
        </p>
      </div>

      <div
        className="glass-panel w-full max-w-[420px] p-8"
        style={{ animation: 'kst-fade-up 0.5s ease-out both' }}
      >
        <h2 className="text-kst-white text-2xl font-semibold mb-1">
          Reset Password
        </h2>
        <p className="text-kst-muted text-sm mb-6">
          Enter your email and we&apos;ll send you a reset link
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || success}
            className="w-full h-12 px-4 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={loading || success}
            className="w-full h-12 mt-2 rounded-xl bg-kst-gold text-kst-black font-semibold tracking-wide hover:bg-kst-gold-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_8px_32px_rgba(201,168,76,0.18)]"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>

          {success && (
            <p className="text-kst-success text-sm text-center mt-1">
              Check your email for the reset link
            </p>
          )}
          {error && (
            <p className="text-kst-error text-sm text-center mt-1">{error}</p>
          )}
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-xs text-kst-muted hover:text-kst-gold transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes kst-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  )
}
