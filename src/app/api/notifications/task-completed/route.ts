import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendDiscordEmbed, COLORS, type DiscordEmbed } from '@/lib/discord'
import { getClientBlockers, clientLabel, formatShortDate } from '@/lib/overdue'

interface Body {
  clientId?: string
  taskTitle?: string
  completedByName?: string
}

export async function POST(request: NextRequest) {
  // Must be a signed-in user
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

  const clientId = body.clientId?.trim()
  const taskTitle = body.taskTitle?.trim() ?? 'Task'
  let completedByName = body.completedByName?.trim() ?? ''

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  // Fall back to the caller's profile full_name when not supplied
  if (!completedByName) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    completedByName =
      (profile as { full_name: string | null } | null)?.full_name ?? 'Someone'
  }

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
    // Look up client for the display name + contact
    const { data: clientRow } = await supabaseAdmin
      .from('clients')
      .select('company_name, contact_name')
      .eq('id', clientId)
      .maybeSingle()
    const cl = clientRow as { company_name: string | null; contact_name: string | null } | null
    const companyName = cl?.company_name ?? 'Client'
    const contactName = cl?.contact_name ?? null
    const displayName = clientLabel(companyName, contactName)

    // Compute current blockers for just this client
    const { blockers } = await getClientBlockers(supabaseAdmin, { clientId })
    const clientState = blockers.find((b) => b.clientId === clientId)

    if (!clientState || clientState.blockers.length === 0) {
      // No remaining overdue tasks — all caught up
      await sendDiscordEmbed([
        {
          title: '🎉 All Caught Up!',
          description: `**${displayName}** has no more overdue tasks.`,
          color: COLORS.gold,
          timestamp: new Date().toISOString(),
        },
      ])
      return NextResponse.json({ success: true, state: 'all_caught_up' })
    }

    // There is still at least one blocker. Report the new first blocker.
    const next = clientState.blockers[0]!
    const mention = next.assignedTo
      ? next.discordId
        ? `<@${next.discordId}>`
        : next.assignedName ?? 'Unassigned'
      : next.csmDiscordId
        ? `<@${next.csmDiscordId}> (CSM)`
        : 'Client task'

    // Collect pings for content (outside embed)
    const pings: string[] = []
    if (next.discordId) pings.push(`<@${next.discordId}>`)
    else if (next.csmDiscordId) pings.push(`<@${next.csmDiscordId}>`)

    const embed: DiscordEmbed = {
      title: '✅ Task Completed',
      description: `**${displayName}** — "${taskTitle}"\nCompleted by: ${completedByName}`,
      color: COLORS.green,
      fields: [
        {
          name: '⏭️ Next Up',
          value: `"${next.taskTitle}" — Due ${formatShortDate(next.dueDate)}\n→ ${mention}`,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    }

    await sendDiscordEmbed([embed], pings.length > 0 ? pings.join(' ') : undefined)
    return NextResponse.json({ success: true, state: 'next_up' })
  } catch (err) {
    console.error('[task-completed] unhandled error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown' },
      { status: 200 }
    )
  }
}
