import {
  queueNotifications,
  getNotificationsForUser,
  markRead as markNotificationsReadService,
} from '@/lib/notifications/service'
import type { NotificationChannel } from '@/lib/notifications/types'

export type { NotificationChannel }

export interface ApprovalNotification {
  id: string
  post_id: string | null
  recipient_id: string
  channel: NotificationChannel
  notification_type: string
  payload: Record<string, any> | null
  status: 'pending' | 'sent' | 'failed'
  scheduled_at: string | null
  sent_at: string | null
  read_at: string | null
  error?: string | null
  created_at: string
}

export interface QueueApprovalNotificationInput {
  postId?: string
  recipientIds: string[]
  notificationType: string
  payload?: Record<string, any>
  channels?: NotificationChannel[]
  scheduleFor?: Date
}

/**
 * Queue notifications for approvers/reviewers via unified notification service.
 * Writes to notifications table with event_type='approval'.
 */
export async function queueApprovalNotifications({
  postId,
  recipientIds,
  notificationType,
  payload,
  channels = ['in_app'],
  scheduleFor
}: QueueApprovalNotificationInput): Promise<void> {
  if (!recipientIds.length) return

  const inputs = recipientIds.flatMap((recipientId) =>
    channels.map((channel) => ({
      recipientId,
      channel,
      eventType: 'approval' as const,
      notificationType,
      payload,
      postId: postId ?? null,
      priority: 'urgent' as const,
      scheduleFor
    }))
  )

  await queueNotifications(inputs)
}

/**
 * Get approval notifications for a recipient (from unified notifications table).
 * Limited to 50 most recent; pagination not surfaced (caller gets a single page).
 */
export async function getApprovalNotifications(recipientId: string): Promise<ApprovalNotification[]> {
  const { notifications } = await getNotificationsForUser(recipientId, {
    eventType: 'approval',
    limit: 50
  })
  return notifications.map((n) => ({
    id: n.id,
    post_id: n.post_id,
    recipient_id: n.recipient_id,
    channel: n.channel,
    notification_type: n.notification_type,
    payload: n.payload,
    status: n.status,
    scheduled_at: n.scheduled_at,
    sent_at: n.sent_at,
    read_at: n.read_at,
    error: n.error,
    created_at: n.created_at
  }))
}

/**
 * Mark approval notifications as read.
 */
export async function markNotificationsRead(notificationIds: string[], recipientId: string): Promise<void> {
  await markNotificationsReadService(notificationIds, recipientId)
}
