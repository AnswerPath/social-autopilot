import {
  queueNotification,
  getNotificationsForUser,
  getUnreadCount,
  markRead,
  markAllRead
} from '@/lib/notifications/service'

const mockInsert = { select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: { id: 'notif-123' }, error: null })) })) }
const mockRange = jest.fn(() =>
  Promise.resolve({
    data: [
      {
        id: 'notif-123',
        recipient_id: 'user-1',
        channel: 'in_app',
        event_type: 'approval',
        notification_type: 'approval_step_ready',
        payload: {},
        post_id: null,
        priority: 'normal',
        status: 'sent',
        scheduled_at: null,
        sent_at: null,
        read_at: null,
        error: null,
        digest_sent_at: null,
        created_at: new Date().toISOString()
      }
    ],
    error: null
  })
)
const mockEq = jest.fn(() => ({
  order: jest.fn(() => ({ range: mockRange })),
  is: jest.fn(() => Promise.resolve({ count: 0 })),
  gte: jest.fn(function (this: any) { return this }),
  eq: jest.fn(function (this: any) { return this })
}))
jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      insert: () => mockInsert,
      update: () => {
  const resolved = Promise.resolve({ error: null })
  const chain = Object.assign(resolved, { eq: () => chain })
  return {
    eq: () => ({ is: () => chain }),
    in: () => ({ eq: () => Promise.resolve({ error: null }) })
  }
},
      select: () => ({ eq: mockEq }),
      in: () => ({ eq: () => Promise.resolve({ error: null }) })
    })
  })
}))

jest.mock('@/lib/notifications/adapters/email', () => ({
  emailAdapter: { send: jest.fn().mockResolvedValue({ success: false, error: 'Email not configured' }) }
}))

jest.mock('@/lib/notifications/adapters/sms', () => ({
  smsAdapter: { send: jest.fn().mockResolvedValue({ success: false, error: 'SMS not configured' }) }
}))

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('queueNotification', () => {
    it('returns an id when inserting in_app notification', async () => {
      const id = await queueNotification({
        recipientId: 'user-1',
        channel: 'in_app',
        eventType: 'approval',
        notificationType: 'approval_step_ready',
        payload: { stepName: 'Review' }
      })
      expect(id).toBe('notif-123')
    })
  })

  describe('getNotificationsForUser', () => {
    it('returns notifications, unreadCount and hasMore', async () => {
      const result = await getNotificationsForUser('user-1', { limit: 10 })
      expect(result).toHaveProperty('notifications')
      expect(result).toHaveProperty('unreadCount')
      expect(result).toHaveProperty('hasMore')
      expect(Array.isArray(result.notifications)).toBe(true)
    })
  })

  describe('markRead', () => {
    it('does not throw when given empty array', async () => {
      await expect(markRead([], 'user-1')).resolves.toBeUndefined()
    })
  })

  describe('markAllRead', () => {
    it('resolves without throwing', async () => {
      await expect(markAllRead('user-1')).resolves.toBeUndefined()
    })
  })
})
