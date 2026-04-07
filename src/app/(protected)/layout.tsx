import { redirect } from 'next/navigation'
import { getUserWithProfile } from '@/lib/supabase/get-user'
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
