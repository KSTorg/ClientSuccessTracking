import { redirect } from 'next/navigation'
import { getUserWithProfile } from '@/lib/supabase/get-user'

export default async function Home() {
  const data = await getUserWithProfile()

  if (!data) {
    redirect('/login')
  }

  const role = data.profile?.role

  if (role === 'admin' || role === 'csm') {
    redirect('/dashboard')
  }
  if (role === 'client') {
    redirect('/my-progress')
  }

  // Authenticated but missing/unknown role: send to login with a hint.
  redirect('/login?error=missing_profile')
}
