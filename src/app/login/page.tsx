'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password })

    if (signInError || !signInData.user) {
      setError(signInError?.message ?? 'Unable to sign in.')
      setLoading(false)
      return
    }

    // ───── DEBUG: profile lookup ──────────────────────────────────────────
    // Remove these logs once the missing-profile bug is resolved.
    console.log('[login] auth user id:', signInData.user.id)
    console.log('[login] auth user email:', signInData.user.email)
    console.log(
      '[login] querying: supabase.from("profiles").select("role").eq("id",',
      signInData.user.id,
      ').single()'
    )

    // Look up role from profiles to decide where to land
    const profileRes = await supabase
      .from('profiles')
      .select('role')
      .eq('id', signInData.user.id)
      .single()

    console.log('[login] profile query response:', profileRes)
    console.log('[login]   data:', profileRes.data)
    console.log('[login]   error:', profileRes.error)
    if (profileRes.error) {
      console.log('[login]   error.code:', profileRes.error.code)
      console.log('[login]   error.message:', profileRes.error.message)
      console.log('[login]   error.details:', profileRes.error.details)
      console.log('[login]   error.hint:', profileRes.error.hint)
    }

    // Extra: show what an unscoped query returns to confirm RLS visibility
    const allRowsRes = await supabase.from('profiles').select('id, role')
    console.log(
      '[login] sanity check — profiles visible to this user:',
      allRowsRes
    )
    // ──────────────────────────────────────────────────────────────────────

    const { data: profile, error: profileError } = profileRes

    if (profileError || !profile) {
      setError('Signed in, but no profile was found for this user.')
      setLoading(false)
      return
    }

    const role = (profile as { role: string }).role
    if (role === 'admin' || role === 'csm') {
      router.replace('/dashboard')
    } else if (role === 'client') {
      router.replace('/my-progress')
    } else {
      router.replace('/')
    }
    router.refresh()
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
        style={{
          animation: 'kst-fade-up 0.5s ease-out both',
        }}
      >
        <h2 className="text-kst-white text-2xl font-semibold mb-6">Sign In</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="w-full h-12 px-4 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors disabled:opacity-60"
          />

          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full h-12 px-4 rounded-xl bg-kst-dark border border-white/10 text-kst-white placeholder:text-kst-muted focus:outline-none focus:border-kst-gold/60 focus:ring-2 focus:ring-kst-gold/20 transition-colors disabled:opacity-60"
          />

          <Link
            href="/reset-password"
            className="self-end -mt-1 text-xs text-kst-muted hover:text-kst-gold transition-colors"
          >
            Forgot password?
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-2 rounded-xl bg-kst-gold text-kst-black font-semibold tracking-wide hover:bg-kst-gold-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_8px_32px_rgba(201,168,76,0.18)]"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

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
