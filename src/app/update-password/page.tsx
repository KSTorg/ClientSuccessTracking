'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)

  // Pick up the SIGNED_IN / PASSWORD_RECOVERY event from the recovery link.
  // Supabase parses the access_token from the URL hash automatically when
  // the client is created and emits an auth state change.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setRecoveryReady(true)
      }
    })

    // If the page was loaded after the hash was already consumed, also
    // check the current session so the form is enabled.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setRecoveryReady(true)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    setTimeout(() => {
      // Sign the recovery session out so the user logs in fresh with the new password
      supabase.auth.signOut().finally(() => {
        router.replace('/login')
        router.refresh()
      })
    }, 2000)
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
        <h2 className="text-kst-white text-2xl font-semibold mb-6">
          Set New Password
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || success}
            className="w-full h-12 px-4 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors disabled:opacity-60"
          />

          <input
            type="password"
            required
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={loading || success}
            className="w-full h-12 px-4 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={loading || success || !recoveryReady}
            className="w-full h-12 mt-2 rounded-xl bg-kst-gold text-kst-black font-semibold tracking-wide hover:bg-kst-gold-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_8px_32px_rgba(201,168,76,0.18)]"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>

          {!recoveryReady && !error && !success && (
            <p className="text-kst-muted text-xs text-center mt-1">
              Verifying reset link...
            </p>
          )}
          {success && (
            <p className="text-kst-success text-sm text-center mt-1">
              Password updated. Redirecting to sign in...
            </p>
          )}
          {error && (
            <p className="text-kst-error text-sm text-center mt-1">{error}</p>
          )}
        </form>
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
