/**
 * Discord webhook sender. Fire-and-forget style: logs and swallows
 * errors so a failed notification never crashes the caller.
 *
 * Discord has a 2000-char limit per message. Callers that might
 * exceed this should pre-chunk via `sendDiscordMessages`.
 */

const DISCORD_CHAR_LIMIT = 1900 // leave a little headroom

export async function sendDiscordMessage(content: string): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    console.warn('[discord] DISCORD_WEBHOOK_URL is not configured')
    return
  }

  const trimmed = content.length > DISCORD_CHAR_LIMIT
    ? content.slice(0, DISCORD_CHAR_LIMIT - 1) + '…'
    : content

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: trimmed }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[discord] webhook failed:', res.status, body)
    }
  } catch (err) {
    console.error('[discord] webhook error:', err)
  }
}

export async function sendDiscordMessages(
  contents: string[]
): Promise<void> {
  for (const content of contents) {
    if (!content.trim()) continue
    await sendDiscordMessage(content)
  }
}
