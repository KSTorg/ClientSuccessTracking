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
  console.log('[invite] starting invite for', {
    email: params.email,
    fullName: params.fullName,
    role: params.role,
  })

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
  console.log('[invite] session-less client created')

  const tempPassword = generateTempPassword()

  console.log('[invite] calling signUp...')
  const signUpRes = await tempClient.auth.signUp({
    email: params.email,
    password: tempPassword,
    options: {
      data: { full_name: params.fullName, role: params.role },
      emailRedirectTo: `${window.location.origin}/update-password`,
    },
  })
  console.log('[invite] signUp response:', {
    user: signUpRes.data?.user
      ? {
          id: signUpRes.data.user.id,
          email: signUpRes.data.user.email,
          created_at: signUpRes.data.user.created_at,
          confirmed: signUpRes.data.user.confirmed_at,
        }
      : null,
    sessionPresent: !!signUpRes.data?.session,
    error: signUpRes.error,
  })

  if (signUpRes.error) {
    // Surface a friendlier message for the most common case.
    const msg = signUpRes.error.message || 'Sign-up failed'
    if (
      /already.*registered/i.test(msg) ||
      /already.*exists/i.test(msg) ||
      /duplicate/i.test(msg)
    ) {
      throw new Error(
        `That email is already registered. Send them a password reset instead.`
      )
    }
    throw new Error(msg)
  }
  if (!signUpRes.data.user) {
    throw new Error(
      'Sign-up returned no user. Check Supabase auth settings (email confirmation may be blocking this).'
    )
  }

  console.log('[invite] calling resetPasswordForEmail...')
  const resetRes = await tempClient.auth.resetPasswordForEmail(params.email, {
    redirectTo: `${window.location.origin}/update-password`,
  })
  console.log('[invite] resetPasswordForEmail response:', {
    error: resetRes.error,
  })

  if (resetRes.error) {
    // The auth user exists at this point, so we don't fail the whole flow,
    // but we do surface the warning visibly.
    console.warn(
      '[invite] reset email failed (user was still created):',
      resetRes.error
    )
  }

  console.log('[invite] done. user id:', signUpRes.data.user.id)
  return { userId: signUpRes.data.user.id }
}
