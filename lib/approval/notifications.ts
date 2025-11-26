import { supabaseAdmin } from '@/lib/supabase'

export type NotificationChannel = 'in_app' | 'email' | 'sms'

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

export interface QueueNotificationInput {
  postId?: string
  recipientIds: string[]
  notificationType: string
  payload?: Record<string, any>
  channels?: NotificationChannel[]
  scheduleFor?: Date
}

/**
 * Queue notifications for approvers/reviewers. Uses fan-out per channel to simplify delivery.
 */
export async function queueApprovalNotifications({
  postId,
  recipientIds,
  notificationType,
  payload,
  channels = ['in_app'],
  scheduleFor
}: QueueNotificationInput): Promise<void> {
  if (!recipientIds.length) {
    return
  }

  const scheduled_at = scheduleFor?.toISOString() ?? new Date().toISOString()
  const rows = recipientIds.flatMap((recipient_id) =>
    channels.map((channel) => ({
      post_id: postId ?? null,
      recipient_id,
      channel,
      notification_type: notificationType,
      payload: payload ?? null,
      scheduled_at,
      status: 'pending'
    }))
  )

  const { error } = await supabaseAdmin
    .from('approval_notifications')
    .insert(rows)

  if (error) {
    console.error('Failed to queue approval notifications', error)
    throw new Error(error.message)
  }
}

export async function getApprovalNotifications(recipientId: string): Promise<ApprovalNotification[]> {
  const { data, error } = await supabaseAdmin
    .from('approval_notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Failed to fetch approval notifications', error)
    throw new Error(error.message)
  }

  return (data as ApprovalNotification[]) || []
}

export async function markNotificationsRead(notificationIds: string[], recipientId: string) {
  if (!notificationIds.length) return

  const { error } = await supabaseAdmin
    .from('approval_notifications')
    .update({
      read_at: new Date().toISOString()
    })
    .in('id', notificationIds)
    .eq('recipient_id', recipientId)

  if (error) {
    console.error('Failed to mark notifications read', error)
    throw new Error(error.message)
  }
}

