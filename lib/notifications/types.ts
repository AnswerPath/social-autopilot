export type NotificationChannel = 'in_app' | 'email' | 'sms'

export type NotificationEventType = 'approval' | 'mention' | 'analytics' | 'system'

export type NotificationPriority = 'low' | 'normal' | 'urgent'

export type NotificationStatus = 'pending' | 'sent' | 'failed'

export interface NotificationRecord {
  id: string
  recipient_id: string
  channel: NotificationChannel
  event_type: NotificationEventType
  notification_type: string
  payload: Record<string, unknown> | null
  post_id: string | null
  priority: NotificationPriority
  status: NotificationStatus
  scheduled_at: string | null
  sent_at: string | null
  read_at: string | null
  error: string | null
  digest_sent_at: string | null
  created_at: string
}

export interface QueueNotificationInput {
  recipientId: string
  channel: NotificationChannel
  eventType: NotificationEventType
  notificationType: string
  payload?: Record<string, unknown>
  postId?: string | null
  priority?: NotificationPriority
  scheduleFor?: Date
}

export interface GetNotificationsOptions {
  limit?: number
  offset?: number
  eventType?: NotificationEventType
  unreadOnly?: boolean
  since?: string
}

export interface NotificationListResult {
  notifications: NotificationRecord[]
  unreadCount: number
  hasMore: boolean
}

export interface IEmailAdapter {
  send(to: string, subject: string, body: string): Promise<{ success: boolean; error?: string }>
}

export interface ISmsAdapter {
  send(to: string, body: string): Promise<{ success: boolean; error?: string }>
}
