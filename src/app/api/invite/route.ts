import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface InviteBody {
  email?: string
  fullName?: string
  role?: 'admin' | 'csm' | 'client'
  password?: string
}

export async function POST(request: NextRequest) {
  // ── 1) Authn/authz: only signed-in admin or csm users may invite ──
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
  if (callerRole !== 'admin' && callerRole !== 'csm') {
    return NextResponse.json(
      { error: 'Only admin or csm users can send invites' },
      { status: 403 }
    )
  }

  // ── 2) Parse + validate body ──
  let body: InviteBody
  try {
    body = (await request.json()) as InviteBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const fullName = body.fullName?.trim()
  const role = body.role
  const password = body.password

  if (!email || !fullName || !role || !password) {
    return NextResponse.json(
      { error: 'email, fullName, role, and password are all required' },
      { status: 400 }
    )
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 }
    )
  }
  if (role !== 'admin' && role !== 'csm' && role !== 'client') {
    return NextResponse.json({ error: 'invalid role' }, { status: 400 })
  }
  // CSMs can invite clients but not other team members
  if (callerRole === 'csm' && role !== 'client') {
    return NextResponse.json(
      { error: 'CSMs can only invite client users' },
      { status: 403 }
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

  // ── 4) Create the auth user with the password the admin chose ──
  const { data: created, error: createErr } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    })

  if (createErr) {
    console.error('[api/invite] createUser error:', createErr)
    const msg = createErr.message || 'Could not create user'
    const status =
      /already.*registered|already.*exists|duplicate/i.test(msg) ? 409 : 500
    return NextResponse.json({ error: msg }, { status })
  }
  if (!created.user) {
    return NextResponse.json(
      { error: 'createUser returned no user' },
      { status: 500 }
    )
  }

  // ── 5) Explicitly upsert the profile row ──
  // Don't rely on any trigger — the invite route guarantees the profile
  // exists with the exact role/name/email the admin chose. Using the admin
  // client so RLS never interferes. This is done for every role, including
  // client contacts, so the same code path covers both team and contact
  // invite flows.
  const { error: profileUpsertErr } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: created.user.id,
        full_name: fullName,
        email,
        role,
      },
      { onConflict: 'id' }
    )

  if (profileUpsertErr) {
    console.error('[api/invite] profile upsert error:', profileUpsertErr)
    // Roll back the auth user so the caller can retry with the same email
    // instead of ending up with an orphan auth record they can't re-invite.
    try {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id)
    } catch (rollbackErr) {
      console.error(
        '[api/invite] rollback deleteUser also failed:',
        rollbackErr
      )
    }
    return NextResponse.json(
      {
        error: `Auth user created but profile insert failed: ${profileUpsertErr.message}. Rolled back.`,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ userId: created.user.id })
}
