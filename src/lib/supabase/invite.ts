import { createBrowserClient } from '@supabase/ssr'
import type { Role } from '@/lib/supabase/get-user'

/**
 * Generate a throwaway password for the signUp + resetPassword invite flow.
 * The user will reset it via the email link before they ever sign in.
 */
function generateTempPassword(): string {
  const a = Math.random().toString(36).slice(-8)
  const b = Math.random().toString(36).slice(-8)
  return `${a}${b}A1!`
}

/**
 * Invite a new user without disturbing the current session.
 *
 * Uses a fresh Supabase browser client with persistSession: false so the
 * signUp call does NOT replace the inviter's auth cookies. After the user
 * is created, sends them a password reset email pointed at /update-password
 * so they can set their own password before first sign-in.
 */
export async function inviteUser(params: {
  email: string
  fullName: string
  role: Role
}): Promise<{ userId: string }> {
  const tempClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )

  const tempPassword = generateTempPassword()

  const { data, error } = await tempClient.auth.signUp({
    email: params.email,
    password: tempPassword,
    options: {
      data: { full_name: params.fullName, role: params.role },
      emailRedirectTo: `${window.location.origin}/update-password`,
    },
  })

  if (error) throw error
  if (!data.user) throw new Error('User was not created')

  // Send the recovery email so they can set their own password.
  const { error: resetError } = await tempClient.auth.resetPasswordForEmail(
    params.email,
    {
      redirectTo: `${window.location.origin}/update-password`,
    }
  )
  if (resetError) {
    // Not fatal — the account exists, just warn.
    console.warn('Reset email failed:', resetError.message)
  }

  return { userId: data.user.id }
}
