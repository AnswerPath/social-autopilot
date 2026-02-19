import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-utils'
import { createAuthError } from '@/lib/auth-utils'
import { AuthErrorType } from '@/lib/auth-types'
import {
  getNotificationsForUser,
  getUnreadCount,
  markRead,
  markAllRead
} from '@/lib/notifications/service'
import type { NotificationEventType } from '@/lib/notifications/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return createAuthError(AuthErrorType.UNAUTHORIZED, 'User not authenticated')
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)
    const eventType = searchParams.get('event_type') as NotificationEventType | null
    const unreadOnly = searchParams.get('unread_only') === 'true'
    const since = searchParams.get('since') ?? undefined

    const result = await getNotificationsForUser(user.id, {
      limit,
      offset,
      eventType: eventType ?? undefined,
      unreadOnly,
      since
    })

    return NextResponse.json({
      notifications: result.notifications,
      unreadCount: result.unreadCount,
      hasMore: result.hasMore
    })
  } catch (err) {
    console.error('[api/notifications] GET failed', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return createAuthError(AuthErrorType.UNAUTHORIZED, 'User not authenticated')
  }

  try {
    const body = await request.json().catch(() => ({}))
    const action = body.action as string

    if (action === 'mark-read') {
      const notificationIds = Array.isArray(body.notificationIds) ? body.notificationIds : []
      await markRead(notificationIds, user.id)
      const unreadCount = await getUnreadCount(user.id)
      return NextResponse.json({ success: true, unreadCount })
    }

    if (action === 'mark-all-read') {
      const eventType = (body.event_type as NotificationEventType) || undefined
      await markAllRead(user.id, eventType)
      const unreadCount = await getUnreadCount(user.id)
      return NextResponse.json({ success: true, unreadCount })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[api/notifications] POST failed', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update notifications' },
      { status: 500 }
    )
  }
}
