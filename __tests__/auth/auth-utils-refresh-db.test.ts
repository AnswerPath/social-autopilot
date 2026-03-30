/**
 * Ensures refreshAccessToken updates user_sessions with columns that exist in the schema
 * (last_activity only — no access_token / refresh_token / updated_at).
 */

import { NextRequest } from 'next/server'

const mockRefreshSession = jest.fn()

let userSessionsFromCall = 0
let lastUserSessionsUpdatePayload: Record<string, unknown> | undefined

jest.mock('next/headers', () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    })
  ),
}))

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: jest.fn(() => ({
    auth: {
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
  })),
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => {
      userSessionsFromCall += 1
      if (userSessionsFromCall === 1) {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { is_active: true }, error: null }),
        }
      }
      return {
        update: jest.fn((payload: Record<string, unknown>) => {
          lastUserSessionsUpdatePayload = payload
          return {
            eq: jest.fn().mockResolvedValue({ error: null }),
          }
        }),
      }
    }),
  })),
}))

describe('auth-utils refreshAccessToken user_sessions update', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    userSessionsFromCall = 0
    lastUserSessionsUpdatePayload = undefined
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      error: null,
    })
  })

  it('updates only last_activity (no token columns)', async () => {
    const { refreshAccessToken } = await import('@/lib/auth-utils')

    const request = new NextRequest('http://localhost:3000/test', {
      headers: { cookie: 'sb-refresh-token=fake-refresh; sb-session-id=sess-abc' },
    })

    const result = await refreshAccessToken(request)

    expect(result.success).toBe(true)
    expect(result.newToken).toBe('new-access')
    expect(lastUserSessionsUpdatePayload).toBeDefined()
    expect(Object.keys(lastUserSessionsUpdatePayload!)).toEqual(['last_activity'])
    expect(typeof lastUserSessionsUpdatePayload!.last_activity).toBe('string')
    expect(lastUserSessionsUpdatePayload).not.toHaveProperty('access_token')
    expect(lastUserSessionsUpdatePayload).not.toHaveProperty('refresh_token')
    expect(lastUserSessionsUpdatePayload).not.toHaveProperty('updated_at')
  })
})
