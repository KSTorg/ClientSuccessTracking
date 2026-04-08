import type { Role } from '@/lib/supabase/get-user'

/**
 * Invite a new user via the server-side /api/invite route, which uses
 * the Supabase admin API (service_role key) so it bypasses the
 * "Allow new users to sign up" project setting and any rate limits on
 * the public signUp endpoint. The route also enforces auth (must be a
 * signed-in admin/csm user) and role-scoped permissions.
 */
export async function inviteUser(params: {
  email: string
  fullName: string
  role: Role
}): Promise<{ userId: string }> {
  console.log('[invite] POST /api/invite', {
    email: params.email,
    fullName: params.fullName,
    role: params.role,
  })

  const res = await fetch('/api/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      fullName: params.fullName,
      role: params.role,
    }),
  })

  let data: { userId?: string; error?: string; warning?: string } = {}
  try {
    data = await res.json()
  } catch {
    // ignore — fall through to status check below
  }
  console.log('[invite] /api/invite response:', { status: res.status, data })

  if (!res.ok) {
    throw new Error(data.error || `Invite failed (${res.status})`)
  }
  if (!data.userId) {
    throw new Error('Invite succeeded but no userId was returned')
  }
  if (data.warning) {
    console.warn('[invite] warning from server:', data.warning)
  }

  return { userId: data.userId }
}
