import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendDiscordMessage } from '@/lib/discord'
import { formatProgramLabel, formatTodayLong } from '@/lib/overdue'

interface Body {
  type?: 'new_client' | 'launched'
  clientId?: string
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = body.type
  const clientId = body.clientId?.trim()
  if (!type || !clientId) {
    return NextResponse.json(
      { error: 'type and clientId are required' },
      { status: 400 }
    )
  }

  // Look up the caller's display name
  const { data: caller } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()
  const callerName =
    (caller as { full_name: string | null } | null)?.full_name ?? 'Someone'

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ success: false }, { status: 200 })
  }
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  try {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select(
        'id, company_name, program, joined_date, launched_date, client_team, assigned_csm, created_at'
      )
      .eq('id', clientId)
      .maybeSingle()

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    const c = client as {
      company_name: string
      program: string | null
      joined_date: string | null
      launched_date: string | null
      client_team: Record<string, string | null> | null
      assigned_csm: string | null
      created_at: string | null
    }

    // Resolve CSM discord id for mentions
    const csmId = c.client_team?.csm ?? c.assigned_csm ?? null
    let csmMention = ''
    if (csmId) {
      const { data: csmRow } = await supabaseAdmin
        .from('profiles')
        .select('full_name, discord_id')
        .eq('id', csmId)
        .maybeSingle()
      const csm = csmRow as {
        full_name: string | null
        discord_id: string | null
      } | null
      if (csm?.discord_id) csmMention = `<@${csm.discord_id}>`
      else if (csm?.full_name) csmMention = csm.full_name
    }

    if (type === 'new_client') {
      const lines = [
        `🆕 **New Client: ${c.company_name}** (${formatProgramLabel(
          c.program
        )})`,
      ]
      if (csmMention) lines.push(`CSM: ${csmMention}`)
      lines.push(`Joined: ${formatTodayLong()}`)
      lines.push(`Added by: ${callerName}`)
      await sendDiscordMessage(lines.join('\n'))
      return NextResponse.json({ success: true })
    }

    if (type === 'launched') {
      // Compute days to launch from joined_date → launched_date (or today)
      let days: number | null = null
      const joined = c.joined_date ?? c.created_at
      if (joined) {
        const [jy, jm, jd] = joined.slice(0, 10).split('-').map(Number)
        const launchIso =
          c.launched_date ?? new Date().toISOString().slice(0, 10)
        const [ly, lm, ld] = launchIso.split('-').map(Number)
        const jDate = new Date(jy!, (jm ?? 1) - 1, jd ?? 1)
        const lDate = new Date(ly!, (lm ?? 1) - 1, ld ?? 1)
        days = Math.round(
          (lDate.getTime() - jDate.getTime()) / 86400000
        )
      }

      const lines = [
        `🚀 **${c.company_name} just launched!** 🎉`,
        `Launched by: ${callerName}`,
        `Program: ${formatProgramLabel(c.program)}`,
      ]
      if (days !== null && days >= 0) {
        lines.push(`Time to launch: ${days} day${days === 1 ? '' : 's'}`)
      }
      if (csmMention) lines.push(`CSM: ${csmMention}`)
      await sendDiscordMessage(lines.join('\n'))
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: `Unknown event type: ${type}` },
      { status: 400 }
    )
  } catch (err) {
    console.error('[client-event] unhandled error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown' },
      { status: 200 }
    )
  }
}
