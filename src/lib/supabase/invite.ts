import type { Role } from '@/lib/supabase/get-user'
import type { Specialty } from '@/lib/types'

/**
 * Invite a new user via the server-side /api/invite route. The route
 * uses the Supabase admin API (service_role key) to create the user
 * with the password the admin chose, no confirmation email required.
 * The admin then shares the password with the invitee directly.
 */
export async function inviteUser(params: {
  email: string
  fullName: string
  role: Role
  password: string
  specialty?: Specialty | null
  discordId?: string | null
}): Promise<{ userId: string }> {
  const res = await fetch('/api/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      password: params.password,
      specialty: params.specialty ?? null,
      discordId: params.discordId ?? null,
    }),
  })

  let data: { userId?: string; error?: string } = {}
  try {
    data = await res.json()
  } catch {
    // ignore — fall through to status check below
  }
  if (!res.ok) {
    throw new Error(data.error || `Invite failed (${res.status})`)
  }
  if (!data.userId) {
    throw new Error('Invite succeeded but no userId was returned')
  }

  return { userId: data.userId }
}
