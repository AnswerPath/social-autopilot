import {
  queueNotification,
  queueNotifications,
  getNotificationsForUser,
  getUnreadCount,
  markRead,
  markAllRead
} from '@/lib/notifications/service'

const NOTIF_ROW = {
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

const insertMockFn = jest.fn()
const listResult = { data: [NOTIF_ROW], error: null }
const countResult = { count: 0, error: null }

/** Flexible chain: any method order returns self; then/catch resolve to list or count. Does not set insertMockFn. */
function createChain(resolveWith: { data?: unknown; count?: number; error?: unknown } = listResult) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    range: jest.fn(() => chain),
    is: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    in: jest.fn(() => chain),
    insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: { id: 'notif-123' }, error: null })) })) })),
    update: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    then(onFulfilled?: (v: unknown) => unknown) {
      return Promise.resolve(resolveWith).then(onFulfilled)
    },
    catch(onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(resolveWith).catch(onRejected)
    }
  }
  return chain
}

function createFromReturn(listRes = listResult, countRes = countResult) {
  const listChain = createChain(listRes)
  const countChain = createChain(countRes)
  return {
    listChain,
    countChain,
    insert: insertMockFn,
    select: jest.fn((...args: unknown[]) => {
      const opts = args[1] as { count?: string; head?: boolean } | undefined
      if (args[0] === '*' && opts?.count === 'exact' && !opts?.head) return listChain
      if (args[0] === 'id' && opts?.count === 'exact' && opts?.head === true) return countChain
      return listChain
    }),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({ is: jest.fn(() => Promise.resolve({ error: null })), in: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })) }))
    })),
    in: () => ({ eq: () => Promise.resolve({ error: null }) })
  }
}

let listFromReturn: ReturnType<typeof createFromReturn>
let countFromReturn: ReturnType<typeof createFromReturn>
/** Set by createFromMock().update() so tests can assert on the chain (e.g. eq calls). */
let lastFromMockUpdateReturn: { eq: jest.Mock; in: jest.Mock; is: jest.Mock } | null = null

/** Returns a from() mock: select() dispatches by args (list vs count); update() defers to chain methods—only the invoked path (eq/in/is) calls the underlying list/count update. */
function createFromMock() {
  return {
    insert: insertMockFn,
    select: jest.fn((...args: unknown[]) => {
      const opts = args[1] as { count?: string; head?: boolean } | undefined
      if (args[0] === '*' && opts?.count === 'exact' && !opts?.head) return listFromReturn.listChain
      if (args[0] === 'id' && opts?.count === 'exact' && opts?.head === true) return countFromReturn.countChain
      return listFromReturn.listChain
    }),
    update: jest.fn((payload: unknown) => {
      const chain = {
        eq: jest.fn((key: string, val: unknown) => {
          if (key === 'id' && typeof val === 'string') return countFromReturn.update(payload).eq(key, val)
          return listFromReturn.update(payload).eq(key, val)
        }),
        in: jest.fn((key: string, val: unknown) => listFromReturn.update(payload).in(key, val)),
        is: jest.fn(() => listFromReturn.update(payload))
      }
      lastFromMockUpdateReturn = chain
      return chain
    })
  }
}

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: jest.fn(() => ({
    from: () => createFromMock()
  }))
}))

jest.mock('@/lib/notifications/adapters/email', () => ({
  emailAdapter: { send: jest.fn() }
}))
jest.mock('@/lib/notifications/adapters/sms', () => ({
  smsAdapter: { send: jest.fn() }
}))

const getEmailAdapterSend = () => (jest.requireMock('@/lib/notifications/adapters/email') as { emailAdapter: { send: jest.Mock } }).emailAdapter.send
const getSmsAdapterSend = () => (jest.requireMock('@/lib/notifications/adapters/sms') as { smsAdapter: { send: jest.Mock } }).smsAdapter.send

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    lastFromMockUpdateReturn = null
    insertMockFn.mockImplementation(() => ({
      select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: { id: 'notif-123' }, error: null })) }))
    }))
    listFromReturn = createFromReturn()
    countFromReturn = createFromReturn(listResult, countResult)
    // Defaults intentionally return failure; tests that need success must override these mocks.
    getEmailAdapterSend().mockResolvedValue({ success: false, error: 'Email not configured' })
    getSmsAdapterSend().mockResolvedValue({ success: false, error: 'SMS not configured' })
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

    it('calls markSent (update) when channel is in_app', async () => {
      listFromReturn = createFromReturn()
      countFromReturn = createFromReturn(listResult, countResult)
      const getSupabaseAdminMock = jest.requireMock('@/lib/supabase').getSupabaseAdmin
      getSupabaseAdminMock.mockImplementation(() => ({ from: () => createFromMock() }))
      await queueNotification({
        recipientId: 'user-1',
        channel: 'in_app',
        eventType: 'approval',
        notificationType: 'approval_step_ready'
      })
      expect(countFromReturn.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'sent', sent_at: expect.any(String) })
      )
    })
  })

  describe('queueNotifications', () => {
    it('calls queueNotification per input and aggregates outcomes', async () => {
      await expect(
        queueNotifications([
          {
            recipientId: 'user-1',
            channel: 'in_app',
            eventType: 'approval',
            notificationType: 'approval_step_ready'
          },
          {
            recipientId: 'user-2',
            channel: 'in_app',
            eventType: 'approval',
            notificationType: 'approval_step_ready'
          }
        ])
      ).resolves.toBeUndefined()
      expect(insertMockFn).toHaveBeenCalledTimes(2)
    })

    it('throws with aggregated message when some queueNotification calls fail', async () => {
      let insertCallCount = 0
      insertMockFn.mockImplementation(() => {
        insertCallCount++
        if (insertCallCount === 1) {
          return { select: () => ({ single: () => Promise.resolve({ data: { id: 'a' }, error: null }) }) }
        }
        return { select: () => ({ single: () => Promise.reject(new Error('insert failed')) }) }
      })
      await expect(
        queueNotifications([
          { recipientId: 'user-1', channel: 'in_app', eventType: 'approval', notificationType: 'x' },
          { recipientId: 'user-2', channel: 'in_app', eventType: 'approval', notificationType: 'y' }
        ])
      ).rejects.toThrow(/queueNotifications: 1 failed/)
    })
  })

  describe('getNotificationsForUser', () => {
    it('returns notifications, unreadCount and hasMore', async () => {
      const result = await getNotificationsForUser('user-1', { limit: 10 })
      expect(result).toHaveProperty('notifications')
      expect(result).toHaveProperty('unreadCount')
      expect(result).toHaveProperty('hasMore')
      expect(Array.isArray(result.notifications)).toBe(true)
      if (result.notifications.length > 0) {
        const n = result.notifications[0]
        expect(n).toEqual(
          expect.objectContaining({
            id: expect.anything(),
            recipient_id: expect.anything(),
            channel: expect.anything(),
            event_type: expect.anything(),
            notification_type: expect.anything(),
            status: expect.anything(),
            created_at: expect.anything()
          })
        )
      }
    })
    it('returns result shape when eventType option is provided', async () => {
      const result = await getNotificationsForUser('user-1', { limit: 10, eventType: 'approval' })
      expect(result).toHaveProperty('notifications')
      expect(result).toHaveProperty('unreadCount')
      expect(result).toHaveProperty('hasMore')
      expect(Array.isArray(result.notifications)).toBe(true)
    })
    it('throws when list query returns error', async () => {
      listFromReturn = createFromReturn({ data: null, error: { message: 'list failed' } })
      countFromReturn = createFromReturn(listResult, countResult)
      const getSupabaseAdminMock = jest.requireMock('@/lib/supabase').getSupabaseAdmin
      getSupabaseAdminMock.mockImplementation(() => ({ from: () => createFromMock() }))
      await expect(getNotificationsForUser('user-1', { limit: 10 })).rejects.toThrow('list failed')
    })
  })

  describe('getUnreadCount', () => {
    it('returns count when query succeeds', async () => {
      const countChain = createChain({ count: 3, error: null })
      const getSupabaseAdminMock = jest.requireMock('@/lib/supabase').getSupabaseAdmin
      getSupabaseAdminMock.mockImplementation(() => ({
        from: () => ({ select: () => countChain, update: jest.fn(), in: () => ({ eq: () => Promise.resolve({ error: null }) }) })
      }))
      const count = await getUnreadCount('user-1')
      expect(count).toBe(3)
    })
    it('returns 0 when count query errors', async () => {
      const countChain = createChain({ count: null, error: { message: 'count failed' } })
      const getSupabaseAdminMock = jest.requireMock('@/lib/supabase').getSupabaseAdmin
      getSupabaseAdminMock.mockImplementation(() => ({
        from: () => ({ select: () => countChain, update: jest.fn(), in: () => ({ eq: () => Promise.resolve({ error: null }) }) })
      }))
      const count = await getUnreadCount('user-1')
      expect(count).toBe(0)
    })
  })

  describe('markRead', () => {
    it('does not throw when given empty array', async () => {
      await expect(markRead([], 'user-1')).resolves.toBeUndefined()
    })
    it('calls update with correct ids and recipient when given non-empty array', async () => {
      const updateChain = { in: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })) }
      listFromReturn = {
        ...createFromReturn(),
        update: jest.fn(() => updateChain)
      }
      countFromReturn = createFromReturn(listResult, countResult)
      const getSupabaseAdminMock = jest.requireMock('@/lib/supabase').getSupabaseAdmin
      getSupabaseAdminMock.mockImplementation(() => ({ from: () => createFromMock() }))
      await markRead(['id-1', 'id-2'], 'user-1')
      expect(listFromReturn.update).toHaveBeenCalledWith(expect.objectContaining({ read_at: expect.any(String) }))
      expect(updateChain.in).toHaveBeenCalledWith('id', ['id-1', 'id-2'])
    })
  })

  describe('markAllRead', () => {
    it('resolves without throwing and updates DB with recipient_id and read_at', async () => {
      await expect(markAllRead('user-1')).resolves.toBeUndefined()
      expect(listFromReturn.update).toHaveBeenCalledWith(
        expect.objectContaining({ read_at: expect.any(String) })
      )
      expect(lastFromMockUpdateReturn?.eq).toHaveBeenCalledWith('recipient_id', 'user-1')
    })
  })

  describe('delivery paths', () => {
    it('updates notification to sent when email adapter returns success', async () => {
      getEmailAdapterSend().mockResolvedValue({ success: true })
      listFromReturn = createFromReturn()
      countFromReturn = createFromReturn(listResult, countResult)
      const updateChain = { eq: jest.fn(() => Promise.resolve({ error: null })) }
      countFromReturn.update = jest.fn(() => updateChain)
      const getSupabaseAdminMock = jest.requireMock('@/lib/supabase').getSupabaseAdmin
      getSupabaseAdminMock.mockImplementation(() => ({ from: () => createFromMock() }))
      await queueNotification({
        recipientId: 'user-1',
        channel: 'email',
        eventType: 'approval',
        notificationType: 'approval_step_ready',
        payload: { email: 'test@example.com' }
      })
      expect(countFromReturn.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent', sent_at: expect.any(String) }))
    })

    it('updates notification to failed when email adapter returns failure', async () => {
      getEmailAdapterSend().mockResolvedValue({ success: false, error: 'smtp error' })
      listFromReturn = createFromReturn()
      countFromReturn = createFromReturn(listResult, countResult)
      const updateChain = { eq: jest.fn(() => Promise.resolve({ error: null })) }
      countFromReturn.update = jest.fn(() => updateChain)
      const getSupabaseAdminMock = jest.requireMock('@/lib/supabase').getSupabaseAdmin
      getSupabaseAdminMock.mockImplementation(() => ({ from: () => createFromMock() }))
      await queueNotification({
        recipientId: 'user-1',
        channel: 'email',
        eventType: 'approval',
        notificationType: 'approval_step_ready',
        payload: { email: 'test@example.com' }
      })
      expect(countFromReturn.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: 'smtp error' }))
    })

    it('updates notification to failed when sms adapter returns failure', async () => {
      getSmsAdapterSend().mockResolvedValue({ success: false, error: 'twilio error' })
      listFromReturn = createFromReturn()
      countFromReturn = createFromReturn(listResult, countResult)
      const updateChain = { eq: jest.fn(() => Promise.resolve({ error: null })) }
      countFromReturn.update = jest.fn(() => updateChain)
      const getSupabaseAdminMock = jest.requireMock('@/lib/supabase').getSupabaseAdmin
      getSupabaseAdminMock.mockImplementation(() => ({ from: () => createFromMock() }))
      await queueNotification({
        recipientId: 'user-1',
        channel: 'sms',
        eventType: 'approval',
        notificationType: 'approval_step_ready',
        payload: { phone: '+15551234567' }
      })
      expect(countFromReturn.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: 'twilio error' }))
    })
  })
})
