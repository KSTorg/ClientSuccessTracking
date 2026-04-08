import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface AutoAssignBody {
  clientId?: string
  program?: 'educator_incubator' | 'accelerator'
}

type Specialty = 'ads' | 'systems' | 'organic' | 'sales'

interface TeamMember {
  id: string
  specialty: Specialty | null
}

interface ClientTaskRow {
  id: string
  task: { default_specialty: Specialty | null } | null
}

export async function POST(request: NextRequest) {
  // ── 1) Authn/authz: only signed-in admin/csm users may auto-assign ──
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
      { error: 'Only admin or csm users can run auto-assign' },
      { status: 403 }
    )
  }

  // ── 2) Parse + validate body ──
  let body: AutoAssignBody
  try {
    body = (await request.json()) as AutoAssignBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const clientId = body.clientId?.trim()
  const program = body.program

  if (!clientId || !program) {
    return NextResponse.json(
      { error: 'clientId and program are required' },
      { status: 400 }
    )
  }
  if (program !== 'educator_incubator' && program !== 'accelerator') {
    return NextResponse.json({ error: 'invalid program' }, { status: 400 })
  }

  // ── 3) Build the admin client ──
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
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  // ── 4) Fetch everything we need ──
  const [tasksRes, teamRes, clientRes, countsRes] = await Promise.all([
    supabaseAdmin
      .from('client_tasks')
      .select('id, task:tasks ( default_specialty )')
      .eq('client_id', clientId),
    supabaseAdmin
      .from('profiles')
      .select('id, specialty')
      .in('role', ['admin', 'csm']),
    supabaseAdmin
      .from('clients')
      .select('assigned_csm, client_team')
      .eq('id', clientId)
      .single(),
    // Global assignment counts across ALL clients, for load balancing
    supabaseAdmin
      .from('client_tasks')
      .select('assigned_to')
      .not('assigned_to', 'is', null),
  ])

  if (tasksRes.error) {
    console.error('[api/auto-assign] tasks fetch error:', tasksRes.error)
    return NextResponse.json({ error: tasksRes.error.message }, { status: 500 })
  }

  const rawTasks = (tasksRes.data ?? []) as unknown[]
  const tasks: ClientTaskRow[] = rawTasks.map((r) => {
    const obj = r as Record<string, unknown>
    const t = Array.isArray(obj.task) ? obj.task[0] : obj.task
    return {
      id: obj.id as string,
      task: t
        ? { default_specialty: (t as { default_specialty: Specialty | null }).default_specialty ?? null }
        : null,
    }
  })

  const team = (teamRes.data ?? []) as TeamMember[]
  const clientRow = clientRes.data as {
    assigned_csm: string | null
    client_team: {
      csm: string | null
      ads: string | null
      systems: string | null
      organic: string | null
      sales: string | null
    } | null
  } | null
  const clientTeam = clientRow?.client_team ?? null

  // Build a global count map: user_id -> number of client_tasks assigned
  const counts = new Map<string, number>()
  for (const r of (countsRes.data ?? []) as { assigned_to: string | null }[]) {
    if (!r.assigned_to) continue
    counts.set(r.assigned_to, (counts.get(r.assigned_to) ?? 0) + 1)
  }

  // Group team members by specialty for fast lookup
  const bySpecialty = new Map<Specialty, TeamMember[]>()
  for (const m of team) {
    if (!m.specialty) continue
    if (!bySpecialty.has(m.specialty)) bySpecialty.set(m.specialty, [])
    bySpecialty.get(m.specialty)!.push(m)
  }

  function pickLeastLoaded(members: TeamMember[]): TeamMember | null {
    if (members.length === 0) return null
    // Sort by current count asc, then by id for determinism
    const sorted = [...members].sort((a, b) => {
      const ca = counts.get(a.id) ?? 0
      const cb = counts.get(b.id) ?? 0
      if (ca !== cb) return ca - cb
      return a.id.localeCompare(b.id)
    })
    return sorted[0]!
  }

  // ── 5) Decide assignments ──
  const updates: { id: string; assigned_to: string | null }[] = []

  if (program === 'educator_incubator') {
    // All tasks go to the client — null assignee
    for (const t of tasks) {
      updates.push({ id: t.id, assigned_to: null })
    }
  } else {
    // Accelerator: only tasks with a default_specialty get a team
    // assignee. Tasks without a default_specialty are client tasks and
    // stay NULL — the CSM is never auto-assigned as a fallback.
    for (const t of tasks) {
      const spec = t.task?.default_specialty ?? null
      let assigneeId: string | null = null

      if (spec) {
        // 1) Per-client slot (client_team.ads, .systems, .organic, .sales)
        const slotId = clientTeam ? clientTeam[spec] ?? null : null
        if (slotId) {
          assigneeId = slotId
          counts.set(slotId, (counts.get(slotId) ?? 0) + 1)
        } else {
          // 2) Load-balanced global search within the specialty
          const candidates = bySpecialty.get(spec) ?? []
          const picked = pickLeastLoaded(candidates)
          if (picked) {
            assigneeId = picked.id
            counts.set(picked.id, (counts.get(picked.id) ?? 0) + 1)
          }
          // 3) No specialist anywhere → leave as a client task (null).
        }
      }
      // No specialty on the task → client task (null).

      updates.push({ id: t.id, assigned_to: assigneeId })
    }
  }

  // ── 6) Write in parallel ──
  const results = await Promise.all(
    updates.map((u) =>
      supabaseAdmin
        .from('client_tasks')
        .update({ assigned_to: u.assigned_to })
        .eq('id', u.id)
    )
  )

  const errors = results
    .map((r, i) => (r.error ? { id: updates[i]!.id, error: r.error.message } : null))
    .filter((x): x is { id: string; error: string } => x !== null)

  if (errors.length > 0) {
    console.error('[api/auto-assign] partial failure:', errors)
    return NextResponse.json(
      {
        assigned: updates.length - errors.length,
        total: updates.length,
        errors,
      },
      { status: 207 }
    )
  }

  return NextResponse.json({
    assigned: updates.length,
    total: updates.length,
  })
}
