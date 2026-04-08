import 'server-only'
import { redirect } from 'next/navigation'
import {
  getUserWithProfile,
  type UserWithProfile,
} from '@/lib/supabase/get-user'

/**
 * Server helper for pages that should only be accessible to admin/csm
 * users. Redirects clients to /my-progress and unauthenticated users
 * to /login.
 */
export async function requireTeamMember(): Promise<UserWithProfile> {
  const data = await getUserWithProfile()
  if (!data || !data.profile) {
    redirect('/login')
  }
  const role = data.profile.role
  if (role !== 'admin' && role !== 'csm') {
    redirect('/my-progress')
  }
  return data
}
