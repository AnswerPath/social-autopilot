import { getSupabaseAdmin } from '@/lib/supabase'
import { emailAdapter } from './adapters/email'
import type { NotificationRecord } from './types'

/**
 * Get user IDs that have daily_summary or weekly_digest enabled.
 */
export async function getDigestEligibleUserIds(
  kind: 'daily' | 'weekly'
): Promise<string[]> {
  const supabase = getSupabaseAdmin()
  const key = kind === 'daily' ? 'daily_summary' : 'weekly_digest'
  const { data, error } = await supabase
    .from('account_settings')
    .select('user_id, notification_preferences')
    .not('notification_preferences', 'is', null)

  if (error) {
    console.error('[digest] getDigestEligibleUserIds failed', error)
    return []
  }

  const userIds: string[] = []
  for (const row of data ?? []) {
    const prefs = row.notification_preferences as Record<string, unknown> | null
    if (prefs && prefs[key] === true) userIds.push(row.user_id)
  }
  return userIds
}

/**
 * Get in-app notifications for a user that are not yet included in a digest, within the time window.
 */
export async function getNotificationsForDigest(
  recipientId: string,
  since: Date
): Promise<NotificationRecord[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .eq('channel', 'in_app')
    .is('digest_sent_at', null)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[digest] getNotificationsForDigest failed', error)
    return []
  }
  return (data ?? []) as NotificationRecord[]
}

/**
 * Mark notifications as included in a digest.
 */
export async function markDigestSent(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  await supabase
    .from('notifications')
    .update({ digest_sent_at: now })
    .in('id', notificationIds)
}

/**
 * Build plain-text digest body from notifications.
 */
function buildDigestBody(notifications: NotificationRecord[], kind: 'daily' | 'weekly'): string {
  const title = kind === 'daily' ? 'Daily' : 'Weekly'
  const lines = [`Your ${title} notification summary:\n`]
  for (const n of notifications) {
    const type = n.notification_type.replace(/_/g, ' ')
    const payload = n.payload ? ` - ${JSON.stringify(n.payload)}` : ''
    lines.push(`- ${type}${payload} (${new Date(n.created_at).toLocaleString()})`)
  }
  return lines.join('\n')
}

/**
 * Resolve user email from auth for digest delivery.
 */
async function resolveUserEmail(userId: string, notifications: NotificationRecord[]): Promise<string | null> {
  const fromPayload = (notifications[0]?.payload as Record<string, string> | undefined)?.email
  if (typeof fromPayload === 'string' && fromPayload.includes('@')) return fromPayload
  try {
    const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(userId)
    if (!error && data?.user?.email) return data.user.email
  } catch {
    // ignore
  }
  return null
}

/**
 * Send digest email to a user. Resolves email from payload or auth.
 */
export async function sendDigestToUser(
  userId: string,
  notifications: NotificationRecord[],
  kind: 'daily' | 'weekly'
): Promise<{ sent: boolean; error?: string }> {
  if (notifications.length === 0) return { sent: true }
  const to = await resolveUserEmail(userId, notifications)
  if (!to) return { sent: false, error: 'Recipient email not found' }
  const subject = kind === 'daily' ? 'Daily notification summary' : 'Weekly notification digest'
  const body = buildDigestBody(notifications, kind)
  const result = await emailAdapter.send(to, subject, body)
  if (result.success) await markDigestSent(notifications.map((n) => n.id))
  return { sent: result.success, error: result.error }
}

/**
 * Run digest job for daily or weekly. Call from cron.
 */
export async function runDigestJob(kind: 'daily' | 'weekly'): Promise<{ usersProcessed: number; errors: string[] }> {
  const since = new Date()
  if (kind === 'daily') since.setDate(since.getDate() - 1)
  else since.setDate(since.getDate() - 7)

  const userIds = await getDigestEligibleUserIds(kind)
  const errors: string[] = []
  let usersProcessed = 0

  for (const userId of userIds) {
    try {
      const notifications = await getNotificationsForDigest(userId, since)
      const result = await sendDigestToUser(userId, notifications, kind)
      if (result.sent && notifications.length > 0) usersProcessed++
      else if (result.error) errors.push(`${userId}: ${result.error}`)
    } catch (e) {
      errors.push(`${userId}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  return { usersProcessed, errors }
}
