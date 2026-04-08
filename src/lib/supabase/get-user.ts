import 'server-only'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type Role = 'admin' | 'csm' | 'client'

export interface Profile {
  id: string
  full_name: string | null
  role: Role
  email?: string | null
  specialty?: 'csm' | 'ads' | 'systems' | 'organic' | 'sales' | null
  discord_id?: string | null
}

export interface UserWithProfile {
  user: User
  profile: Profile | null
}

/**
 * Server-side helper that returns the current authenticated user
 * along with their profile row (including role). Returns null when
 * no user is signed in.
 */
export async function getUserWithProfile(): Promise<UserWithProfile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user, profile: (profile as Profile) ?? null }
}
