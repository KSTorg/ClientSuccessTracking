import { redirect } from 'next/navigation'
import { getUserWithProfile } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ProtectedShell } from '@/components/protected-shell'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const data = await getUserWithProfile()

  if (!data) {
    redirect('/login')
  }
  if (!data.profile) {
    // Clear the session so the middleware doesn't bounce them back here.
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login?error=missing_profile')
  }

  return (
    <ProtectedShell
      fullName={data.profile.full_name ?? ''}
      email={data.user.email ?? ''}
      role={data.profile.role}
    >
      {children}
    </ProtectedShell>
  )
}
