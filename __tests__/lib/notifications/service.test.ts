import {
  queueNotification,
  getNotificationsForUser,
  markRead,
  markAllRead
} from '@/lib/notifications/service'

const mockInsert = { select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: { id: 'notif-123' }, error: null })) })) }
const insertMockFn = jest.fn(() => mockInsert)
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
const orderReturn = {
  range: mockRange,
  eq: jest.fn(function (this: typeof orderReturn) { return this }),
  is: jest.fn(function (this: typeof orderReturn) { return this }),
  gte: jest.fn(function (this: typeof orderReturn) { return this })
}
const selectChain = {
  order: jest.fn(() => orderReturn),
  is: jest.fn(function (this: typeof selectChain) { return this }),
  gte: jest.fn(function (this: typeof selectChain) { return this }),
  eq: jest.fn(function (this: typeof selectChain) { return this }),
  then: (onFulfilled?: (v: unknown) => unknown) =>
    Promise.resolve({ count: 0, error: null }).then(onFulfilled),
  catch: (onRejected?: (e: unknown) => unknown) =>
    Promise.resolve({ count: 0, error: null }).catch(onRejected)
}
const mockEq = jest.fn(() => selectChain)
const createFromReturn = () => ({
  insert: insertMockFn,
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
jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: jest.fn(() => ({
    from: () => createFromReturn()
  }))
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
    mockEq.mockImplementation(() => selectChain)
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
      expect(mockInsert.select).toHaveBeenCalledWith('id')
      expect(insertMockFn).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_id: 'user-1',
          channel: 'in_app',
          event_type: 'approval',
          notification_type: 'approval_step_ready',
          payload: { stepName: 'Review' },
          status: 'pending'
        })
      )
    })
  })

  describe('getNotificationsForUser', () => {
    it('returns notifications, unreadCount and hasMore', async () => {
      const result = await getNotificationsForUser('user-1', { limit: 10 })
      expect(result).toHaveProperty('notifications')
      expect(result).toHaveProperty('unreadCount')
      expect(result).toHaveProperty('hasMore')
      expect(Array.isArray(result.notifications)).toBe(true)
      expect(result.notifications.length).toBeGreaterThanOrEqual(0)
      if (result.notifications.length > 0) {
        const n = result.notifications[0]
        expect(n).toHaveProperty('id')
        expect(n).toHaveProperty('recipient_id')
        expect(n).toHaveProperty('channel')
        expect(n).toHaveProperty('event_type')
        expect(n).toHaveProperty('notification_type')
        expect(n).toHaveProperty('status')
        expect(n).toHaveProperty('created_at')
      }
    })
    it('returns result shape when eventType option is provided', async () => {
      const result = await getNotificationsForUser('user-1', { limit: 10, eventType: 'approval' })
      expect(result).toHaveProperty('notifications')
      expect(result).toHaveProperty('unreadCount')
      expect(result).toHaveProperty('hasMore')
    })
    it('returns result shape when unreadOnly option is provided', async () => {
      const result = await getNotificationsForUser('user-1', { limit: 10, unreadOnly: true })
      expect(result).toHaveProperty('notifications')
      expect(result).toHaveProperty('unreadCount')
    })
    it('throws when list query returns error', async () => {
      mockRange.mockResolvedValueOnce({ data: null, error: { message: 'list failed' } })
      await expect(getNotificationsForUser('user-1', { limit: 10 })).rejects.toThrow('list failed')
    })
  })

  describe('markRead', () => {
    it('does not throw when given empty array', async () => {
      await expect(markRead([], 'user-1')).resolves.toBeUndefined()
    })
    it('calls update with correct ids and recipient when given non-empty array', async () => {
      const updateChain = { in: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })) }
      const fromReturn = {
        update: jest.fn(() => updateChain),
        insert: insertMockFn,
        select: () => ({ eq: mockEq }),
        in: () => ({ eq: () => Promise.resolve({ error: null }) })
      }
      const getSupabaseAdminMock = jest.requireMock('@/lib/supabase').getSupabaseAdmin
      getSupabaseAdminMock.mockImplementationOnce(() => ({ from: () => fromReturn }))
      await markRead(['id-1', 'id-2'], 'user-1')
      expect(fromReturn.update).toHaveBeenCalledWith(expect.objectContaining({ read_at: expect.any(String) }))
      expect(updateChain.in).toHaveBeenCalledWith('id', ['id-1', 'id-2'])
    })
  })

  describe('markAllRead', () => {
    it('resolves without throwing', async () => {
      await expect(markAllRead('user-1')).resolves.toBeUndefined()
    })
  })
})
