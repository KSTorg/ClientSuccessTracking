/**
 * Discord webhook helpers using embeds for polished notifications.
 * Fire-and-forget style: logs and swallows errors so a failed
 * notification never crashes the caller.
 */

const KST_LOGO = 'https://go.kst-marketinghq.com/Media/KSTLogo.png'

export interface DiscordEmbed {
  title?: string
  description?: string
  color?: number
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string }
  thumbnail?: { url: string }
  timestamp?: string
}

/**
 * Send one or more embeds via the Discord webhook.
 * `content` lives outside the embed so Discord actually pings @mentions.
 */
export async function sendDiscordEmbed(
  embeds: DiscordEmbed[],
  content?: string
): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[discord] DISCORD_WEBHOOK_URL is not configured')
    return
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content || null,
        embeds: embeds.map((e) => ({
          ...e,
          thumbnail: e.thumbnail ?? { url: KST_LOGO },
        })),
        username: 'KST Tracker',
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[discord] webhook failed:', res.status, body)
    }
  } catch (err) {
    console.error('[discord] webhook error:', err)
  }
}

// Colour palette
export const COLORS = {
  red: 0xf87171,
  green: 0x34d399,
  gold: 0xc9a84c,
  blue: 0x60a5fa,
} as const
