import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendDiscordEmbed, COLORS, type DiscordEmbed } from '@/lib/discord'
import {
  getClientBlockers,
  formatShortDate,
  formatTodayLong,
  formatProgramLabel,
  type ClientBlockers,
} from '@/lib/overdue'

function buildEmbed(
  clientBlockers: ClientBlockers[],
  totalClients: number
): { embeds: Parameters<typeof sendDiscordEmbed>[0]; content?: string } {
  if (clientBlockers.length === 0) {
    return {
      embeds: [
        {
          title: '✅ All On Track',
          description: 'No overdue tasks across any client today.',
          color: COLORS.green,
          timestamp: new Date().toISOString(),
        },
      ],
    }
  }

  // Build description lines — one per client
  const mentions = new Set<string>()
  const lines: string[] = []
  for (const c of clientBlockers) {
    const b = c.blockers[0]!
    let assigneeStr = ''
    if (b.assignedTo) {
      if (b.discordId) {
        assigneeStr = `<@${b.discordId}>`
        mentions.add(`<@${b.discordId}>`)
      } else {
        assigneeStr = b.assignedName ?? 'Unassigned'
      }
    } else if (b.csmDiscordId) {
      assigneeStr = `<@${b.csmDiscordId}> (CSM)`
      mentions.add(`<@${b.csmDiscordId}>`)
    } else {
      assigneeStr = 'Client task'
    }

    lines.push(
      `**${c.companyName}** (${formatProgramLabel(c.program)})\n` +
        `⚠️ ${b.stageName}: "${b.taskTitle}" — Due ${formatShortDate(b.dueDate)}\n` +
        `→ ${assigneeStr}`
    )
  }

  const onTrack = totalClients - clientBlockers.length
  return {
    content: mentions.size > 0 ? [...mentions].join(' ') : undefined,
    embeds: [
      {
        title: '⚠️ Tasks Overdue',
        description: lines.join('\n\n'),
        color: COLORS.red,
        footer: {
          text: `📊 Summary: ${clientBlockers.length} clients with blockers · ${onTrack} on track — ${formatTodayLong()}`,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

export async function POST(request: NextRequest) {
  // Auth: accept either Bearer CRON_SECRET or Vercel cron header
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  const isBearerValid =
    cronSecret && authHeader === `Bearer ${cronSecret}`
  const isVercelCron = request.headers.has('x-vercel-cron')

  if (!isBearerValid && !isVercelCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
      { status: 500 }
    )
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  try {
    const { blockers, totalClients } = await getClientBlockers(supabaseAdmin)
    const { embeds, content } = buildEmbed(blockers, totalClients)
    await sendDiscordEmbed(embeds, content)

    // ── Programs ending soon (next 7 days) ──
    const todayStr = new Date().toISOString().slice(0, 10)
    const in7 = new Date()
    in7.setDate(in7.getDate() + 7)
    const in7Str = in7.toISOString().slice(0, 10)

    const { data: endingSoon } = await supabaseAdmin
      .from('clients')
      .select('id, company_name, program, program_end_date, client_team, assigned_csm')
      .gte('program_end_date', todayStr)
      .lte('program_end_date', in7Str)

    if (endingSoon && endingSoon.length > 0) {
      const endMentions = new Set<string>()
      const endLines: string[] = []

      for (const c of endingSoon as Array<{
        company_name: string
        program: string | null
        program_end_date: string
        client_team: Record<string, string | null> | null
        assigned_csm: string | null
      }>) {
        const daysLeft = Math.round(
          (new Date(c.program_end_date + 'T00:00:00').getTime() -
            new Date(todayStr + 'T00:00:00').getTime()) /
            86400000
        )
        const csmId = c.client_team?.csm ?? c.assigned_csm ?? null
        let csmStr = ''
        if (csmId) {
          const { data: csm } = await supabaseAdmin
            .from('profiles')
            .select('discord_id, full_name')
            .eq('id', csmId)
            .maybeSingle()
          const csmObj = csm as { discord_id: string | null; full_name: string | null } | null
          if (csmObj?.discord_id) {
            csmStr = ` — <@${csmObj.discord_id}>`
            endMentions.add(`<@${csmObj.discord_id}>`)
          } else if (csmObj?.full_name) {
            csmStr = ` — ${csmObj.full_name}`
          }
        }
        endLines.push(
          `• **${c.company_name}** — ${formatProgramLabel(c.program)} ends ${formatShortDate(c.program_end_date)} (${daysLeft}d)${csmStr}`
        )
      }

      const endEmbed: DiscordEmbed = {
        title: '⏰ Programs Ending Soon',
        description: endLines.join('\n'),
        color: 0xfbbf24,
        timestamp: new Date().toISOString(),
      }
      await sendDiscordEmbed(
        [endEmbed],
        endMentions.size > 0 ? [...endMentions].join(' ') : undefined
      )
    }

    return NextResponse.json({
      success: true,
      clientsWithBlockers: blockers.length,
      totalClients,
    })
  } catch (err) {
    console.error('[tasks-overdue] unhandled error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Vercel Cron fires a GET by default; accept it too.
export async function GET(request: NextRequest) {
  return POST(request)
}
