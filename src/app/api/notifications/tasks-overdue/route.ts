import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendDiscordEmbed, COLORS } from '@/lib/discord'
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
