import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendDiscordMessages } from '@/lib/discord'
import {
  getClientBlockers,
  formatShortDate,
  formatTodayLong,
  formatProgramLabel,
  type ClientBlockers,
} from '@/lib/overdue'

function buildMessages(
  clientBlockers: ClientBlockers[],
  totalClients: number
): string[] {
  if (clientBlockers.length === 0) {
    return [
      `✅ **All clients on track!** No overdue tasks today (${formatTodayLong()}).`,
    ]
  }

  const header = `🌅 **KST Tasks Overdue** — ${formatTodayLong()}`
  const summary = `📊 Summary: **${clientBlockers.length}** clients with blockers · **${
    totalClients - clientBlockers.length
  }** clients on track`

  // Build a section per client
  const sections: string[] = []
  for (const c of clientBlockers) {
    const lines: string[] = []
    lines.push(`\n**${c.companyName}** (${formatProgramLabel(c.program)})`)
    for (const b of c.blockers) {
      lines.push(
        `⚠️ ${b.stageName}: "${b.taskTitle}" — Due ${formatShortDate(b.dueDate)}`
      )
      if (b.assignedTo) {
        if (b.discordId) {
          lines.push(`→ Assigned to: <@${b.discordId}>`)
        } else {
          lines.push(`→ Assigned to: ${b.assignedName ?? 'Unassigned'}`)
        }
      } else {
        // Client task — ping the CSM
        if (b.csmDiscordId) {
          lines.push(`→ Client task — CSM: <@${b.csmDiscordId}>`)
        } else {
          lines.push(`→ Client task`)
        }
      }
    }
    sections.push(lines.join('\n'))
  }

  // Chunk into <= 1900-char messages
  const LIMIT = 1800
  const messages: string[] = []
  let current = header
  for (const section of sections) {
    if ((current + section).length > LIMIT) {
      messages.push(current)
      current = ''
    }
    current += section
  }
  // Append summary to the last message (or push a new one if it overflows)
  if ((current + '\n\n' + summary).length > LIMIT) {
    if (current.trim()) messages.push(current)
    messages.push(summary)
  } else {
    current += `\n\n${summary}`
    if (current.trim()) messages.push(current)
  }

  return messages
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
    const messages = buildMessages(blockers, totalClients)
    await sendDiscordMessages(messages)

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
