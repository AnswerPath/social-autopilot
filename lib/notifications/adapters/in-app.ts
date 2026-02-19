import type { NotificationRecord } from '../types'

/**
 * In-app adapter: notifications are "delivered" by persisting to DB.
 * Mark as sent when we consider them delivered (e.g. immediately on insert).
 */
export function markInAppDelivered(): { success: boolean } {
  return { success: true }
}

export function isInAppChannel(record: NotificationRecord): boolean {
  return record.channel === 'in_app'
}
