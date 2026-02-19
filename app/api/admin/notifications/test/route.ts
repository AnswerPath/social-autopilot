import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-utils'
import { isAdmin } from '@/lib/auth-utils'
import { createAuthError } from '@/lib/auth-utils'
import { AuthErrorType } from '@/lib/auth-types'
import { queueNotification } from '@/lib/notifications/service'
import type { NotificationChannel } from '@/lib/notifications/types'
import type { NotificationEventType } from '@/lib/notifications/types'

export const dynamic = 'force-dynamic'

/**
 * Admin-only: create and send a test notification.
 * POST body: { userId: string, channel: 'in_app' | 'email' | 'sms', eventType?: NotificationEventType }
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return createAuthError(AuthErrorType.UNAUTHORIZED, 'User not authenticated')
  }
  if (!isAdmin(user)) {
    return createAuthError(AuthErrorType.FORBIDDEN, 'Admin only')
  }

  try {
    const body = await request.json().catch(() => ({}))
    const userId = body.userId as string
    const channel = (body.channel ?? 'in_app') as NotificationChannel
    const eventType = (body.eventType ?? 'system') as NotificationEventType

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (!['in_app', 'email', 'sms'].includes(channel)) {
      return NextResponse.json({ error: 'channel must be in_app, email, or sms' }, { status: 400 })
    }

    const id = await queueNotification({
      recipientId: userId,
      channel,
      eventType,
      notificationType: 'test_notification',
      payload: { message: 'This is a test notification', triggeredBy: user.id }
    })

    return NextResponse.json({ success: true, notificationId: id })
  } catch (err) {
    console.error('[admin/notifications/test] failed', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Test notification failed' },
      { status: 500 }
    )
  }
}
