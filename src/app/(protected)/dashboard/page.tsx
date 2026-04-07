import { redirect } from 'next/navigation'
import { getUserWithProfile } from '@/lib/supabase/get-user'
import { SignOutButton } from '@/components/sign-out-button'

export default async function DashboardPage() {
  const data = await getUserWithProfile()
  if (!data || !data.profile) redirect('/login')

  const name = data.profile.full_name ?? data.user.email ?? 'there'

  return (
    <div className="max-w-4xl">
      <h1
        className="text-5xl md:text-6xl text-kst-gold tracking-tight"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Dashboard
      </h1>
      <p className="mt-3 text-kst-white text-lg">
        Welcome back, <span className="font-semibold">{name}</span>
      </p>

      <div className="glass-panel mt-8 p-8">
        <p className="text-kst-white text-base mb-2 font-semibold">
          KST Team Dashboard
        </p>
        <p className="text-kst-muted text-sm leading-relaxed">
          This is the KST Team dashboard. Client management coming in Phase 2.
        </p>
      </div>

      <div className="mt-8">
        <SignOutButton />
      </div>
    </div>
  )
}
