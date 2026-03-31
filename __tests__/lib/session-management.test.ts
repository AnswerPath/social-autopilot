import { NextRequest } from 'next/server'
import {
  buildUserSessionInsertRow,
  createEnhancedSession,
  normalizeClientIpForInet
} from '@/lib/session-management'
import { createSupabaseServiceRoleClient } from '@/lib/supabase'

jest.mock('@/lib/supabase', () => ({
  createSupabaseServiceRoleClient: jest.fn()
}))

function requestWithForwardedFor(ip: string) {
  return new NextRequest('http://localhost/', {
    headers: new Headers({
      'x-forwarded-for': ip,
      'user-agent': 'jest-test'
    })
  })
}

describe('normalizeClientIpForInet', () => {
  it('returns null for unknown, empty, and invalid values', () => {
    expect(normalizeClientIpForInet('unknown')).toBeNull()
    expect(normalizeClientIpForInet('')).toBeNull()
    expect(normalizeClientIpForInet('not-an-ip')).toBeNull()
  })

  it('returns valid IPv4 and IPv6 literals', () => {
    expect(normalizeClientIpForInet('203.0.113.10')).toBe('203.0.113.10')
    expect(normalizeClientIpForInet('2001:db8::1')).toBe('2001:db8::1')
  })
})

describe('buildUserSessionInsertRow', () => {
  it('only includes columns that exist on user_sessions (no token fields)', () => {
    const row = buildUserSessionInsertRow({
      session_id: 'sess_1',
      user_id: 'user-1',
      ip_address: '203.0.113.1',
      user_agent: 'jest',
      expires_at: '2026-01-01T00:00:00.000Z',
    })
    expect(Object.keys(row).sort()).toEqual(
      [
        'created_at',
        'expires_at',
        'ip_address',
        'is_active',
        'last_activity',
        'session_id',
        'user_agent',
        'user_id',
      ].sort()
    )
    expect(row).not.toHaveProperty('access_token')
    expect(row).not.toHaveProperty('refresh_token')
    expect(row).not.toHaveProperty('updated_at')
  })
})

describe('createEnhancedSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws when user_sessions insert returns an error', async () => {
    ;(createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        insert: jest
          .fn()
          .mockResolvedValue({ error: { message: 'invalid input syntax for type inet' } }),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ data: [], error: null })
          }))
        }))
      }))
    })

    const req = requestWithForwardedFor('203.0.113.1')

    await expect(createEnhancedSession('user-id-1', req)).rejects.toThrow(
      'user_sessions insert failed'
    )
  })

  it('returns session id when insert succeeds', async () => {
    ;(createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ data: [], error: null })
          }))
        }))
      }))
    })

    const req = requestWithForwardedFor('203.0.113.2')

    const id = await createEnhancedSession('user-id-2', req, 'sess_fixed_id_for_test')

    expect(id).toBe('sess_fixed_id_for_test')
  })
})
