import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface DeleteBody {
  userId?: string
}

export async function POST(request: NextRequest) {
  // ── 1) Authn/authz: must be a signed-in admin ──
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'No profile found for the signed-in user' },
      { status: 403 }
    )
  }

  const callerRole = (profile as { role: string }).role
  if (callerRole !== 'admin') {
    return NextResponse.json(
      { error: 'Only admins can delete users' },
      { status: 403 }
    )
  }

  // ── 2) Parse + validate body ──
  let body: DeleteBody
  try {
    body = (await request.json()) as DeleteBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const userId = body.userId?.trim()
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  // Defensive: never let an admin delete themselves through this endpoint.
  if (userId === user.id) {
    return NextResponse.json(
      { error: 'You cannot delete your own account.' },
      { status: 400 }
    )
  }

  // ── 3) Build the admin client (service role — server-only) ──
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' },
      { status: 500 }
    )
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )

  // Defensive: refuse to delete an admin via this endpoint. We look the
  // target up server-side (not from the client payload) so a stale UI can't
  // trick us into wiping the wrong row.
  const { data: target, error: targetErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()

  if (targetErr) {
    console.error('[api/delete-user] target lookup failed:', targetErr)
    return NextResponse.json({ error: targetErr.message }, { status: 500 })
  }

  if (target && (target as { role: string }).role === 'admin') {
    return NextResponse.json(
      {
        error:
          'Admin users cannot be deleted through this endpoint. Demote them to CSM first.',
      },
      { status: 403 }
    )
  }

  // ── 4) Delete the profile row first (so RLS-protected reads stop returning it) ──
  const { error: profileDelErr } = await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (profileDelErr) {
    console.error('[api/delete-user] profile delete failed:', profileDelErr)
    return NextResponse.json({ error: profileDelErr.message }, { status: 500 })
  }

  // ── 5) Delete the auth user ──
  const { error: authDelErr } =
    await supabaseAdmin.auth.admin.deleteUser(userId)

  if (authDelErr) {
    console.error('[api/delete-user] auth delete failed:', authDelErr)
    // Profile is already gone — surface the error so the operator knows
    // they may need to clean up auth.users manually.
    return NextResponse.json(
      {
        error: `Profile was deleted but auth user removal failed: ${authDelErr.message}`,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
