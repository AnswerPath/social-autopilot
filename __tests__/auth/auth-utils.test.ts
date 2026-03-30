/**
 * Integration-style tests for auth flows (refresh + login) with mocked Supabase and JWT helpers.
 */

import { NextRequest, NextResponse } from 'next/server'

const mockValidateAccessToken = jest.fn()
const mockJwtRefreshAccessToken = jest.fn()
const mockSignInWithPassword = jest.fn()
const mockUserSessionsInsert = jest.fn()

jest.mock('@/lib/rate-limiting', () => ({
  withRateLimit: () => (_req: NextRequest, handler: (r: NextRequest) => Promise<Response>) =>
    handler(_req),
  clearRateLimit: jest.fn(),
}))

jest.mock('@/lib/activity-logging', () => ({
  logAuthEvent: jest.fn().mockResolvedValue(undefined),
  ActivityLevel: { INFO: 'info' },
}))

jest.mock('@/lib/jwt-utils', () => ({
  validateAccessToken: (...args: unknown[]) => mockValidateAccessToken(...args),
  refreshAccessToken: (...args: unknown[]) => mockJwtRefreshAccessToken(...args),
  isTokenNearExpiry: jest.fn().mockReturnValue(false),
}))

jest.mock('@/lib/session-management', () => {
  const actual = jest.requireActual('@/lib/session-management') as Record<string, unknown>
  return {
    ...actual,
    createEnhancedSession: jest.fn(() => Promise.reject(new Error('enhanced session failed'))),
  }
})

function mockUserSessionsTable() {
  return {
    insert: (...args: unknown[]) => mockUserSessionsInsert(...args),
  }
}

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: jest.fn(() => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    },
    from: (table: string) => {
      if (table === 'user_sessions') {
        return mockUserSessionsTable()
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { role: 'VIEWER' }, error: null }),
      }
    },
  })),
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: (table: string) => {
      if (table === 'user_sessions') {
        return mockUserSessionsTable()
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
    },
  })),
  getSupabaseServiceKeyMisconfigurationMessage: jest.fn(() => null),
}))

function refreshPostRequest() {
  return new NextRequest('http://localhost:3000/api/auth/refresh', {
    method: 'POST',
    headers: {
      cookie: [
        'sb-auth-token=fake-access',
        'sb-refresh-token=fake-refresh',
        'sb-session-id=sess-test',
      ].join('; '),
    },
  })
}

describe('Authentication flows (integration-style)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/auth/refresh', () => {
    it('returns 401 on refresh failure without clearing auth cookies', async () => {
      mockValidateAccessToken.mockResolvedValue({
        isValid: true,
        isExpired: false,
        needsRefresh: true,
        userId: 'user-1',
        expiresAt: Math.floor(Date.now() / 1000) + 60,
      })
      mockJwtRefreshAccessToken.mockResolvedValue({ success: false, error: 'Token refresh failed' })

      const { POST } = await import('@/app/api/auth/refresh/route')
      const response = (await POST(refreshPostRequest())) as NextResponse
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBeDefined()
      expect(mockJwtRefreshAccessToken).toHaveBeenCalledWith('fake-refresh')

      expect(response.headers.get('set-cookie')).toBeFalsy()
    })
  })

  describe('POST /api/auth/login', () => {
    it('returns 500 and does not set session cookies when user_sessions insert fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'user-login-1', email: 'u@example.com' },
          session: {
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })
      mockUserSessionsInsert.mockResolvedValue({ error: { message: 'insert failed' } })

      const { POST } = await import('@/app/api/auth/login/route')
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'u@example.com', password: 'secret' }),
      })

      const response = (await POST(request)) as NextResponse
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error).toBeDefined()
      expect(response.cookies.get('sb-auth-token')?.value).toBeUndefined()
      expect(response.cookies.get('sb-session-id')?.value).toBeUndefined()
      expect(mockUserSessionsInsert).toHaveBeenCalled()
    })
  })
})
