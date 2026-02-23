import { getSupabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { resolveUserEmailById } from './helpers'
import { emailAdapter } from './adapters/email'
import type { NotificationRecord } from './types'
import { formatInTimeZone } from 'date-fns-tz'

const log = createLogger({ service: 'digest' })

const BATCH_SIZE = 100

/**
 * Resolve user timezone from account_settings for digest timestamps. Falls back to UTC.
 */
export async function getUserTimezoneForDigest(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('account_settings')
    .select('account_preferences')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.account_preferences) return 'UTC'
  const prefs = data.account_preferences as { timezone?: string }
  const tz = prefs.timezone && typeof prefs.timezone === 'string' ? prefs.timezone : 'UTC'
  try {
    formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')
    return tz
  } catch {
    return 'UTC'
  }
}

/**
 * Get user IDs that have daily_summary or weekly_digest enabled.
 * Filter is applied in the DB via JSON containment to avoid loading all rows.
 */
export async function getDigestEligibleUserIds(
  kind: 'daily' | 'weekly'
): Promise<string[]> {
  const supabase = getSupabaseAdmin()
  const key = kind === 'daily' ? 'daily_summary' : 'weekly_digest'
  const { data, error } = await supabase
    .from('account_settings')
    .select('user_id')
    .not('notification_preferences', 'is', null)
    .contains('notification_preferences', { [key]: true })

  if (error) {
    log.error({ err: error }, '[digest] getDigestEligibleUserIds failed')
    throw new Error('Failed to get digest-eligible user IDs', { cause: error })
  }

  return (data ?? []).map((row) => row.user_id)
}

/**
 * Get in-app notifications for a user that are not yet included in a digest, within the time window.
 * Fetches in batches so all matching notifications are processed; throws on DB error.
 */
export async function getNotificationsForDigest(
  recipientId: string,
  since: Date
): Promise<NotificationRecord[]> {
  const supabase = getSupabaseAdmin()
  const accumulated: NotificationRecord[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', recipientId)
      .eq('channel', 'in_app')
      .is('digest_sent_at', null)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      log.error({ err: error }, '[digest] getNotificationsForDigest failed')
      throw new Error('Failed to fetch notifications for digest', { cause: error })
    }

    const batch = (data ?? []) as NotificationRecord[]
    accumulated.push(...batch)

    if (batch.length === BATCH_SIZE) {
      log.warn({ recipientId, offset }, '[digest] getNotificationsForDigest hit batch cap; more rows may exist')
    }
    if (batch.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  return accumulated
}

/**
 * Mark notifications as included in a digest.
 */
export async function markDigestSent(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('notifications')
    .update({ digest_sent_at: now })
    .in('id', notificationIds)
  if (error) {
    log.error({ err: error, notificationIds }, '[digest] markDigestSent failed')
    throw new Error('Failed to mark digest as sent', { cause: error })
  }
}

/**
 * Format notification payload for digest: human-facing keys only, short line.
 * Omits internal keys (ids, internal flags). Returns '' if no public fields.
 */
function formatPayloadForDigest(
  payload: Record<string, unknown> | null,
  _notificationType?: string
): string {
  if (!payload || typeof payload !== 'object') return ''
  const allowed: Record<string, string> = {
    approver: 'Approver',
    post_title: 'Post',
    stepName: 'Step',
    step_name: 'Step',
    email: 'Email',
    message: 'Message'
  }
  const parts: string[] = []
  for (const [key, label] of Object.entries(allowed)) {
    const val = payload[key]
    if (val === undefined || val === null) continue
    if (typeof val === 'string' && val.length > 0) parts.push(`${label}: ${val}`)
    else if (typeof val === 'number' || typeof val === 'boolean') parts.push(`${label}: ${String(val)}`)
  }
  return parts.length > 0 ? ` - ${parts.join(', ')}` : ''
}

/**
 * Build plain-text digest body from notifications.
 */
function buildDigestBody(
  notifications: NotificationRecord[],
  kind: 'daily' | 'weekly',
  userTimezone: string = 'UTC'
): string {
  const title = kind === 'daily' ? 'Daily' : 'Weekly'
  const lines = [`Your ${title} notification summary:\n`]
  for (const n of notifications) {
    const type = n.notification_type.replace(/_/g, ' ')
    const payloadStr = formatPayloadForDigest(n.payload, n.notification_type)
    const ts = formatInTimeZone(
      new Date(n.created_at),
      userTimezone,
      'yyyy-MM-dd HH:mm:ss zzz'
    )
    lines.push(`- ${type}${payloadStr} (${ts})`)
  }
  return lines.join('\n')
}

/**
 * Resolve user email from auth for digest delivery.
 */
async function resolveUserEmail(userId: string, notifications: NotificationRecord[]): Promise<string | null> {
  if (notifications.length === 0) return resolveUserEmailById(userId, undefined)
  const payloadEmail = (notifications[0]?.payload as Record<string, string> | undefined)?.email
  return resolveUserEmailById(userId, payloadEmail)
}

/**
 * Send digest email to a user. Resolves email from payload or auth.
 *
 * At-least-once delivery: if emailAdapter.send succeeds but markDigestSent fails,
 * the same notifications may be re-sent on the next digest run. Mitigations:
 * make markDigestSent idempotent, add retries/backoff around markDigestSent,
 * and log failures so operators are aware of possible duplicate digests.
 * Involved: sendDigestToUser, emailAdapter.send, markDigestSent, buildDigestBody.
 */
export async function sendDigestToUser(
  userId: string,
  notifications: NotificationRecord[],
  kind: 'daily' | 'weekly'
): Promise<{ sent: boolean; error?: string }> {
  if (notifications.length === 0) return { sent: true }
  const to = await resolveUserEmail(userId, notifications)
  if (!to) return { sent: false, error: 'Recipient email not found' }
  const userTimezone = await getUserTimezoneForDigest(userId)
  const subject = kind === 'daily' ? 'Daily notification summary' : 'Weekly notification digest'
  const body = buildDigestBody(notifications, kind, userTimezone)
  const result = await emailAdapter.send(to, subject, body)
  if (result.success) {
    await markDigestSent(notifications.map((n) => n.id))
  }
  return { sent: result.success, error: result.error }
}

const DIGEST_CONCURRENCY = 5

/**
 * Run digest job for daily or weekly. Call from cron.
 * Processes users with bounded concurrency to avoid DB/email overload.
 */
export async function runDigestJob(kind: 'daily' | 'weekly'): Promise<{ usersProcessed: number; errors: string[] }> {
  const since = new Date()
  if (kind === 'daily') since.setDate(since.getDate() - 1)
  else since.setDate(since.getDate() - 7)

  const userIds = await getDigestEligibleUserIds(kind)
  const errors: string[] = []
  let usersProcessed = 0

  for (let i = 0; i < userIds.length; i += DIGEST_CONCURRENCY) {
    const chunk = userIds.slice(i, i + DIGEST_CONCURRENCY)
    const results = await Promise.allSettled(
      chunk.map(async (userId) => {
        const notifications = await getNotificationsForDigest(userId, since)
        const result = await sendDigestToUser(userId, notifications, kind)
        return { userId, notifications, result }
      })
    )
    for (let j = 0; j < results.length; j++) {
      const outcome = results[j]
      const userId = chunk[j]
      if (outcome.status === 'fulfilled') {
        const { notifications, result } = outcome.value
        if (result.sent && notifications.length > 0) usersProcessed++
        else if (result.error) errors.push(`${userId}: ${result.error}`)
      } else {
        errors.push(`${userId}: ${outcome.reason instanceof Error ? outcome.reason.message : 'Unknown error'}`)
      }
    }
  }

  return { usersProcessed, errors }
}
