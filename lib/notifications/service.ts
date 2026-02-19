import { getSupabaseAdmin } from '@/lib/supabase'
import { emailAdapter } from './adapters/email'
import { smsAdapter } from './adapters/sms'
import { renderNotificationContent } from './templates'
import type {
  NotificationChannel,
  NotificationEventType,
  NotificationPriority,
  NotificationRecord,
  NotificationListResult,
  QueueNotificationInput,
  GetNotificationsOptions
} from './types'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

/**
 * Queue a single notification: persist to DB and optionally trigger immediate delivery for in_app.
 */
export async function queueNotification(input: QueueNotificationInput): Promise<string> {
  const supabase = getSupabaseAdmin()
  const scheduled_at = input.scheduleFor?.toISOString() ?? new Date().toISOString()
  const priority = input.priority ?? 'normal'

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      recipient_id: input.recipientId,
      channel: input.channel,
      event_type: input.eventType,
      notification_type: input.notificationType,
      payload: input.payload ?? null,
      post_id: input.postId ?? null,
      priority,
      status: 'pending',
      scheduled_at
    })
    .select('id')
    .single()

  if (error) {
    console.error('[notifications] queueNotification failed', error)
    throw new Error(error.message)
  }

  const id = data?.id
  if (id && input.channel === 'in_app') {
    await markSent(id)
  }

  if (id && input.channel === 'email') {
    await deliverEmail(id, input.recipientId, input.eventType, input.notificationType, input.payload)
  }

  if (id && input.channel === 'sms') {
    await deliverSms(id, input.recipientId, input.eventType, input.notificationType, input.payload)
  }

  return id
}

/**
 * Queue multiple notifications (fan-out per recipient and channel).
 */
export async function queueNotifications(inputs: QueueNotificationInput[]): Promise<void> {
  for (const input of inputs) {
    await queueNotification(input)
  }
}

async function markSent(id: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase
    .from('notifications')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)
}

async function resolveRecipientEmail(
  recipientId: string,
  payload?: Record<string, unknown>
): Promise<string | null> {
  const fromPayload = payload?.email
  if (typeof fromPayload === 'string' && fromPayload.includes('@')) {
    return fromPayload
  }
  try {
    const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(recipientId)
    if (!error && data?.user?.email) return data.user.email
  } catch {
    // ignore
  }
  return null
}

async function deliverEmail(
  id: string,
  recipientId: string,
  eventType: NotificationEventType,
  notificationType: string,
  payload?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const to = await resolveRecipientEmail(recipientId, payload)
  if (!to) {
    await supabase
      .from('notifications')
      .update({ status: 'failed', error: 'Recipient email not found' })
      .eq('id', id)
    return
  }
  const { subject, body } = await renderNotificationContent(
    eventType,
    notificationType,
    'email',
    payload ?? null,
    'en'
  )
  const result = await emailAdapter.send(to, subject, body)
  if (result.success) {
    await supabase.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
  } else {
    await supabase.from('notifications').update({ status: 'failed', error: result.error }).eq('id', id)
  }
}

async function deliverSms(
  id: string,
  _recipientId: string,
  eventType: NotificationEventType,
  notificationType: string,
  payload?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { body } = await renderNotificationContent(
    eventType,
    notificationType,
    'sms',
    payload ?? null,
    'en'
  )
  const result = await smsAdapter.send((payload?.phone as string) || '', body)
  if (result.success) {
    await supabase.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
  } else {
    await supabase.from('notifications').update({ status: 'failed', error: result.error }).eq('id', id)
  }
}

/**
 * Get notifications for a user with optional filters and pagination.
 */
export async function getNotificationsForUser(
  recipientId: string,
  options: GetNotificationsOptions = {}
): Promise<NotificationListResult> {
  const supabase = getSupabaseAdmin()
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
  const offset = options.offset ?? 0

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })

  if (options.eventType) {
    query = query.eq('event_type', options.eventType)
  }
  if (options.unreadOnly) {
    query = query.is('read_at', null)
  }
  if (options.since) {
    query = query.gte('created_at', options.since)
  }

  const { data: list, error: listError } = await query.range(offset, offset + limit - 1)

  if (listError) {
    console.error('[notifications] getNotificationsForUser failed', listError)
    throw new Error(listError.message)
  }

  const countResult = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
    .is('read_at', null)

  const unreadCount = countResult.count ?? 0
  const notifications = (list ?? []) as NotificationRecord[]
  const hasMore = notifications.length === limit

  return { notifications, unreadCount, hasMore }
}

/**
 * Get unread count for a user.
 */
export async function getUnreadCount(recipientId: string, eventType?: NotificationEventType): Promise<number> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
    .is('read_at', null)
  if (eventType) {
    query = query.eq('event_type', eventType)
  }
  const { count, error } = await query
  if (error) {
    console.error('[notifications] getUnreadCount failed', error)
    return 0
  }
  return count ?? 0
}

/**
 * Mark notifications as read. Only affects rows for the given recipient.
 */
export async function markRead(notificationIds: string[], recipientId: string): Promise<void> {
  if (notificationIds.length === 0) return
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', notificationIds)
    .eq('recipient_id', recipientId)
  if (error) {
    console.error('[notifications] markRead failed', error)
    throw new Error(error.message)
  }
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllRead(recipientId: string, eventType?: NotificationEventType): Promise<void> {
  const supabase = getSupabaseAdmin()
  let query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', recipientId).is('read_at', null)
  if (eventType) {
    query = query.eq('event_type', eventType)
  }
  const { error } = await query
  if (error) {
    console.error('[notifications] markAllRead failed', error)
    throw new Error(error.message)
  }
}
