import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendDiscordEmbed, COLORS, type DiscordEmbed } from '@/lib/discord'
import {
  getClientBlockers,
  clientLabel,
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
      `**${clientLabel(c.companyName, c.contactName)}** (${formatProgramLabel(c.program)})\n` +
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

    // ── Programs ending in exactly 7 or 3 days ──
    const todayStr = new Date().toISOString().slice(0, 10)
    const in3 = new Date()
    in3.setDate(in3.getDate() + 3)
    const in3Str = in3.toISOString().slice(0, 10)
    const in7 = new Date()
    in7.setDate(in7.getDate() + 7)
    const in7Str = in7.toISOString().slice(0, 10)

    const { data: endingSoon } = await supabaseAdmin
      .from('clients')
      .select('id, company_name, contact_name, program, program_end_date, client_team, assigned_csm')
      .in('program_end_date', [in3Str, in7Str])

    if (endingSoon && endingSoon.length > 0) {
      const endClients = endingSoon as Array<{
        company_name: string
        contact_name: string | null
        program: string | null
        program_end_date: string
        client_team: Record<string, string | null> | null
        assigned_csm: string | null
      }>

      // Batch-resolve CSM profiles
      const endCsmIds = new Set<string>()
      for (const c of endClients) {
        const cid = c.client_team?.csm ?? c.assigned_csm ?? null
        if (cid) endCsmIds.add(cid)
      }
      const endProfileMap = new Map<string, { discord_id: string | null; full_name: string | null }>()
      if (endCsmIds.size > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, discord_id, full_name')
          .in('id', [...endCsmIds])
        for (const p of (profiles ?? []) as { id: string; discord_id: string | null; full_name: string | null }[]) {
          endProfileMap.set(p.id, { discord_id: p.discord_id, full_name: p.full_name })
        }
      }

      const endMentions = new Set<string>()
      const endLines: string[] = []

      for (const c of endClients) {
        const daysLeft = Math.round(
          (new Date(c.program_end_date + 'T00:00:00').getTime() -
            new Date(todayStr + 'T00:00:00').getTime()) /
            86400000
        )
        const csmId = c.client_team?.csm ?? c.assigned_csm ?? null
        let csmStr = ''
        if (csmId) {
          const csm = endProfileMap.get(csmId) ?? null
          if (csm?.discord_id) {
            csmStr = ` — <@${csm.discord_id}>`
            endMentions.add(`<@${csm.discord_id}>`)
          } else if (csm?.full_name) {
            csmStr = ` — ${csm.full_name}`
          }
        }
        endLines.push(
          `• **${clientLabel(c.company_name, c.contact_name)}** — ${formatProgramLabel(c.program)} ends ${formatShortDate(c.program_end_date)} (${daysLeft}d)${csmStr}`
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

    // ── Churn risk: program ended, no active subs, not churned ──
    const { data: churnRisk } = await supabaseAdmin
      .from('analytics_churn_risk')
      .select('company_name, program_end_date, client_id')
      .eq('risk_level', 'at_risk')

    if (churnRisk && churnRisk.length > 0) {
      const riskClients = churnRisk as Array<{
        company_name: string
        program_end_date: string | null
        client_id: string
      }>
      const riskClientIds = riskClients.map((c) => c.client_id)

      // Batch fetch: clients, profiles, contacts
      const [clientsRes, contactsRes] = await Promise.all([
        supabaseAdmin
          .from('clients')
          .select('id, client_team, assigned_csm')
          .in('id', riskClientIds),
        supabaseAdmin
          .from('client_contacts')
          .select('client_id, full_name')
          .in('client_id', riskClientIds)
          .eq('is_primary', true),
      ])

      const clientMap = new Map<string, { client_team: Record<string, string | null> | null; assigned_csm: string | null }>()
      for (const r of (clientsRes.data ?? []) as { id: string; client_team: Record<string, string | null> | null; assigned_csm: string | null }[]) {
        clientMap.set(r.id, { client_team: r.client_team, assigned_csm: r.assigned_csm })
      }

      const contactMap = new Map<string, string>()
      for (const r of (contactsRes.data ?? []) as { client_id: string; full_name: string | null }[]) {
        if (r.full_name) contactMap.set(r.client_id, r.full_name)
      }

      // Collect CSM IDs and batch fetch profiles
      const riskCsmIds = new Set<string>()
      for (const [, cl] of clientMap) {
        const cid = cl.client_team?.csm ?? cl.assigned_csm ?? null
        if (cid) riskCsmIds.add(cid)
      }
      const riskProfileMap = new Map<string, { discord_id: string | null; full_name: string | null }>()
      if (riskCsmIds.size > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, discord_id, full_name')
          .in('id', [...riskCsmIds])
        for (const p of (profiles ?? []) as { id: string; discord_id: string | null; full_name: string | null }[]) {
          riskProfileMap.set(p.id, { discord_id: p.discord_id, full_name: p.full_name })
        }
      }

      const riskMentions = new Set<string>()
      const riskLines: string[] = []

      for (const c of riskClients) {
        const cl = clientMap.get(c.client_id)
        const csmId = cl?.client_team?.csm ?? cl?.assigned_csm ?? null
        let csmStr = ''
        if (csmId) {
          const csm = riskProfileMap.get(csmId) ?? null
          if (csm?.discord_id) {
            csmStr = ` — <@${csm.discord_id}>`
            riskMentions.add(`<@${csm.discord_id}>`)
          } else if (csm?.full_name) {
            csmStr = ` — ${csm.full_name}`
          }
        }
        const contactName = contactMap.get(c.client_id) ?? null

        riskLines.push(
          `• **${clientLabel(c.company_name, contactName)}** — Program ended ${formatShortDate(c.program_end_date)}, no subscriptions${csmStr}`
        )
      }

      const riskEmbed: DiscordEmbed = {
        title: '⚠️ Churn Risk — No Active Subscriptions',
        description: riskLines.join('\n'),
        color: COLORS.gold,
        timestamp: new Date().toISOString(),
      }
      await sendDiscordEmbed(
        [riskEmbed],
        riskMentions.size > 0 ? [...riskMentions].join(' ') : undefined
      )
    }

    // ── Midway Form Reminders ──
    const { data: midwayCandidates } = await supabaseAdmin
      .from('clients')
      .select('id, company_name, contact_name, launched_date, program_end_date, client_team, assigned_csm')
      .eq('midway_form_reminded', false)
      .not('launched_date', 'is', null)
      .in('status', ['launched', 'onboarding'])

    if (midwayCandidates && midwayCandidates.length > 0) {
      const candidates = midwayCandidates as Array<{
        id: string
        company_name: string
        contact_name: string | null
        launched_date: string
        program_end_date: string | null
        client_team: Record<string, string | null> | null
        assigned_csm: string | null
      }>

      // Determine which clients need the midway reminder today
      const clientsToRemind = candidates.filter((c) => {
        const launchPlus30 = new Date(c.launched_date)
        launchPlus30.setDate(launchPlus30.getDate() + 30)

        let endMinus10: Date | null = c.program_end_date
          ? new Date(c.program_end_date)
          : null
        if (endMinus10) endMinus10.setDate(endMinus10.getDate() - 10)

        const midwayDate = endMinus10 && endMinus10 < launchPlus30
          ? endMinus10
          : launchPlus30

        const midwayIso = midwayDate.toISOString().slice(0, 10)
        return midwayIso <= todayStr
      })

      if (clientsToRemind.length > 0) {
        // Batch-resolve CSM profiles
        const midCsmIds = new Set<string>()
        for (const c of clientsToRemind) {
          const cid = c.client_team?.csm ?? c.assigned_csm ?? null
          if (cid) midCsmIds.add(cid)
        }
        const midProfileMap = new Map<string, { discord_id: string | null; full_name: string | null }>()
        if (midCsmIds.size > 0) {
          const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, discord_id, full_name')
            .in('id', [...midCsmIds])
          for (const p of (profiles ?? []) as { id: string; discord_id: string | null; full_name: string | null }[]) {
            midProfileMap.set(p.id, { discord_id: p.discord_id, full_name: p.full_name })
          }
        }

        const midMentions = new Set<string>()
        const midLines: string[] = []

        for (const c of clientsToRemind) {
          const csmId = c.client_team?.csm ?? c.assigned_csm ?? null
          let csmStr = ''
          if (csmId) {
            const csm = midProfileMap.get(csmId) ?? null
            if (csm?.discord_id) {
              csmStr = ` — <@${csm.discord_id}>`
              midMentions.add(`<@${csm.discord_id}>`)
            } else if (csm?.full_name) {
              csmStr = ` — ${csm.full_name}`
            }
          }
          midLines.push(
            `**${clientLabel(c.company_name, c.contact_name)}** — Launched ${formatShortDate(c.launched_date)}\n→ Send the **Midway Form** to the client.${csmStr}`
          )
        }

        const midEmbed: DiscordEmbed = {
          title: '📋 Midway Form Reminder',
          description: midLines.join('\n\n'),
          color: COLORS.gold,
          timestamp: new Date().toISOString(),
        }
        await sendDiscordEmbed(
          [midEmbed],
          midMentions.size > 0 ? [...midMentions].join(' ') : undefined
        )

        // Mark as reminded
        const remindedIds = clientsToRemind.map((c) => c.id)
        await supabaseAdmin
          .from('clients')
          .update({ midway_form_reminded: true })
          .in('id', remindedIds)
      }
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
