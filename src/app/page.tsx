import { redirect } from 'next/navigation'
import { getUserWithProfile } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'

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

  // Authenticated but no/unknown profile: clear the session before bouncing
  // to /login so the middleware doesn't ping-pong them back here.
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login?error=missing_profile')
}
